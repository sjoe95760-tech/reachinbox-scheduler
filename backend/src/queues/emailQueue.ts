import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

export const EMAIL_QUEUE_NAME = "email-send-queue";

// This Queue object is how the API adds delayed jobs to Redis. BullMQ
// persists jobs in Redis itself (not just in-memory), so:
//  - If the backend process restarts, jobs already in Redis are untouched
//    and will still fire at their scheduled time once a worker reconnects.
//  - If the worker process restarts mid-job, BullMQ's lock/stalled-job
//    detection re-queues the job instead of losing it or silently dropping it.
export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // retry a failed send up to 3 times
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      age: 3600 * 24, // keep completed jobs 24h for debugging, then clean up
    },
    removeOnFail: false, // keep failed jobs visible for inspection
  },
});

/**
 * Enqueue a single email job as a BullMQ delayed job.
 *
 * IDEMPOTENCY: we pass `jobId` = the EmailJob's own DB id. BullMQ guarantees
 * a jobId is unique within a queue - if a job with that id already exists,
 * `add()` is a no-op and returns the existing job instead of creating a
 * duplicate. This means even if our API is called twice for the same
 * EmailJob row (e.g. a retried request, or a restart re-running scheduling
 * logic), we can never end up with two BullMQ jobs for the same email.
 */
export async function enqueueEmailJob(params: {
  emailJobId: string;
  delayMs: number;
}) {
  const { emailJobId, delayMs } = params;

  const job = await emailQueue.add(
    "send-email",
    { emailJobId },
    {
      jobId: emailJobId, // <-- idempotency key
      delay: Math.max(delayMs, 0),
    }
  );

  return job;
}
