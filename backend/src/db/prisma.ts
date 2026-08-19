import { PrismaClient } from "@prisma/client";

// Reuse a single PrismaClient instance across the app (best practice with
// ts-node-dev hot-reloading, which otherwise creates a new client per reload
// and exhausts DB connections).
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
