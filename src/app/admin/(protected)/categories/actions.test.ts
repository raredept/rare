import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  prisma: {
    category: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1" }) }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ name: "Camisetas", slug: "camisetas", sortOrder: "1", active: "on", ...fields })) data.set(key, value);
  return data;
}

function slugOwnedBy(ownerId: string | null) {
  mocks.prisma.category.findUnique.mockImplementation(async ({ where }: { where: { id?: string; slug?: string } }) =>
    where.slug ? (ownerId ? { id: ownerId } : null) : { slug: "camisetas" },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.category.create.mockResolvedValue({ id: "cat-new", slug: "camisetas" });
  mocks.prisma.category.update.mockResolvedValue({ id: "cat-1", slug: "camisetas" });
});

describe("saveCategoryAction slug collisions (regression: crashed the Admin)", () => {
  it("rejects creating a category whose slug is taken", async () => {
    slugOwnedBy("cat-other");
    const { saveCategoryAction } = await import("@/app/admin/(protected)/categories/actions");
    await expect(saveCategoryAction(form({}))).rejects.toThrow("NEXT_REDIRECT:");
    expect(mocks.redirect.mock.calls.at(-1)?.[0]).toMatch(/^\/admin\/categories\?error=category-slug-taken/);
    expect(mocks.prisma.category.create).not.toHaveBeenCalled();
  });

  it("rejects renaming onto another category's slug", async () => {
    slugOwnedBy("cat-2");
    const { saveCategoryAction } = await import("@/app/admin/(protected)/categories/actions");
    await expect(saveCategoryAction(form({ id: "cat-1" }))).rejects.toThrow("NEXT_REDIRECT:");
    expect(mocks.redirect.mock.calls.at(-1)?.[0]).toMatch(/^\/admin\/categories\/cat-1\/edit\?error=category-slug-taken/);
    expect(mocks.prisma.category.update).not.toHaveBeenCalled();
  });

  it("lets a category keep its own slug", async () => {
    slugOwnedBy("cat-1");
    const { saveCategoryAction } = await import("@/app/admin/(protected)/categories/actions");
    await expect(saveCategoryAction(form({ id: "cat-1" }))).rejects.toThrow("NEXT_REDIRECT:");
    expect(mocks.redirect.mock.calls.at(-1)?.[0]).toContain("success=category-saved");
  });

  it("maps a slug race lost at write time to the same code", async () => {
    slugOwnedBy(null);
    const { Prisma } = await import("@prisma/client");
    mocks.prisma.category.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`slug`)", { code: "P2002", clientVersion: "test" }),
    );
    const { saveCategoryAction } = await import("@/app/admin/(protected)/categories/actions");
    await expect(saveCategoryAction(form({}))).rejects.toThrow("NEXT_REDIRECT:");
    expect(mocks.redirect.mock.calls.at(-1)?.[0]).toContain("error=category-slug-taken");
  });
});
