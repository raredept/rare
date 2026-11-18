import { ASSISTANT_LIMITS, DEFAULT_ASSISTANT_CONFIG, type AssistantConfigValues } from "@/lib/assistant/config";
import type { AssistantMatchEntry } from "@/lib/assistant/matching";
import { prisma } from "@/lib/prisma";

// RARE Assistant — database access. Reads only what the Admin wrote; nothing a shopper types is
// ever written here (no table, no log, no analytics).
//
// A short in-process cache keeps the storefront layout and the public endpoint from querying on
// every request. Every Admin mutation clears it in the instance that served the mutation, and any
// other instance converges within ASSISTANT_CACHE_TTL_MS, so a saved answer is never stale for
// long. Errors are never cached.

export const ASSISTANT_CACHE_TTL_MS = 15_000;

export type PublicAssistantEntry = AssistantMatchEntry;

export type PublicAssistantSnapshot = {
  config: AssistantConfigValues;
  entries: PublicAssistantEntry[];
};

/** What the storefront widget needs to render: copy and suggested questions (no answers, keywords or ids). */
export type PublicAssistantBootstrap = {
  displayName: string;
  welcomeMessage: string;
  inputPlaceholder: string;
  suggestions: string[];
};

type CacheSlot = { value: PublicAssistantSnapshot; expiresAt: number };
let cache: CacheSlot | null = null;
let inflight: Promise<PublicAssistantSnapshot> | null = null;

export function invalidateAssistantCache() {
  cache = null;
  inflight = null;
}

export async function readAssistantConfig(client: Pick<typeof prisma, "virtualAssistantConfig"> = prisma): Promise<AssistantConfigValues> {
  const row = await client.virtualAssistantConfig.findUnique({ where: { id: "store" } });
  if (!row) return { ...DEFAULT_ASSISTANT_CONFIG };
  return {
    enabled: row.enabled,
    displayName: row.displayName,
    welcomeMessage: row.welcomeMessage,
    inputPlaceholder: row.inputPlaceholder,
    fallbackMessage: row.fallbackMessage,
    supportCtaLabel: row.supportCtaLabel,
    supportCtaHref: row.supportCtaHref,
  };
}

/** Active entries in the order the Admin chose (priority first, then sort order, then age). */
export async function readActiveAssistantEntries(client: Pick<typeof prisma, "virtualAssistantEntry"> = prisma): Promise<PublicAssistantEntry[]> {
  return client.virtualAssistantEntry.findMany({
    where: { active: true },
    orderBy: [{ priority: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: { id: true, question: true, answer: true, category: true, keywords: true, priority: true, sortOrder: true },
    take: 500,
  });
}

async function loadSnapshot(): Promise<PublicAssistantSnapshot> {
  const config = await readAssistantConfig();
  // A disabled assistant needs no entries at all on the storefront.
  const entries = config.enabled ? await readActiveAssistantEntries() : [];
  return { config, entries };
}

/** Cached view for the storefront and the public endpoint. Throws on database failure. */
export async function getPublicAssistantSnapshot(now = Date.now()): Promise<PublicAssistantSnapshot> {
  if (cache && cache.expiresAt > now) return cache.value;
  if (inflight) return inflight;
  // Concurrent callers share one query. The slot is cleared in the same reaction that fills (or
  // fails) it, so a caller arriving right after never receives a settled, older promise.
  const pending: Promise<PublicAssistantSnapshot> = loadSnapshot().then(
    (value) => {
      if (inflight === pending) {
        cache = { value, expiresAt: Date.now() + ASSISTANT_CACHE_TTL_MS };
        inflight = null;
      }
      return value;
    },
    (error: unknown) => {
      if (inflight === pending) inflight = null;
      throw error;
    },
  );
  inflight = pending;
  return pending;
}

export function toPublicAssistantBootstrap(snapshot: PublicAssistantSnapshot): PublicAssistantBootstrap | null {
  if (!snapshot.config.enabled) return null;
  return {
    displayName: snapshot.config.displayName,
    welcomeMessage: snapshot.config.welcomeMessage,
    inputPlaceholder: snapshot.config.inputPlaceholder,
    suggestions: snapshot.entries.slice(0, ASSISTANT_LIMITS.suggestions).map((entry) => entry.question),
  };
}

/**
 * For the store layout: the widget's props, or null when the assistant is off or anything fails.
 * The storefront never fails because of the assistant.
 */
export async function getPublicAssistantBootstrap(): Promise<PublicAssistantBootstrap | null> {
  try {
    return toPublicAssistantBootstrap(await getPublicAssistantSnapshot());
  } catch (error) {
    console.error("[assistant] bootstrap unavailable", error instanceof Error ? error.name : "unknown");
    return null;
  }
}

export function resetAssistantCacheForTests() {
  invalidateAssistantCache();
}
