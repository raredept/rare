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
    },
    $transaction: vi.fn(),
  },
  tx: {
    product: {
      update: vi.fn(),
      create: vi.fn(),
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

function buildProductFormData(options: { imageUrls?: string; featured?: boolean; featuredSortOrder?: string } = {}) {
  const formData = new FormData();
  formData.set("title", "Supreme Bag");
  formData.set("slug", "supreme-bag-nova");
  formData.set("shortDescription", "Bolsa premium selecionada.");
  formData.set("description", "Descrição completa do produto.");
  formData.set("brand", "Supreme");
  formData.set("categoryId", "cat-accessories");
  formData.set("subcategoryId", "cat-bags");
  formData.set("price", "R$ 529,99");
  formData.set("sortOrder", "0");
  formData.set("active", "on");
  if (options.featured ?? true) {
    formData.set("featured", "on");
  }
  formData.set("featuredSortOrder", options.featuredSortOrder ?? "1");
  formData.set("variants", "Único:2:SKU-1");
  formData.set("imageUrls", options.imageUrls ?? "https://media.rare.example/products/new.webp");
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
  mocks.prisma.product.findUnique.mockResolvedValue({
    id: "prod-1",
    slug: "supreme-bag",
    category: { slug: "acessorios" },
    subcategory: { slug: "bags" },
  });
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
  mocks.tx.productVariant.findMany.mockResolvedValue([]);
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

    expect(mocks.prisma.product.findUnique).not.toHaveBeenCalled();
    expect(mocks.tx.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Supreme Bag",
          slug: "supreme-bag-nova",
          priceInCents: 52999,
          active: true,
          featured: true,
          featuredSortOrder: 1,
        }),
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/products/prod-new/edit");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/produto/supreme-bag-nova");
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
