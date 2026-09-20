import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalDatabaseUrl = process.env.DATABASE_URL;

function freshPrismaModule() {
  vi.resetModules();
  return import("@/lib/prisma");
}

beforeEach(() => {
  delete (globalThis as { prisma?: unknown }).prisma;
});

afterEach(() => {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
  delete (globalThis as { prisma?: unknown }).prisma;
});

describe("prisma client construction", () => {
  it("imports without DATABASE_URL so `next build` can collect page data", async () => {
    delete process.env.DATABASE_URL;
    await expect(freshPrismaModule()).resolves.toBeDefined();
  });

  it("still reports the missing URL when the client is actually used", async () => {
    delete process.env.DATABASE_URL;
    const { prisma } = await freshPrismaModule();
    expect(() => prisma.order).toThrowError("DATABASE_URL is required.");
  });

  it("builds a usable client once DATABASE_URL is configured", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/rare";
    const { prisma } = await freshPrismaModule();
    expect(typeof prisma.$transaction).toBe("function");
    expect(prisma.order).toBeDefined();
  });

  it("reuses a single client across property reads", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/rare";
    const { getPrismaClient } = await freshPrismaModule();
    expect(getPrismaClient()).toBe(getPrismaClient());
  });
});
