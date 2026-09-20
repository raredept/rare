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

let client: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  if (!client) {
    client = createPrismaClient();
    // Keep one client across dev hot reloads; production keeps the module singleton.
    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  }
  return client;
}

/**
 * The client is built on first use, not on import.
 *
 * `next build` collects page data by importing every route module. Eager
 * construction made that import read DATABASE_URL, so a build needed database
 * credentials even though every page here is dynamic and queries nothing at
 * build time. Connecting still happens on the first query, so a missing or
 * invalid URL fails exactly where it is used, with the same error as before.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const instance = getPrismaClient();
    const value = Reflect.get(instance, property) as unknown;
    return typeof value === "function" ? value.bind(instance) : value;
  },
  set(_target, property, value) {
    return Reflect.set(getPrismaClient(), property, value);
  },
  has(_target, property) {
    return Reflect.has(getPrismaClient(), property);
  },
});
