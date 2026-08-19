import dotenv from "dotenv";
dotenv.config();
import jwt from "jsonwebtoken";
import { prisma } from "../db/prisma";

async function main() {
  const user = await prisma.user.upsert({
    where: { googleId: "test-google-id-123" },
    update: {},
    create: {
      googleId: "test-google-id-123",
      email: "test.user@example.com",
      name: "Test User",
    },
  });

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET as string,
    { expiresIn: "30d" }
  );

  console.log("\n=== Test user ready ===");
  console.log("User ID:", user.id);
  console.log("Email:", user.email);
  console.log("\nUse this as your Postman Bearer token:\n");
  console.log(token);
  console.log("\n========================\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());