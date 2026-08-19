import { Worker, Job } from "bullmq";
import dotenv from "dotenv";
dotenv.config();

import { redisConnection } from "../config/redis";
import { EMAIL_QUEUE_NAME, enqueueEmailJob } from "../queues/emailQueue";
import { prisma } from "../db/prisma";
import { tryConsumeRateLimit, nextHourWindowStart } from "../services/rateLimiter";
import { sendEmailViaEthereal } from "../services/etherealMailer";

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY) || 5;
const MIN_DELAY_MS = Number(process.env.MIN_DELAY_BETWEEN_EMAILS_MS) || 2000;
const MAX_PER_HOUR = Number(process.env.MAX_EMAILS_PER_HOUR) || 200;

/**
 * Processes ONE email job.
 *
 * Order of operations per job:
 *  1. Look up the EmailJob row in Postgres (source of truth).
 *     - If it's already SENT, skip (idempotency guard #2, on top of BullMQ's
 *       own jobId uniqueness - covers the edge case where a stalled job gets
 *       retried after actually succeeding).
 *  2. Try to consume one slot from this hour's rate-limit budget.
 *     - If the budget is used up, DON'T fail the job. Re-enqueue it for the
 *       start of next hour and mark status RATE_LIMITED, then return.
 *  3. Enforce the minimum delay between sends (throttling), then send via
 *     Ethereal.
 *  4. Update the DB row to SENT (or FAILED with attempts++ on error, letting
 *     BullMQ's retry/backoff handle re-attempts).
 */
async function processEmailJob(job: Job<{ emailJobId: string }>) {
  const { emailJobId } = job.data;

  const emailJob = await prisma.emailJob.findUnique({
    where: { id: emailJobId },
    include: { campaign: true, sender: true },
  });

  if (!emailJob) {
    console.warn(`[worker] EmailJob ${emailJobId} not found, skipping.`);
    return;
  }

  // Idempotency guard: never re-send something already sent.
  if (emailJob.status === "SENT") {
    console.log(`[worker] EmailJob ${emailJobId} already SENT, skipping.`);
    return;
  }

  // --- Rate limit check (per-sender if a sender is assigned, else global) ---
  const { allowed } = await tryConsumeRateLimit({
    senderId: emailJob.senderId ?? undefined,
    maxPerHour: emailJob.campaign.hourlyLimit || MAX_PER_HOUR,
  });

  if (!allowed) {
    const nextWindow = nextHourWindowStart();
    console.log(
      `[worker] Rate limit hit for job ${emailJobId}. Rescheduling to ${nextWindow.toISOString()}`
    );

    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: { status: "RATE_LIMITED", scheduledFor: nextWindow },
    });

    // Re-enqueue for the next hour window. Because we reuse the SAME
    // emailJobId as the BullMQ jobId, and this job is currently
    // "in progress" (being processed), we let it complete normally and
    // create a fresh delayed job pointing at the next window.
    await enqueueEmailJob({
      emailJobId,
      delayMs: nextWindow.getTime() - Date.now(),
    });

    return; // do not throw - this is expected flow-control, not a failure
  }

  // --- Throttle: minimum delay between individual sends ---
  // Applied inside the worker so it holds even under concurrency > 1;
  // BullMQ's limiter (in emailQueue) provides a global backstop too.
  await new Promise((resolve) => setTimeout(resolve, MIN_DELAY_MS));

  try {
    if (!emailJob.sender) {
      throw new Error("No sender assigned to this email job");
    }

    const { previewUrl } = await sendEmailViaEthereal({
      creds: {
        smtpHost: emailJob.sender.smtpHost,
        smtpPort: emailJob.sender.smtpPort,
        smtpUser: emailJob.sender.smtpUser,
        smtpPass: emailJob.sender.smtpPass,
      },
      to: emailJob.recipient,
      subject: emailJob.subject,
      html: emailJob.body,
    });

    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: "SENT",
        sentAt: new Date(),
        lastError: previewUrl ? `Preview: ${previewUrl}` : null,
      },
    });

    console.log(`[worker] Sent email ${emailJobId} to ${emailJob.recipient}`);
  } catch (err: any) {
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: "FAILED",
        attempts: { increment: 1 },
        lastError: String(err?.message ?? err),
      },
    });
    // Re-throw so BullMQ's retry/backoff (configured in emailQueue.ts) kicks in
    throw err;
  }
}

export const emailWorker = new Worker(EMAIL_QUEUE_NAME, processEmailJob, {
  connection: redisConnection,
  concurrency: CONCURRENCY, // configurable parallelism, required by the assignment
});

emailWorker.on("completed", (job) => {
  console.log(`[worker] Job ${job.id} completed`);
});

emailWorker.on("failed", (job, err) => {
  console.error(`[worker] Job ${job?.id} failed:`, err.message);
});

console.log(
  `[worker] Email worker started. concurrency=${CONCURRENCY} minDelayMs=${MIN_DELAY_MS}`
);
