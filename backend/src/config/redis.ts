import { ConnectionOptions } from "bullmq";
import dotenv from "dotenv";

dotenv.config();

// BullMQ requires this exact connection shape. Both the API (which enqueues
// jobs) and the worker (which processes them) import this same config so
// they always point at the same Redis instance.
export const redisConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null, // required by BullMQ for blocking connections
};
