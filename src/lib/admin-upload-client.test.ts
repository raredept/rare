import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadAdminMediaFile } from "@/lib/admin-upload-client";
import { DIRECT_R2_UPLOAD_LIMIT_BYTES } from "@/lib/upload-limits";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("admin upload client", () => {
  it("uses the presigned R2 flow before returning the public URL", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            upload: {
              uploadUrl: "https://r2.example/upload",
              publicUrl: "https://media.rare.example/products/file.webp",
              key: "products/2026/05/file.webp",
              contentType: "image/webp",
              size: 4,
              expiresInSeconds: 300,
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    global.fetch = fetchMock;
    const progress = vi.fn();

    const url = await uploadAdminMediaFile(new File([new Uint8Array([1, 2, 3, 4])], "produto.webp", { type: "image/webp" }), {
      context: "products",
      onProgress: progress,
    });

    expect(url).toBe("https://media.rare.example/products/file.webp");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/admin/uploads/presign",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toMatchObject({
      filename: "produto.webp",
      contentType: "image/webp",
      sizeBytes: 4,
      uploadContext: "products",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://r2.example/upload",
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "image/webp" },
      }),
    );
    expect(progress).toHaveBeenCalledWith(100);
  });

  it("falls back to the old route only for small local/dev uploads", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            fallback: "server-routed",
            maxBytes: 4 * 1024 * 1024,
            error: "Upload direto para R2 indisponivel neste ambiente.",
          }),
          { status: 409 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ uploads: [{ url: "/uploads/products/file.png" }] }), {
          status: 200,
        }),
      );
    global.fetch = fetchMock;

    const url = await uploadAdminMediaFile(new File([new Uint8Array([1])], "produto.png", { type: "image/png" }), {
      context: "products",
    });
    const fallbackBody = fetchMock.mock.calls[1]?.[1]?.body as FormData;

    expect(url).toBe("/uploads/products/file.png");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/admin/uploads");
    expect(fallbackBody.get("uploadContext")).toBe("products");
  });

  it("rejects files above 100 MB before calling the backend", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock;
    const oversized = { name: "video.mp4", type: "video/mp4", size: DIRECT_R2_UPLOAD_LIMIT_BYTES + 1 } as File;

    await expect(uploadAdminMediaFile(oversized, { context: "products" })).rejects.toThrow("Arquivo acima de 100 MB");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
