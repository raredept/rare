import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadAdminMediaFile } from "@/lib/admin-upload-client";
import { SERVER_ROUTED_UPLOAD_LIMIT_BYTES } from "@/lib/upload-limits";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("admin upload client", () => {
  it("uses the server-side upload route before returning the public URL", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          uploads: [
            {
              url: "https://media.rare.example/products/file.webp",
              key: "products/2026/05/file.webp",
              contentType: "image/webp",
              size: 4,
            },
          ],
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;
    const progress = vi.fn();

    const url = await uploadAdminMediaFile(new File([new Uint8Array([1, 2, 3, 4])], "produto.webp", { type: "image/webp" }), {
      context: "products",
      onProgress: progress,
    });

    expect(url).toBe("https://media.rare.example/products/file.webp");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/admin/uploads",
      expect.objectContaining({
        method: "POST",
      }),
    );
    const body = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    expect(body.get("uploadContext")).toBe("products");
    expect(body.get("files")).toBeInstanceOf(File);
    expect(fetchMock).not.toHaveBeenCalledWith("/api/admin/uploads/presign", expect.anything());
    expect(progress).toHaveBeenCalledWith(100);
  });

  it("uses the same server-side route for local/dev uploads", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ uploads: [{ url: "/uploads/products/file.png" }] }), {
        status: 200,
      }),
    );
    global.fetch = fetchMock;

    const url = await uploadAdminMediaFile(new File([new Uint8Array([1])], "produto.png", { type: "image/png" }), {
      context: "products",
    });
    const body = fetchMock.mock.calls[0]?.[1]?.body as FormData;

    expect(url).toBe("/uploads/products/file.png");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/admin/uploads");
    expect(body.get("uploadContext")).toBe("products");
  });

  it("rejects files above 4 MB before calling the backend", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock;
    const oversized = { name: "video.mp4", type: "video/mp4", size: SERVER_ROUTED_UPLOAD_LIMIT_BYTES + 1 } as File;

    await expect(uploadAdminMediaFile(oversized, { context: "products" })).rejects.toThrow("Arquivo acima de 4 MB");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
