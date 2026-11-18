import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  saveUploadedImage: vi.fn(),
  prisma: {
    category: {
      findMany: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    productVariant: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  tx: {
    $executeRaw: vi.fn(),
    adminAuditLog: {
      create: vi.fn(),
    },
    product: {
      update: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    productImage: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    productVariant: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/storage", () => ({
  saveUploadedImage: mocks.saveUploadedImage,
}));

type ShippingFormData = {
  weightGrams?: string;
  lengthCm?: string;
  widthCm?: string;
  heightCm?: string;
};

function buildProductFormData(
  options: {
    imageUrls?: string;
    featured?: boolean;
    featuredSortOrder?: string;
    active?: boolean;
    shippingData?: ShippingFormData | null;
    catalogPosition?: string;
    originalCatalogPosition?: string;
  } = {},
) {
  const formData = new FormData();
  formData.set("title", "Supreme Bag");
  formData.set("slug", "supreme-bag-nova");
  formData.set("shortDescription", "Bolsa premium selecionada.");
  formData.set("description", "Descrição completa do produto.");
  formData.set("brand", "Supreme");
  formData.set("categoryId", "cat-accessories");
  formData.set("subcategoryId", "cat-bags");
  formData.set("price", "R$ 529,99");
  if (options.catalogPosition !== undefined) formData.set("catalogPosition", options.catalogPosition);
  if (options.originalCatalogPosition !== undefined) formData.set("originalCatalogPosition", options.originalCatalogPosition);
  if (options.active ?? true) {
    formData.set("active", "on");
  }
  if (options.featured ?? true) {
    formData.set("featured", "on");
  }
  formData.set("featuredSortOrder", options.featuredSortOrder ?? "1");
  formData.set("variants", "Único:2:SKU-1");
  formData.set("imageUrls", options.imageUrls ?? "https://media.rare.example/products/new.webp");
  if (options.shippingData !== null) {
    const shippingData = {
      weightGrams: "500",
      lengthCm: "30",
      widthCm: "24",
      heightCm: "8",
      ...options.shippingData,
    };
    formData.set("weightGrams", shippingData.weightGrams ?? "");
    formData.set("lengthCm", shippingData.lengthCm ?? "");
    formData.set("widthCm", shippingData.widthCm ?? "");
    formData.set("heightCm", shippingData.heightCm ?? "");
  }
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ id: "admin-1", username: "operador", email: "op@rare.example" });
  mocks.tx.product.findMany.mockResolvedValue([{ id: "prod-new" }, { id: "prod-a" }, { id: "prod-1" }, { id: "prod-b" }]);
  mocks.tx.$executeRaw.mockResolvedValue(0);
  // Lookup by id returns the edited product; lookup by slug (the uniqueness
  // pre-check) finds no other owner unless a test says so.
  mocks.prisma.product.findUnique.mockImplementation(async ({ where }: { where: { id?: string; slug?: string } }) =>
    where.slug
      ? null
      : {
          id: "prod-1",
          slug: "supreme-bag",
          category: { slug: "acessorios" },
          subcategory: { slug: "bags" },
        },
  );
  mocks.prisma.category.findMany.mockResolvedValue([
    { id: "cat-accessories", parentId: null },
    { id: "cat-bags", parentId: "cat-accessories" },
  ]);
  mocks.prisma.$transaction.mockImplementation(async (callback: (tx: typeof mocks.tx) => Promise<unknown>) => callback(mocks.tx));
  mocks.tx.product.update.mockResolvedValue({
    id: "prod-1",
    slug: "supreme-bag-nova",
    category: { slug: "acessorios" },
    subcategory: { slug: "bags" },
  });
  mocks.tx.product.create.mockResolvedValue({
    id: "prod-new",
    slug: "supreme-bag-nova",
    category: { slug: "acessorios" },
    subcategory: { slug: "bags" },
  });
  mocks.prisma.product.update.mockResolvedValue({
    id: "prod-1",
    slug: "supreme-bag",
    active: true,
    category: { slug: "acessorios" },
    subcategory: { slug: "bags" },
  });
  mocks.tx.productVariant.findMany.mockResolvedValue([]);
  mocks.prisma.productVariant.findMany.mockResolvedValue([]);
  mocks.prisma.productVariant.findFirst.mockResolvedValue(null);
});

describe("product admin actions", () => {
  it("saves ordered media URLs, revalidates public paths and redirects back to edit with success", async () => {
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");

    await expect(saveProductAction("prod-1", buildProductFormData())).rejects.toThrow(
      /^NEXT_REDIRECT:\/admin\/products\/prod-1\/edit\?success=product-saved&refresh=\d+$/,
    );

    expect(mocks.tx.productImage.deleteMany).toHaveBeenCalledWith({ where: { productId: "prod-1" } });
    expect(mocks.tx.productImage.createMany).toHaveBeenCalledWith({
      data: [
        {
          productId: "prod-1",
          url: "https://media.rare.example/products/new.webp",
          alt: "Supreme Bag",
          sortOrder: 0,
        },
      ],
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/products");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/categoria/destaques");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/categoria/tudo");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/produto/supreme-bag");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/produto/supreme-bag-nova");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/categoria/acessorios");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/categoria/bags");
    expect(mocks.tx.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          featured: true,
          featuredSortOrder: 1,
        }),
      }),
    );
  }, 60000);

  it("creates a product and redirects back to a clean new-product form with success feedback", async () => {
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");

    await expect(saveProductAction(null, buildProductFormData())).rejects.toThrow(
      /^NEXT_REDIRECT:\/admin\/products\/new\?success=product-created&refresh=\d+$/,
    );

    // No previous-product lookup when creating; the single lookup is the slug check.
    expect(mocks.prisma.product.findUnique).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.product.findUnique).toHaveBeenCalledWith({ where: { slug: "supreme-bag-nova" }, select: { id: true } });
    expect(mocks.tx.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Supreme Bag",
          slug: "supreme-bag-nova",
          priceInCents: 52999,
          weightGrams: 500,
          lengthCm: 30,
          widthCm: 24,
          heightCm: 8,
          active: true,
          featured: true,
          featuredSortOrder: 1,
        }),
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/products/prod-new/edit");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/produto/supreme-bag-nova");
  }, 60000);

  it("rejects active product without weight and dimensions", async () => {
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");

    await expect(saveProductAction(null, buildProductFormData({ shippingData: null }))).rejects.toThrow(
      /^NEXT_REDIRECT:\/admin\/products\/new\?error=Informe%20peso%2C%20altura%2C%20largura%20e%20comprimento%20maiores%20que%200/,
    );

    expect(mocks.tx.product.create).not.toHaveBeenCalled();
  }, 60000);

  it("allows inactive product without weight and dimensions", async () => {
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");

    await expect(saveProductAction(null, buildProductFormData({ active: false, shippingData: null }))).rejects.toThrow(
      /^NEXT_REDIRECT:\/admin\/products\/new\?success=product-created&refresh=\d+$/,
    );

    expect(mocks.tx.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          active: false,
          weightGrams: undefined,
          lengthCm: undefined,
          widthCm: undefined,
          heightCm: undefined,
        }),
      }),
    );
  }, 60000);

  it("accepts comma or point only when the submitted shipping value is still an integer", async () => {
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");
    await expect(saveProductAction(null, buildProductFormData({ shippingData: { weightGrams: "500,0", heightCm: "8.0" } }))).rejects.toThrow(
      /^NEXT_REDIRECT:\/admin\/products\/new\?success=product-created/,
    );
    expect(mocks.tx.product.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ weightGrams: 500, heightCm: 8 }),
    }));
  }, 60000);

  it("returns a field-specific error and preserves shipping values after server validation", async () => {
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");
    await expect(saveProductAction(null, buildProductFormData({ shippingData: { weightGrams: "-1" } }))).rejects.toThrow(
      /error=Peso%20deve%20ser%20um%20n%C3%BAmero%20inteiro.*draft_weightGrams=-1.*draft_lengthCm=30.*draft_widthCm=24.*draft_heightCm=8/,
    );
    expect(mocks.tx.product.create).not.toHaveBeenCalled();
  }, 60000);

  it("rejects activating a hidden product without weight and dimensions", async () => {
    mocks.prisma.product.findUnique.mockResolvedValueOnce({
      weightGrams: null,
      lengthCm: null,
      widthCm: null,
      heightCm: null,
    });
    const formData = new FormData();
    formData.set("id", "prod-1");
    formData.set("active", "false");
    const { toggleProductActiveAction } = await import("@/app/admin/(protected)/products/actions");

    await expect(toggleProductActiveAction(formData)).rejects.toThrow(
      /^NEXT_REDIRECT:\/admin\/products\?error=Informe%20peso%2C%20altura%2C%20largura%20e%20comprimento%20maiores%20que%200/,
    );

    expect(mocks.prisma.product.update).not.toHaveBeenCalled();
  }, 60000);

  it("persists every submitted media URL in order when creating a product", async () => {
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");
    const formData = buildProductFormData({
      imageUrls: [
        "https://media.rare.example/products/cover.webp",
        "https://media.rare.example/products/detail.webp",
        "https://media.rare.example/products/back.webp",
      ].join("\n"),
    });

    await expect(saveProductAction(null, formData)).rejects.toThrow(
      /^NEXT_REDIRECT:\/admin\/products\/new\?success=product-created&refresh=\d+$/,
    );

    expect(mocks.tx.productImage.createMany).toHaveBeenCalledWith({
      data: [
        {
          productId: "prod-new",
          url: "https://media.rare.example/products/cover.webp",
          alt: "Supreme Bag",
          sortOrder: 0,
        },
        {
          productId: "prod-new",
          url: "https://media.rare.example/products/detail.webp",
          alt: "Supreme Bag",
          sortOrder: 1,
        },
        {
          productId: "prod-new",
          url: "https://media.rare.example/products/back.webp",
          alt: "Supreme Bag",
          sortOrder: 2,
        },
      ],
    });
  }, 60000);

  it("clears manual featured order when the product is not featured", async () => {
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");

    await expect(saveProductAction(null, buildProductFormData({ featured: false, featuredSortOrder: "2" }))).rejects.toThrow(
      /^NEXT_REDIRECT:\/admin\/products\/new\?success=product-created&refresh=\d+$/,
    );

    expect(mocks.tx.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          featured: false,
          featuredSortOrder: null,
        }),
      }),
    );
  }, 60000);

  it("rejects invalid manual featured order submitted by hand", async () => {
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");

    await expect(saveProductAction(null, buildProductFormData({ featuredSortOrder: "1.5" }))).rejects.toThrow(
      /^NEXT_REDIRECT:\/admin\/products\/new\?error=Informe%20uma%20ordem%20de%20destaque/,
    );

    expect(mocks.tx.product.create).not.toHaveBeenCalled();
  }, 60000);

  it("rejects inactive or invalid subcategories submitted manually", async () => {
    mocks.prisma.category.findMany.mockResolvedValueOnce([{ id: "cat-accessories", parentId: null }]);
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");

    await expect(saveProductAction(null, buildProductFormData())).rejects.toThrow(
      /^NEXT_REDIRECT:\/admin\/products\/new\?error=Selecione%20uma%20subcategoria%20ativa\.&refresh=\d+$/,
    );

    expect(mocks.tx.product.create).not.toHaveBeenCalled();
  }, 60000);
});

describe("slug collisions (regression: a duplicate slug crashed the Admin)", () => {
  const slugTaken = encodeURIComponent("Já existe um produto com este slug. Escolha outro slug e salve novamente.");

  function slugOwnedBy(ownerId: string) {
    mocks.prisma.product.findUnique.mockImplementation(async ({ where }: { where: { id?: string; slug?: string } }) =>
      where.slug ? { id: ownerId } : { id: "prod-1", slug: "supreme-bag", category: { slug: "acessorios" }, subcategory: { slug: "bags" } },
    );
  }

  it("rejects creating a product whose slug another product already uses", async () => {
    slugOwnedBy("prod-other");
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");

    await expect(saveProductAction(null, buildProductFormData())).rejects.toThrow(`NEXT_REDIRECT:`);
    const url = mocks.redirect.mock.calls.at(-1)?.[0] as string;
    expect(url).toContain("/admin/products/new?");
    expect(url).toContain(`error=${slugTaken}`);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects renaming a product to another product's slug", async () => {
    slugOwnedBy("prod-2");
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");

    await expect(saveProductAction("prod-1", buildProductFormData())).rejects.toThrow("NEXT_REDIRECT:");
    expect(mocks.redirect.mock.calls.at(-1)?.[0]).toContain(`error=${slugTaken}`);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("lets a product keep its own slug", async () => {
    slugOwnedBy("prod-1");
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");

    await expect(saveProductAction("prod-1", buildProductFormData())).rejects.toThrow("NEXT_REDIRECT:");
    expect(mocks.redirect.mock.calls.at(-1)?.[0]).toContain("success=product-saved");
  });

  it("turns a slug race lost inside the transaction into the same message", async () => {
    const { Prisma } = await import("@prisma/client");
    mocks.prisma.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`slug`)", { code: "P2002", clientVersion: "test" }),
    );
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");

    await expect(saveProductAction(null, buildProductFormData())).rejects.toThrow("NEXT_REDIRECT:");
    expect(mocks.redirect.mock.calls.at(-1)?.[0]).toContain(`error=${slugTaken}`);
  });

  it("does not disguise an unrelated database failure as a slug problem", async () => {
    mocks.prisma.$transaction.mockRejectedValueOnce(new Error("connection reset"));
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");

    await expect(saveProductAction(null, buildProductFormData())).rejects.toThrow("connection reset");
  });
});

describe("SKU (RARE-ORDER-ITEM-IMAGE-01)", () => {
  const skuTaken = encodeURIComponent("Este SKU já está sendo utilizado por outro item.");

  function withVariantRows(formData: FormData, rows: Array<[string, string, string]>) {
    formData.delete("variants");
    for (const [size, stock, sku] of rows) {
      formData.append("variantSize", size);
      formData.append("variantStock", stock);
      formData.append("variantSku", sku);
    }
    return formData;
  }

  function lastRedirect() {
    return mocks.redirect.mock.calls.at(-1)?.[0] as string;
  }

  it("creates a product without SKU: stored as NULL, never an empty string", async () => {
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");
    const formData = withVariantRows(buildProductFormData(), [["Único", "1", ""]]);

    await expect(saveProductAction(null, formData)).rejects.toThrow("NEXT_REDIRECT:");
    expect(lastRedirect()).toContain("success=product-created");
    expect(mocks.tx.productVariant.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ size: "Único", stock: 1, sku: null }), update: expect.objectContaining({ sku: null }) }),
    );
    // Nothing to check for uniqueness when no SKU was given.
    expect(mocks.prisma.productVariant.findFirst).not.toHaveBeenCalled();
  });

  it("creates a product with a SKU per variant, normalized (trim + upper case)", async () => {
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");
    const formData = withVariantRows(buildProductFormData(), [
      ["M", "2", " crtz-tsh-blk-m "],
      ["G", "1", "CRTZ-TSH-BLK-G"],
      ["GG", "0", ""],
    ]);

    await expect(saveProductAction(null, formData)).rejects.toThrow("NEXT_REDIRECT:");
    expect(lastRedirect()).toContain("success=product-created");
    const created = mocks.tx.productVariant.upsert.mock.calls.map(([args]) => args.create);
    expect(created).toEqual([
      expect.objectContaining({ size: "M", stock: 2, sku: "CRTZ-TSH-BLK-M" }),
      expect.objectContaining({ size: "G", stock: 1, sku: "CRTZ-TSH-BLK-G" }),
      expect.objectContaining({ size: "GG", stock: 0, sku: null }),
    ]);
    expect(mocks.prisma.productVariant.findFirst).toHaveBeenCalledWith({
      where: { sku: { in: ["CRTZ-TSH-BLK-M", "CRTZ-TSH-BLK-G"] } },
      select: { id: true },
    });
  });

  it("still reads the legacy Tamanho:Estoque:SKU textarea", async () => {
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");

    await expect(saveProductAction(null, buildProductFormData())).rejects.toThrow("NEXT_REDIRECT:");
    expect(mocks.tx.productVariant.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ size: "Único", stock: 2, sku: "SKU-1" }) }));
  });

  it("rejects a SKU already used by another product with the friendly message", async () => {
    mocks.prisma.productVariant.findFirst.mockResolvedValueOnce({ id: "var-other" });
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");
    const formData = withVariantRows(buildProductFormData(), [["G", "1", "crtz-tsh-blk-g"]]);

    await expect(saveProductAction("prod-1", formData)).rejects.toThrow("NEXT_REDIRECT:");
    expect(lastRedirect()).toContain(`error=${skuTaken}`);
    expect(mocks.prisma.productVariant.findFirst).toHaveBeenCalledWith({
      where: { sku: { in: ["CRTZ-TSH-BLK-G"] }, productId: { not: "prod-1" } },
      select: { id: true },
    });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects the same SKU on two variants of the same submission", async () => {
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");
    const formData = withVariantRows(buildProductFormData(), [["M", "1", "CRTZ-1"], ["G", "1", "crtz-1"]]);

    await expect(saveProductAction(null, formData)).rejects.toThrow("NEXT_REDIRECT:");
    expect(lastRedirect()).toContain(`error=${skuTaken}`);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("turns a SKU race lost to the database unique index into the same message (no Prisma text)", async () => {
    const { Prisma } = await import("@prisma/client");
    mocks.prisma.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`sku`)", { code: "P2002", clientVersion: "test", meta: { target: ["sku"] } }),
    );
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");
    const formData = withVariantRows(buildProductFormData(), [["G", "1", "CRTZ-TSH-BLK-G"]]);

    await expect(saveProductAction(null, formData)).rejects.toThrow("NEXT_REDIRECT:");
    const url = lastRedirect();
    expect(url).toContain(`error=${skuTaken}`);
    expect(decodeURIComponent(url)).not.toMatch(/unique constraint|prisma|P2002/i);
  });

  it("rejects an invalid SKU format with a readable message", async () => {
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");
    const formData = withVariantRows(buildProductFormData(), [["G", "1", "camiseta preta"]]);

    await expect(saveProductAction(null, formData)).rejects.toThrow("NEXT_REDIRECT:");
    expect(decodeURIComponent(lastRedirect())).toContain("SKU inválido. Use de 3 a 64 caracteres");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("edits SKUs: releases the ones taken away first, keeps the stock math (never below reserved)", async () => {
    mocks.tx.productVariant.findMany.mockResolvedValueOnce([
      { id: "var-m", size: "M", sku: "OLD-M", stock: 3, reservedStock: 0 },
      { id: "var-g", size: "G", sku: "SAME-G", stock: 2, reservedStock: 2 },
      { id: "var-p", size: "P", sku: "GONE-P", stock: 1, reservedStock: 0 },
    ]);
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");
    const formData = withVariantRows(buildProductFormData(), [["M", "3", "NEW-M"], ["G", "1", "same-g"]]);

    await expect(saveProductAction("prod-1", formData)).rejects.toThrow("NEXT_REDIRECT:");
    expect(lastRedirect()).toContain("success=product-saved");
    // OLD-M changed and GONE-P's variant was removed: both freed before the upserts; SAME-G kept.
    expect(mocks.tx.productVariant.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["var-m", "var-p"] } }, data: { sku: null } });
    const updates = mocks.tx.productVariant.upsert.mock.calls.map(([args]) => args.update);
    expect(updates).toEqual([
      { sku: "NEW-M", stock: 3, active: true },
      { sku: "SAME-G", stock: 2, active: true },
    ]);
    expect(mocks.tx.productVariant.updateMany).toHaveBeenCalledWith({ where: { productId: "prod-1", size: { notIn: ["M", "G"] } }, data: { active: false } });
  });

  it("ignores the blank row of the variant editor", async () => {
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");
    const formData = withVariantRows(buildProductFormData(), [["Único", "1", ""], ["", "", ""]]);

    await expect(saveProductAction(null, formData)).rejects.toThrow("NEXT_REDIRECT:");
    expect(mocks.tx.productVariant.upsert).toHaveBeenCalledTimes(1);
  });

  it("requires size and a whole, non-negative stock in every filled row", async () => {
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");
    const formData = withVariantRows(buildProductFormData(), [["G", "-1", "CRTZ-1"]]);

    await expect(saveProductAction(null, formData)).rejects.toThrow("NEXT_REDIRECT:");
    expect(decodeURIComponent(lastRedirect())).toContain("Informe tamanho e estoque");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("manual catalog position (RARE-PRODUCT-CATALOG-ORDER-01)", () => {
  /** The renumbering UPDATE: ids and positions are bound as two arrays. */
  function renumberCall() {
    const call = mocks.tx.$executeRaw.mock.calls.find(([sql]) => (sql as TemplateStringsArray).join("?").includes('UPDATE "Product"'));
    return call ? { ids: call[1] as string[], positions: call[2] as number[] } : null;
  }

  it("moves an edited product to the typed position, renumbers 1..N and records the audit", async () => {
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");
    await expect(
      saveProductAction("prod-1", buildProductFormData({ catalogPosition: "1", originalCatalogPosition: "3" })),
    ).rejects.toThrow(/success=product-saved/);

    // Serialized by the advisory lock before reading the order.
    expect((mocks.tx.$executeRaw.mock.calls[0][0] as TemplateStringsArray).join("?")).toContain("pg_advisory_xact_lock");
    expect(renumberCall()).toEqual({ ids: ["prod-1", "prod-new", "prod-a", "prod-b"], positions: [1, 2, 3, 4] });
    // The form never writes sortOrder directly any more.
    expect(mocks.tx.product.update.mock.calls[0][0].data).not.toHaveProperty("sortOrder");
    expect(mocks.tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "admin-1",
        actorLabel: "operador",
        action: "product.catalog_position_changed",
        entityType: "Product",
        entityId: "prod-1",
        before: { position: 3 },
        after: { position: 1, total: 4, source: "form" },
      }),
    });
  }, 60000);

  it("a position past the end puts the piece last", async () => {
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");
    await expect(saveProductAction("prod-1", buildProductFormData({ catalogPosition: "99", originalCatalogPosition: "3" }))).rejects.toThrow(
      /success=product-saved/,
    );
    expect(renumberCall()?.ids).toEqual(["prod-new", "prod-a", "prod-b", "prod-1"]);
  }, 60000);

  it("saving without changing the shown position never reorders (even if the list changed meanwhile)", async () => {
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");
    await expect(saveProductAction("prod-1", buildProductFormData({ catalogPosition: "3", originalCatalogPosition: "3" }))).rejects.toThrow(
      /success=product-saved/,
    );
    expect(mocks.tx.$executeRaw).not.toHaveBeenCalled();
    expect(mocks.tx.adminAuditLog.create).not.toHaveBeenCalled();
  }, 60000);

  it("a new product goes to position 1 by default", async () => {
    mocks.tx.product.findMany.mockResolvedValue([{ id: "prod-a" }, { id: "prod-new" }, { id: "prod-b" }]);
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");
    await expect(saveProductAction(null, buildProductFormData())).rejects.toThrow(/success=product-created/);
    expect(mocks.tx.product.create.mock.calls[0][0].data.sortOrder).toBe(0);
    expect(renumberCall()?.ids).toEqual(["prod-new", "prod-a", "prod-b"]);
  }, 60000);

  it("a new product can be created directly at a chosen position", async () => {
    mocks.tx.product.findMany.mockResolvedValue([{ id: "prod-new" }, { id: "prod-a" }, { id: "prod-b" }]);
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");
    await expect(saveProductAction(null, buildProductFormData({ catalogPosition: "2" }))).rejects.toThrow(/success=product-created/);
    expect(renumberCall()?.ids).toEqual(["prod-a", "prod-new", "prod-b"]);
  }, 60000);

  it.each(["0", "-1", "1.5", "abc", "1e3"])("rejects position %s with a readable message and writes nothing", async (value) => {
    const { saveProductAction } = await import("@/app/admin/(protected)/products/actions");
    await expect(saveProductAction("prod-1", buildProductFormData({ catalogPosition: value, originalCatalogPosition: "3" }))).rejects.toThrow(
      /error=Informe%20a%20posi%C3%A7%C3%A3o%20no%20cat%C3%A1logo/,
    );
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  }, 60000);
});

describe("moveProductInCatalogAction (up / down arrows in the Admin list)", () => {
  function moveForm(fields: Record<string, string>) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) formData.set(key, value);
    return formData;
  }

  function renumberedIds() {
    const call = mocks.tx.$executeRaw.mock.calls.find(([sql]) => (sql as TemplateStringsArray).join("?").includes('UPDATE "Product"'));
    return call?.[1];
  }

  beforeEach(() => {
    mocks.prisma.product.findUnique.mockResolvedValue({ id: "prod-b", slug: "peca-b", category: { slug: "camisetas" }, subcategory: null });
  });

  it("requires the commerce.products permission", async () => {
    mocks.requireAdmin.mockRejectedValueOnce(new Error("NEXT_REDIRECT:/admin/access-denied"));
    const { moveProductInCatalogAction } = await import("@/app/admin/(protected)/products/actions");
    await expect(moveProductInCatalogAction(moveForm({ id: "prod-b", neighborId: "prod-a", direction: "up" }))).rejects.toThrow(/access-denied/);
    expect(mocks.requireAdmin).toHaveBeenCalledWith("commerce.products");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("up puts the piece right before the row above, keeps the filters and audits", async () => {
    const { moveProductInCatalogAction } = await import("@/app/admin/(protected)/products/actions");
    await expect(
      moveProductInCatalogAction(
        moveForm({ id: "prod-b", neighborId: "prod-a", direction: "up", return_page: "2", return_q: "bag", return_evil: "x" }),
      ),
    ).rejects.toThrow(/^NEXT_REDIRECT:\/admin\/products\?page=2&q=bag&success=product-moved&refresh=\d+#product-prod-b$/);
    expect(renumberedIds()).toEqual(["prod-new", "prod-b", "prod-a", "prod-1"]);
    expect(mocks.tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entityId: "prod-b", before: { position: 4 }, after: { position: 2, total: 4, source: "arrow" } }),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/categoria/camisetas");
  });

  it("down puts the piece right after the row below (that row may be on the next page)", async () => {
    const { moveProductInCatalogAction } = await import("@/app/admin/(protected)/products/actions");
    await expect(moveProductInCatalogAction(moveForm({ id: "prod-new", neighborId: "prod-1", direction: "down" }))).rejects.toThrow(
      /success=product-moved/,
    );
    expect(renumberedIds()).toEqual(["prod-a", "prod-1", "prod-new", "prod-b"]);
  });

  it("refuses a neighbour that no longer exists without writing anything", async () => {
    const { moveProductInCatalogAction } = await import("@/app/admin/(protected)/products/actions");
    await expect(moveProductInCatalogAction(moveForm({ id: "prod-b", neighborId: "gone", direction: "up" }))).rejects.toThrow(
      /error=N%C3%A3o%20foi%20poss%C3%ADvel%20mover/,
    );
    expect(mocks.tx.adminAuditLog.create).not.toHaveBeenCalled();
    expect(mocks.tx.$executeRaw).toHaveBeenCalledTimes(1); // only the lock
  });

  it.each([
    { id: "prod-b", neighborId: "prod-a", direction: "sideways" },
    { id: "", neighborId: "prod-a", direction: "up" },
    { id: "prod-b", neighborId: "", direction: "down" },
  ])("rejects an invalid move %o", async (fields) => {
    const { moveProductInCatalogAction } = await import("@/app/admin/(protected)/products/actions");
    await expect(moveProductInCatalogAction(moveForm(fields))).rejects.toThrow(/error=Movimento%20inv%C3%A1lido/);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });
});
