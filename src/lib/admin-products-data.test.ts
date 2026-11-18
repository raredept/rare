import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminProductRows } from "@/lib/admin-products-data";

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), queryRaw: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { product: { findMany: mocks.findMany }, $queryRaw: mocks.queryRaw } }));

beforeEach(() => { vi.clearAllMocks(); mocks.findMany.mockResolvedValue([]); });

describe("bounded Admin product queries", () => {
  it("combines search and category instead of overwriting the search OR", async () => {
    await getAdminProductRows({ page: 3, query: "camiseta", category: "cat-1", status: "active" });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 49, take: 27,
      where: {
        active: true,
        AND: [{ OR: [
          { title: { contains: "camiseta", mode: "insensitive" } },
          { brand: { contains: "camiseta", mode: "insensitive" } },
          { variants: { some: { sku: { contains: "CAMISETA" } } } },
        ] }],
        OR: [{ categoryId: "cat-1" }, { subcategoryId: "cat-1" }],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }, { id: "asc" }],
    }));
  });

  it("detects the next page without returning the probe row", async () => {
    mocks.findMany.mockResolvedValue(Array.from({ length: 26 }, (_, i) => ({ id: String(i) })));
    const result = await getAdminProductRows({ page: 1 });
    expect(result.products).toHaveLength(25);
    expect(result.hasNextPage).toBe(true);
  });

  it("filters sellable stock before pagination and parameterizes search", async () => {
    mocks.queryRaw.mockResolvedValue([{ id: "prev" }, { id: "p2" }, { id: "p1" }]);
    mocks.findMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
    const result = await getAdminProductRows({ page: 2, stock: "out", query: "' OR TRUE --", category: "cat-1" });
    const sql = mocks.queryRaw.mock.calls[0][0];
    expect(sql.text).toContain('COALESCE(stock."available", 0) <= 0');
    expect(sql.text).toContain('variant."active" = true');
    expect(sql.text).not.toContain("' OR TRUE --");
    expect(sql.values).toContain("%' OR TRUE --%");
    expect(sql.values).toEqual(expect.arrayContaining([24, 27]));
    expect(result.products.map(p => p.id)).toEqual(["p2", "p1"]);
    expect(result.previousId).toBe("prev");
  });

  it("returns the rows around the page so the arrows can cross page boundaries", async () => {
    mocks.findMany.mockResolvedValue(Array.from({ length: 27 }, (_, i) => ({ id: `r${i}` })));
    const result = await getAdminProductRows({ page: 2 });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 24, take: 27 }));
    expect(result.previousId).toBe("r0");
    expect(result.products.map((p) => p.id)).toEqual(Array.from({ length: 25 }, (_, i) => `r${i + 1}`));
    expect(result.nextId).toBe("r26");
    expect(result.hasNextPage).toBe(true);
  });

  it("has no previous row on the first page and no next row on the last one", async () => {
    mocks.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    const result = await getAdminProductRows({ page: 1 });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 26 }));
    expect(result).toMatchObject({ previousId: null, nextId: null, hasNextPage: false });
  });
});

describe("Admin product search by SKU", () => {
  it("matches the normalized SKU of any variant", async () => {
    await getAdminProductRows({ page: 1, query: " crtz-tsh-blk " });
    const where = mocks.findMany.mock.calls[0][0].where;
    expect(where.AND[0].OR).toContainEqual({ variants: { some: { sku: { contains: "CRTZ-TSH-BLK" } } } });
  });

  it("parameterizes the SKU term in the stock-filtered SQL path too", async () => {
    mocks.queryRaw.mockResolvedValue([]);
    await getAdminProductRows({ page: 1, stock: "low", query: "crtz-g" });
    const sql = mocks.queryRaw.mock.calls[0][0];
    expect(sql.text).toContain('sku_variant."sku" LIKE');
    expect(sql.text).not.toContain("CRTZ-G");
    expect(sql.values).toContain("%CRTZ-G%");
  });
});
