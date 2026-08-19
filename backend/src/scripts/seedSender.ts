import dotenv from "dotenv";
dotenv.config();
import { prisma } from "../db/prisma";

/**
 * Run with: npx ts-node src/scripts/seedSender.ts
 *
 * Creates a Sender row in the DB using the Ethereal credentials from your
 * .env file, so campaigns have something to send through. Get free Ethereal
 * credentials instantly at https://ethereal.email/create - no signup needed.
 */
async function main() {
  const host = process.env.ETHEREAL_SMTP_HOST;
  const port = Number(process.env.ETHEREAL_SMTP_PORT);
  const user = process.env.ETHEREAL_SMTP_USER;
  const pass = process.env.ETHEREAL_SMTP_PASS;

  if (!host || !port || !user || !pass) {
    console.error(
      "Missing Ethereal SMTP env vars. Set ETHEREAL_SMTP_HOST/PORT/USER/PASS in .env first."
    );
    process.exit(1);
  }

  const existing = await prisma.sender.findFirst({ where: { smtpUser: user } });
  if (existing) {
    console.log(`Sender already exists: ${existing.name} (${existing.id})`);
    return;
  }

  const sender = await prisma.sender.create({
    data: {
      name: "Primary Ethereal Sender",
      smtpHost: host,
      smtpPort: port,
      smtpUser: user,
      smtpPass: pass,
    },
  });

  console.log(`Created sender: ${sender.name} (${sender.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
