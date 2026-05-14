import { NextResponse } from "next/server";
import packageJson from "../../../../package.json";
import { validateEnvironment } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HealthStatus = "ok" | "degraded" | "error";

function response(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET() {
  const env = validateEnvironment();
  let database: { ok: boolean; message: string } = { ok: false, message: "Database check was not executed." };

  if (env.errors.some((issue) => issue.variable === "DATABASE_URL")) {
    database = { ok: false, message: "Database is not configured." };
  } else {
    try {
      const { prisma } = await import("@/lib/prisma");
      await prisma.$queryRaw`SELECT 1`;
      database = { ok: true, message: "Database connection ok." };
    } catch {
      database = { ok: false, message: "Database connection failed." };
    }
  }

  const status: HealthStatus = env.ok && database.ok ? "ok" : database.ok ? "degraded" : "error";
  const httpStatus = status === "ok" ? 200 : 503;

  return response(
    {
      status,
      app: {
        ok: true,
        name: packageJson.name,
        version: packageJson.version,
      },
      database,
      environment: {
        nodeEnv: env.nodeEnv,
        checkoutEnabled: env.checkoutEnabled,
        storageDriver: env.storageDriver,
      },
      configuration: {
        ok: env.ok,
        errors: env.errors.map((issue) => ({ variable: issue.variable, message: issue.message })),
        warnings: env.warnings.map((issue) => ({ variable: issue.variable, message: issue.message })),
      },
      timestamp: new Date().toISOString(),
    },
    httpStatus,
  );
}
