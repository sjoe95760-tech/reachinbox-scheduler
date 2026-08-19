import { Router } from "express";
import multer from "multer";
import { prisma } from "../db/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { enqueueEmailJob } from "../queues/emailQueue";
import { extractEmailsFromFile } from "../services/csvParser";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const DEFAULT_HOURLY_LIMIT = Number(process.env.MAX_EMAILS_PER_HOUR) || 200;
const DEFAULT_DELAY_MS = Number(process.env.MIN_DELAY_BETWEEN_EMAILS_MS) || 2000;

/**
 * POST /api/campaigns
 * multipart/form-data:
 *   - subject: string
 *   - body: string
 *   - startTime: ISO date string
 *   - delayBetweenEmailsMs?: number
 *   - hourlyLimit?: number
 *   - leadsFile: CSV/TXT file of recipient emails
 *
 * This is the "Compose New Email" -> "Schedule" action from the frontend.
 *
 * What happens:
 *  1. Parse the uploaded file into a deduped list of recipient emails.
 *  2. Create one Campaign row (the "batch").
 *  3. Create one EmailJob row per recipient, each with its own
 *     `scheduledFor` time, spaced out by `delayBetweenEmailsMs` starting
 *     from `startTime` - this is what "preserves order" under load.
 *  4. Enqueue each EmailJob as a BullMQ delayed job (idempotent via jobId).
 *  5. Assign senders round-robin across available Sender rows, so
 *     per-sender rate limits are exercised realistically.
 */
router.post(
  "/",
  requireAuth,
  upload.single("leadsFile"),
  async (req: AuthedRequest, res) => {
    try {
      const { subject, body, startTime, delayBetweenEmailsMs, hourlyLimit } =
        req.body;

      if (!subject || !body || !startTime) {
        return res
          .status(400)
          .json({ error: "subject, body, and startTime are required" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "leadsFile is required" });
      }

      const fileContent = req.file.buffer.toString("utf-8");
      const recipients = extractEmailsFromFile(fileContent);

      if (recipients.length === 0) {
        return res
          .status(400)
          .json({ error: "No valid email addresses found in the uploaded file" });
      }

      const senders = await prisma.sender.findMany();
      if (senders.length === 0) {
        return res.status(400).json({
          error:
            "No senders configured. Run the seed script to add an Ethereal sender first.",
        });
      }

      const delayMs = Number(delayBetweenEmailsMs) || DEFAULT_DELAY_MS;
      const limit = Number(hourlyLimit) || DEFAULT_HOURLY_LIMIT;
      const start = new Date(startTime);

      const campaign = await prisma.campaign.create({
        data: {
          userId: req.user!.id,
          subject,
          body,
          startTime: start,
          delayBetweenEmailsMs: delayMs,
          hourlyLimit: limit,
        },
      });

      // Create + enqueue one job per recipient. Each job's scheduled time is
      // staggered by delayMs, and senders are assigned round-robin.
      const createdJobs = [];
      for (let i = 0; i < recipients.length; i++) {
        const scheduledFor = new Date(start.getTime() + i * delayMs);
        const sender = senders[i % senders.length];

        const emailJob = await prisma.emailJob.create({
          data: {
            campaignId: campaign.id,
            senderId: sender.id,
            recipient: recipients[i],
            subject,
            body,
            status: "PENDING",
            scheduledFor,
          },
        });

        await enqueueEmailJob({
          emailJobId: emailJob.id,
          delayMs: scheduledFor.getTime() - Date.now(),
        });

        await prisma.emailJob.update({
          where: { id: emailJob.id },
          data: { status: "SCHEDULED" },
        });

        createdJobs.push(emailJob.id);
      }

      res.status(201).json({
        campaignId: campaign.id,
        recipientCount: recipients.length,
        jobIds: createdJobs,
      });
    } catch (err: any) {
      console.error("[campaigns] schedule error:", err);
      res.status(500).json({ error: "Failed to schedule campaign" });
    }
  }
);

/**
 * GET /api/campaigns/scheduled
 * Returns all EmailJobs not yet sent, for the logged-in user's campaigns.
 */
router.get("/scheduled", requireAuth, async (req: AuthedRequest, res) => {
  const jobs = await prisma.emailJob.findMany({
    where: {
      campaign: { userId: req.user!.id },
      status: { in: ["PENDING", "SCHEDULED", "RATE_LIMITED"] },
    },
    orderBy: { scheduledFor: "asc" },
    include: { campaign: { select: { subject: true } } },
  });

  res.json(
    jobs.map((j) => ({
      id: j.id,
      email: j.recipient,
      subject: j.subject,
      scheduledFor: j.scheduledFor,
      status: j.status,
    }))
  );
});

/**
 * GET /api/campaigns/sent
 * Returns all EmailJobs that have been sent or failed, for the logged-in user.
 */
router.get("/sent", requireAuth, async (req: AuthedRequest, res) => {
  const jobs = await prisma.emailJob.findMany({
    where: {
      campaign: { userId: req.user!.id },
      status: { in: ["SENT", "FAILED"] },
    },
    orderBy: { sentAt: "desc" },
  });

  res.json(
    jobs.map((j) => ({
      id: j.id,
      email: j.recipient,
      subject: j.subject,
      sentAt: j.sentAt,
      status: j.status.toLowerCase(),
    }))
  );
});

export default router;
