import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/uploads/[...path]/route";

const originalEnv = process.env;
const uploadRoot = path.join(process.cwd(), "public", "uploads", "qa-test-route");

beforeEach(async () => {
  process.env = {
    ...originalEnv,
    STORAGE_DRIVER: "local",
  };
  await mkdir(path.join(uploadRoot, "products", "2026", "05"), { recursive: true });
});

afterEach(async () => {
  process.env = originalEnv;
  await rm(uploadRoot, { recursive: true, force: true });
});

describe("local upload serving route", () => {
  it("serves uploaded local images from the configured storage directory", async () => {
    await writeFile(path.join(uploadRoot, "products", "2026", "05", "produto.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const response = await GET(new Request("http://localhost/uploads/qa-test-route/products/2026/05/produto.png") as never, {
      params: Promise.resolve({ path: ["qa-test-route", "products", "2026", "05", "produto.png"] }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("rejects traversal and unsupported upload extensions", async () => {
    const traversal = await GET(new Request("http://localhost/uploads/../secret.png") as never, {
      params: Promise.resolve({ path: ["..", "secret.png"] }),
    });
    const svg = await GET(new Request("http://localhost/uploads/products/icon.svg") as never, {
      params: Promise.resolve({ path: ["products", "icon.svg"] }),
    });

    expect(traversal.status).toBe(404);
    expect(svg.status).toBe(404);
  });
});
