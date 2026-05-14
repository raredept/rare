import "dotenv/config";
import { hashSync } from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getDatabaseUrl, isProductionEnv } from "../src/lib/env";

const email = process.env.ADMIN_EMAIL ?? "";
const password = process.env.ADMIN_PASSWORD ?? "";

const blockedPasswords = new Set(["change-me-before-production", "change-me", "password", "admin123", "12345678"]);

function validateAdminInput() {
  if (!email || !password) throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
  if (password.length < 8) throw new Error("ADMIN_PASSWORD must have at least 8 characters.");

  if (blockedPasswords.has(password.toLowerCase())) {
    throw new Error("ADMIN_PASSWORD is a placeholder or weak default.");
  }

  if (isProductionEnv()) {
    if (process.env.CONFIRM_PRODUCTION_ADMIN !== "true") {
      throw new Error("Set CONFIRM_PRODUCTION_ADMIN=true to create or update an admin in production.");
    }

    if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      throw new Error("Production ADMIN_PASSWORD must have at least 12 characters, uppercase, lowercase and number.");
    }
  }
}

validateAdminInput();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: getDatabaseUrl() }),
});

async function main() {
  const passwordHash = hashSync(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      active: true,
      role: "ADMIN",
    },
    create: {
      name: "Administrador",
      email,
      passwordHash,
      role: "ADMIN",
      active: true,
    },
  });

  console.log(`Admin user ready: ${email}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : "Admin creation failed.");
    await prisma.$disconnect();
    process.exit(1);
  });
