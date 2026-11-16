import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminProductRows } from "@/lib/admin-products-data";

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), queryRaw: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { product: { findMany: mocks.findMany }, $queryRaw: mocks.queryRaw } }));

beforeEach(() => { vi.clearAllMocks(); mocks.findMany.mockResolvedValue([]); });

describe("bounded Admin product queries", () => {
  it("combines search and category instead of overwriting the search OR", async () => {
    await getAdminProductRows({ page: 3, query: "camiseta", category: "cat-1", status: "active" });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 50, take: 26,
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
    mocks.queryRaw.mockResolvedValue([{ id: "p2" }, { id: "p1" }]);
    mocks.findMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
    const result = await getAdminProductRows({ page: 2, stock: "out", query: "' OR TRUE --", category: "cat-1" });
    const sql = mocks.queryRaw.mock.calls[0][0];
    expect(sql.text).toContain('COALESCE(stock."available", 0) <= 0');
    expect(sql.text).toContain('variant."active" = true');
    expect(sql.text).not.toContain("' OR TRUE --");
    expect(sql.values).toContain("%' OR TRUE --%");
    expect(sql.values).toContain(25);
    expect(result.products.map(p => p.id)).toEqual(["p2", "p1"]);
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
