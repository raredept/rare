import type { Prisma, PrismaClient } from "@prisma/client";

// Sanitized audit trail for sensitive Admin actions. What goes in is decided by the caller as an
// explicit allowlist of business fields; this module also drops anything that looks like a
// credential, as a second line of defence, and caps the size of each snapshot.

type AuditClient = Pick<PrismaClient, "adminAuditLog"> | Prisma.TransactionClient;

const SENSITIVE_KEY = /secret|token|password|hash|recovery|cpf|document|card|cvv|apikey|api_key|cookie/i;
const MAX_SNAPSHOT_CHARS = 8_000;

export type AdminAuditActor = { id: string | null; label: string };

export function sanitizeAuditSnapshot(value: unknown, depth = 0): Prisma.InputJsonValue | null {
  if (value === null || value === undefined) return null;
  if (depth > 4) return "[truncated]";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 200).map((item) => sanitizeAuditSnapshot(item, depth + 1)) as Prisma.InputJsonValue;
  if (typeof value === "object") {
    const output: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(key)) continue;
      output[key] = sanitizeAuditSnapshot(item, depth + 1);
    }
    return output as Prisma.InputJsonValue;
  }
  return null;
}

function bounded(value: Prisma.InputJsonValue | null) {
  if (value === null) return undefined;
  return JSON.stringify(value).length > MAX_SNAPSHOT_CHARS ? ({ truncated: true } as Prisma.InputJsonValue) : value;
}

export async function recordAdminAudit(
  client: AuditClient,
  entry: {
    actor: AdminAuditActor;
    action: string;
    entityType: string;
    entityId?: string | null;
    before?: unknown;
    after?: unknown;
  },
) {
  await client.adminAuditLog.create({
    data: {
      actorUserId: entry.actor.id,
      actorLabel: entry.actor.label.slice(0, 120),
      action: entry.action.slice(0, 80),
      entityType: entry.entityType.slice(0, 60),
      entityId: entry.entityId ?? null,
      before: bounded(sanitizeAuditSnapshot(entry.before)),
      after: bounded(sanitizeAuditSnapshot(entry.after)),
    },
  });
}
