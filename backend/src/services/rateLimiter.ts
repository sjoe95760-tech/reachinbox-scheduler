import Redis from "ioredis";
import { redisConnection } from "../config/redis";

const redis = new Redis(redisConnection as any);

/**
 * Rate limiting strategy
 * ------------------------------------------------------------------
 * We use a Redis INCR counter keyed by "hour window" (+ optional sender),
 * e.g.  ratelimit:email:2026-08-18T14
 *
 * Why Redis INCR instead of counting rows in Postgres or an in-memory
 * variable:
 *  - INCR is atomic. If 5 worker processes call this at the exact same
 *    millisecond, Redis still serializes the increments correctly - no
 *    race condition, no double counting. An in-memory counter would be
 *    wrong the moment you run more than one worker process/instance.
 *  - The key naturally expires (TTL) after the hour window passes, so we
 *    don't need a cleanup job.
 *
 * When the limit for the current hour is reached, we do NOT fail the job.
 * The worker instead re-schedules (re-enqueues) the job for the start of
 * the NEXT hour window, preserving its position by keeping emails roughly
 * in original order (see emailWorker.ts).
 */

function hourWindowKey(date: Date, senderId?: string) {
  const iso = date.toISOString().slice(0, 13); // "2026-08-18T14"
  return senderId
    ? `ratelimit:email:sender:${senderId}:${iso}`
    : `ratelimit:email:global:${iso}`;
}

export async function tryConsumeRateLimit(params: {
  senderId?: string;
  maxPerHour: number;
  now?: Date;
}): Promise<{ allowed: boolean; currentCount: number }> {
  const { senderId, maxPerHour, now = new Date() } = params;

  const key = hourWindowKey(now, senderId);

  // INCR returns the value AFTER incrementing, atomically.
  const count = await redis.incr(key);

  if (count === 1) {
    // first increment in this window -> set expiry so key auto-cleans
    await redis.expire(key, 3600 + 60); // hour + small buffer
  }

  if (count > maxPerHour) {
    // We already incremented, but we're over budget - roll back so the
    // slot is free for someone else / for retry accounting to stay accurate.
    await redis.decr(key);
    return { allowed: false, currentCount: count - 1 };
  }

  return { allowed: true, currentCount: count };
}

/** Returns a Date at the start of the next hour window from `from`. */
export function nextHourWindowStart(from: Date = new Date()): Date {
  const next = new Date(from);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next;
}

export { redis as rateLimitRedisClient };
