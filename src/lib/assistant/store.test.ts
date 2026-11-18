import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  config: { findUnique: vi.fn() },
  entry: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { virtualAssistantConfig: mocks.config, virtualAssistantEntry: mocks.entry },
}));

import {
  ASSISTANT_CACHE_TTL_MS,
  getPublicAssistantBootstrap,
  getPublicAssistantSnapshot,
  invalidateAssistantCache,
  readAssistantConfig,
  readPublicAssistantSnapshot,
  resetAssistantCacheForTests,
} from "@/lib/assistant/store";
import { DEFAULT_ASSISTANT_CONFIG } from "@/lib/assistant/config";

const row = { id: "store", ...DEFAULT_ASSISTANT_CONFIG, enabled: true, createdAt: new Date(), updatedAt: new Date() };
const entries = Array.from({ length: 6 }, (_, index) => ({
  id: `e${index}`,
  question: `Pergunta ${index}?`,
  answer: `Resposta secreta ${index}`,
  category: null,
  keywords: [`kw${index}`],
  priority: 10 - index,
  sortOrder: index,
}));

beforeEach(() => {
  vi.clearAllMocks();
  resetAssistantCacheForTests();
  mocks.config.findUnique.mockResolvedValue(row);
  mocks.entry.findMany.mockResolvedValue(entries);
});

describe("assistant store", () => {
  it("uses the disabled defaults when no configuration row exists (fresh production)", async () => {
    mocks.config.findUnique.mockResolvedValue(null);
    expect(await readAssistantConfig()).toEqual(DEFAULT_ASSISTANT_CONFIG);
    expect(await getPublicAssistantBootstrap()).toBeNull();
    // A disabled assistant does not even read the entries.
    expect(mocks.entry.findMany).not.toHaveBeenCalled();
  });

  it("gives the widget copy and at most 4 suggestions, never answers, keywords or ids", async () => {
    const bootstrap = await getPublicAssistantBootstrap();
    expect(bootstrap).toEqual({
      displayName: "Assistente RARE",
      welcomeMessage: DEFAULT_ASSISTANT_CONFIG.welcomeMessage,
      inputPlaceholder: DEFAULT_ASSISTANT_CONFIG.inputPlaceholder,
      suggestions: ["Pergunta 0?", "Pergunta 1?", "Pergunta 2?", "Pergunta 3?"],
    });
    expect(JSON.stringify(bootstrap)).not.toMatch(/secreta|kw0|"e0"/);
  });

  it("only reads active entries, ordered by priority then sort order", async () => {
    await getPublicAssistantSnapshot();
    expect(mocks.entry.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { active: true },
      orderBy: [{ priority: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    }));
  });

  it("caches briefly and an Admin mutation (invalidate) is visible immediately", async () => {
    const start = Date.now();
    await getPublicAssistantSnapshot(start);
    await getPublicAssistantSnapshot(start + 1_000);
    expect(mocks.config.findUnique).toHaveBeenCalledTimes(1);
    invalidateAssistantCache();
    await getPublicAssistantSnapshot(start + 1_500);
    expect(mocks.config.findUnique).toHaveBeenCalledTimes(2);
  });

  it("expires the cache after the TTL so other instances converge", async () => {
    const start = Date.now();
    await getPublicAssistantSnapshot(start);
    await getPublicAssistantSnapshot(start + ASSISTANT_CACHE_TTL_MS + 1_000);
    expect(mocks.config.findUnique).toHaveBeenCalledTimes(2);
  });

  it("never caches a failure and never breaks the storefront (bootstrap resolves to null)", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.config.findUnique.mockRejectedValueOnce(new Error("db down"));
    expect(await getPublicAssistantBootstrap()).toBeNull();
    expect(error).toHaveBeenCalledWith("[assistant] bootstrap unavailable", "Error");
    expect(await getPublicAssistantBootstrap()).not.toBeNull();
    error.mockRestore();
  });

  it("the public endpoint read is never cached (an Admin change applies to the next question)", async () => {
    await readPublicAssistantSnapshot();
    await readPublicAssistantSnapshot();
    expect(mocks.config.findUnique).toHaveBeenCalledTimes(2);
  });
});
