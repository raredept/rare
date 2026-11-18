import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    virtualAssistantConfig: { findUnique: vi.fn(), upsert: vi.fn() },
    virtualAssistantEntry: { count: vi.fn(), create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    adminAuditLog: { create: vi.fn() },
  };
  return {
    tx,
    requireAdmin: vi.fn(),
    revalidatePath: vi.fn(),
    redirect: vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    }),
    prisma: { ...tx, $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) },
  };
});

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

import {
  createAssistantEntryAction,
  previewAssistantAction,
  saveAssistantConfigAction,
  setAssistantEntryActiveAction,
  updateAssistantEntryAction,
} from "@/app/admin/(protected)/assistant/actions";
import { DEFAULT_ASSISTANT_CONFIG } from "@/lib/assistant/config";

const admin = { id: "sys-1", username: "sistema", email: "sistema@rare.test", role: "SYSTEM_ADMIN" };
const updatedAt = new Date("2026-11-18T12:00:00.000Z");

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const entryForm = {
  question: "Qual o prazo de entrega?",
  answer: "Até 7 dias úteis.",
  category: "Entrega",
  keywords: "entrega, prazo\nchegar",
  priority: "3",
  sortOrder: "1",
  active: "on",
};

const configForm = {
  enabled: "on",
  displayName: "Assistente RARE",
  welcomeMessage: "Oi!",
  inputPlaceholder: "Digite",
  fallbackMessage: "Não encontrei.",
  supportCtaLabel: "Falar com a equipe",
  supportCtaHref: "/suporte",
};

async function redirectOf(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    return (error as Error).message.replace(/refresh=\d+/, "refresh=N");
  }
  return "NO_REDIRECT";
}

function auditCalls() {
  return mocks.tx.adminAuditLog.create.mock.calls.map(([argument]) => argument.data);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue(admin);
  mocks.tx.virtualAssistantConfig.findUnique.mockResolvedValue(null);
  mocks.tx.virtualAssistantEntry.count.mockResolvedValue(2);
  mocks.tx.virtualAssistantEntry.create.mockResolvedValue({ id: "entry-1" });
  mocks.tx.virtualAssistantEntry.findUnique.mockResolvedValue({ id: "entry-1", ...entryForm, keywords: ["entrega"], category: "Entrega", active: true, priority: 3, sortOrder: 1, updatedAt });
  mocks.tx.virtualAssistantEntry.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.virtualAssistantEntry.findMany.mockResolvedValue([]);
});

describe("assistant actions: authorization", () => {
  const denied = () => mocks.requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT:/admin/sem-acesso"));

  it.each([
    ["saveAssistantConfigAction", () => saveAssistantConfigAction(form(configForm))],
    ["createAssistantEntryAction", () => createAssistantEntryAction(form(entryForm))],
    ["updateAssistantEntryAction", () => updateAssistantEntryAction(form({ ...entryForm, id: "entry-1" }))],
    ["setAssistantEntryActiveAction", () => setAssistantEntryActiveAction(form({ id: "entry-1", active: "false" }))],
    ["previewAssistantAction", () => previewAssistantAction({ status: "idle" }, form({ question: "prazo" }))],
  ])("%s demands system.assistant and touches nothing when denied (SELLER_ADMIN / legacy ADMIN)", async (_name, run) => {
    denied();
    expect(await redirectOf(run)).toBe("NEXT_REDIRECT:/admin/sem-acesso");
    expect(mocks.requireAdmin).toHaveBeenCalledWith("system.assistant");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    for (const delegate of [mocks.tx.virtualAssistantConfig, mocks.tx.virtualAssistantEntry, mocks.tx.adminAuditLog]) {
      for (const fn of Object.values(delegate)) expect(fn).not.toHaveBeenCalled();
    }
  });
});

describe("saveAssistantConfigAction", () => {
  it("saves, audits business fields only and refreshes the storefront", async () => {
    expect(await redirectOf(() => saveAssistantConfigAction(form(configForm)))).toBe(
      "NEXT_REDIRECT:/admin/assistant?success=assistant-config-saved&refresh=N#configuracao",
    );
    expect(mocks.tx.virtualAssistantConfig.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "store" } }));
    const [audit] = auditCalls();
    expect(audit).toMatchObject({ action: "assistant.config_updated", entityType: "VirtualAssistantConfig", entityId: "store", actorUserId: "sys-1" });
    expect(audit.before).toMatchObject({ enabled: false, displayName: DEFAULT_ASSISTANT_CONFIG.displayName });
    expect(audit.after).toMatchObject({ enabled: true, supportCtaHref: "/suporte" });
    expect(JSON.stringify(audit)).not.toMatch(/session|cookie|token|password/i);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("refuses to enable the assistant with no active answer", async () => {
    mocks.tx.virtualAssistantEntry.count.mockResolvedValue(0);
    expect(await redirectOf(() => saveAssistantConfigAction(form(configForm)))).toContain("error=assistant-enable-empty");
    expect(mocks.tx.virtualAssistantConfig.upsert).not.toHaveBeenCalled();
  });

  it("can save a disabled assistant with no answers", async () => {
    mocks.tx.virtualAssistantEntry.count.mockResolvedValue(0);
    const disabled: Record<string, string> = { ...configForm };
    delete disabled.enabled;
    expect(await redirectOf(() => saveAssistantConfigAction(form(disabled)))).toContain("success=assistant-config-saved");
    expect(mocks.tx.virtualAssistantConfig.upsert.mock.calls[0][0].update.enabled).toBe(false);
  });

  it.each(["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "http://evil.example", "//evil.example"])("refuses the support link %s", async (href) => {
    expect(await redirectOf(() => saveAssistantConfigAction(form({ ...configForm, supportCtaHref: href })))).toContain("error=assistant-href-invalid");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses fields over their limits", async () => {
    expect(await redirectOf(() => saveAssistantConfigAction(form({ ...configForm, displayName: "x".repeat(81) })))).toContain("error=assistant-validation");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("entry actions", () => {
  it("creates an entry with normalised keywords, the author and an audit entry", async () => {
    expect(await redirectOf(() => createAssistantEntryAction(form(entryForm)))).toContain("success=assistant-entry-created");
    expect(mocks.tx.virtualAssistantEntry.create).toHaveBeenCalledWith({
      data: {
        question: "Qual o prazo de entrega?",
        answer: "Até 7 dias úteis.",
        category: "Entrega",
        keywords: ["entrega", "prazo", "chegar"],
        active: true,
        priority: 3,
        sortOrder: 1,
        createdById: "sys-1",
        updatedById: "sys-1",
      },
      select: { id: true },
    });
    expect(auditCalls()[0]).toMatchObject({ action: "assistant.entry_created", entityType: "VirtualAssistantEntry", entityId: "entry-1" });
    expect(Object.keys(auditCalls()[0].after).sort()).toEqual(["active", "answer", "category", "keywords", "priority", "question", "sortOrder"]);
  });

  it.each([
    ["priority over 10", { priority: "11" }],
    ["non-numeric priority", { priority: "alta" }],
    ["empty answer", { answer: " " }],
    ["31 keywords", { keywords: Array.from({ length: 31 }, (_, index) => `palavra${index}`).join(",") }],
  ])("refuses %s", async (_label, override) => {
    expect(await redirectOf(() => createAssistantEntryAction(form({ ...entryForm, ...override })))).toContain("error=assistant-entry-invalid");
    expect(mocks.tx.virtualAssistantEntry.create).not.toHaveBeenCalled();
  });

  it("updates with optimistic concurrency and audits before/after", async () => {
    const result = await redirectOf(() => updateAssistantEntryAction(form({ ...entryForm, id: "entry-1", version: updatedAt.toISOString(), answer: "Novo texto." })));
    expect(result).toContain("success=assistant-entry-saved");
    expect(mocks.tx.virtualAssistantEntry.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "entry-1", updatedAt } }));
    expect(auditCalls()[0]).toMatchObject({ action: "assistant.entry_updated", before: expect.objectContaining({ answer: "Até 7 dias úteis." }), after: expect.objectContaining({ answer: "Novo texto." }) });
  });

  it("refuses a stale edit (another tab saved first)", async () => {
    const result = await redirectOf(() => updateAssistantEntryAction(form({ ...entryForm, id: "entry-1", version: "2026-01-01T00:00:00.000Z" })));
    expect(result).toContain("error=assistant-entry-conflict");
    expect(mocks.tx.virtualAssistantEntry.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it("reports a missing entry", async () => {
    mocks.tx.virtualAssistantEntry.findUnique.mockResolvedValue(null);
    expect(await redirectOf(() => updateAssistantEntryAction(form({ ...entryForm, id: "nope" })))).toContain("error=assistant-entry-not-found");
  });

  it("deactivates (never deletes) and audits the transition", async () => {
    expect(await redirectOf(() => setAssistantEntryActiveAction(form({ id: "entry-1", active: "false" })))).toContain("success=assistant-entry-deactivated");
    expect(mocks.tx.virtualAssistantEntry.update).toHaveBeenCalledWith({ where: { id: "entry-1" }, data: { active: false, updatedById: "sys-1" } });
    expect(auditCalls()[0]).toMatchObject({ action: "assistant.entry_deactivated", before: { active: true }, after: { active: false } });
  });

  it("activates and audits", async () => {
    mocks.tx.virtualAssistantEntry.findUnique.mockResolvedValue({ active: false });
    expect(await redirectOf(() => setAssistantEntryActiveAction(form({ id: "entry-1", active: "true" })))).toContain("success=assistant-entry-activated");
    expect(auditCalls()[0]).toMatchObject({ action: "assistant.entry_activated" });
  });
});

describe("previewAssistantAction", () => {
  it("uses the storefront engine on fresh data and returns score/entry for the Admin only, writing nothing", async () => {
    mocks.tx.virtualAssistantEntry.findMany.mockResolvedValue([
      { id: "entry-1", question: "Qual o prazo de entrega?", answer: "Até 7 dias úteis.", category: "Entrega", keywords: ["entrega", "chegar", "demora"], priority: 0, sortOrder: 0 },
    ]);
    const state = await previewAssistantAction({ status: "idle" }, form({ question: "quanto tempo demora pra chegar" }));
    expect(state).toMatchObject({ status: "done", fallback: false, answer: "Até 7 dias úteis.", entry: { id: "entry-1" }, enabled: false, activeEntries: 1 });
    if (state.status === "done") expect(state.confidence).toBeGreaterThanOrEqual(0.5);
    const fallback = await previewAssistantAction({ status: "idle" }, form({ question: "receita de bolo" }));
    expect(fallback).toMatchObject({ status: "done", fallback: true, answer: DEFAULT_ASSISTANT_CONFIG.fallbackMessage, cta: { href: "/suporte" } });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it("validates the test question", async () => {
    expect(await previewAssistantAction({ status: "idle" }, form({ question: "  " }))).toMatchObject({ status: "invalid" });
    expect(await previewAssistantAction({ status: "idle" }, form({ question: "x".repeat(501) }))).toMatchObject({ status: "invalid" });
  });
});
