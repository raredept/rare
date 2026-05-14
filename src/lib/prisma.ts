import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getDatabaseUrl } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const connectionString = getDatabaseUrl();
  const statementPrefix = randomUUID().replaceAll("-", "").slice(0, 12);
  let statementCounter = 0;
  const adapter = new PrismaPg(
    { connectionString },
    {
      statementNameGenerator() {
        statementCounter += 1;
        return `rare_${process.pid}_${statementPrefix}_${statementCounter}`;
      },
    },
  );
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
