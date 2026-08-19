
# ReachInbox Scheduler

A full-stack email job scheduler: schedule bulk emails via a dashboard, send them at the right time using BullMQ delayed jobs (no cron), survive server restarts, and enforce configurable rate limits.

---

## Tech Stack

- **Backend:** TypeScript, Express, BullMQ + Redis, PostgreSQL (Prisma ORM), Nodemailer + Ethereal
- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, Google OAuth
- **Infra:** Docker Compose (Redis + Postgres)

---

## Prerequisites

- Node.js 18+
- Docker Desktop
- A free Ethereal Email account (https://ethereal.email/create) for test SMTP
- A Google OAuth Client ID (from Google Cloud Console)

---

## Setup

### 1. Start Redis + Postgres

docker compose up -d


### 2. Backend

cd backend
npm install
cp .env.example .env


Edit `.env` and fill in:
- ETHEREAL_SMTP_USER / ETHEREAL_SMTP_PASS - from https://ethereal.email/create
- GOOGLE_CLIENT_ID - from Google Cloud Console
- JWT_SECRET - any long random string

Run the database migration and seed a test sender:

npx prisma migrate dev --name init
npm run seed:sender


Start the API server and the worker in two separate terminals:

npm run dev
npm run worker


API server runs on http://localhost:4000

### 3. Frontend

cd frontend
npm install


Create `frontend/.env.local` with:

NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com


Start it:

npm run dev


Runs on http://localhost:3000

---

## Architecture Overview

### How scheduling works (no cron)

Every recipient in an uploaded CSV becomes one EmailJob row in Postgres, with its own scheduledFor timestamp. Each job is enqueued in BullMQ as a delayed job, using the job's own database ID as the BullMQ jobId.

BullMQ stores delayed jobs in Redis itself, not in application memory, so scheduling is durable by construction. The API process does not need to stay alive for jobs to eventually fire.

### How persistence on restart is handled

- Redis is the source of truth for when a job should run. Restarting the API server or the worker does not lose or re-trigger anything, because job data lives in Redis, not in a JS timer.
- Idempotency: each EmailJob's database ID is reused as the BullMQ jobId. BullMQ guarantees uniqueness per jobId within a queue, so re-running scheduling logic can never create a duplicate job for the same email.
- The worker also checks the email's status in Postgres before sending (status equal to SENT means skip), as a second guard against double-sends.
- This was manually tested: a job was scheduled, the worker process was killed mid-wait, then restarted. The job still fired exactly once at its scheduled time.

### How rate limiting and concurrency are implemented

- Concurrency: the BullMQ Worker is configured with a concurrency option (WORKER_CONCURRENCY env var, default 5), controlling how many jobs run in parallel.
- Minimum delay between sends: enforced inside the worker with a timeout before each send (MIN_DELAY_BETWEEN_EMAILS_MS, default 2000ms). This holds even under concurrency greater than 1.
- Hourly rate limit: implemented with a Redis INCR counter keyed by hour-window plus sender ID for per-sender limits. INCR is atomic, so this is safe even with multiple worker processes running concurrently.
- The key's TTL auto-expires after the hour window passes, so no manual cleanup job is needed.
- When a job would exceed the hourly limit, it is not dropped or failed. Its status is set to RATE_LIMITED and it is re-enqueued as a new delayed job targeting the start of the next hour window.

### Behavior under load (1000+ emails scheduled at once)

- The scheduling endpoint creates all EmailJob rows in a loop and enqueues each individually, staggering scheduledFor by delayBetweenEmailsMs per recipient, so even a burst of requests results in evenly spaced actual send times.
- If the hourly cap is reached partway through, excess jobs are deferred to later hour windows automatically rather than erroring out.

---

## Features Implemented

**Backend**
- Email scheduling API (multipart form: subject, body, CSV upload, start time, delay, hourly limit)
- BullMQ delayed jobs, no cron
- Restart-safe persistence (Redis-backed queue plus idempotent jobIds)
- Configurable worker concurrency
- Configurable minimum delay between sends
- Configurable, Redis-backed hourly rate limiting (global or per-sender)
- Google OAuth login (real, via google-auth-library token verification)
- Ethereal SMTP sending via Nodemailer
- Scheduled and Sent email listing endpoints

**Frontend**
- Real Google OAuth login (redirects to dashboard on success)
- Header with user name, email, avatar, logout
- Scheduled Emails and Sent Emails tabs
- Compose modal: subject, body, CSV upload with detected-recipient-count preview, start time, delay, hourly limit
- Tables with loading states and empty states
- Basic error handling on failed requests

---

## Assumptions and Trade-offs

- A single Ethereal sender is seeded by default. The schema supports multiple senders (round-robin assignment plus per-sender rate limits), but only one was configured for local testing.
- The frontend CSV recipient count is a client-side preview only. The backend performs the authoritative parse and is the source of truth for which addresses actually get scheduled.
- No production deployment was set up. This is configured for local development only (localhost origins for Google OAuth and CORS).
