import { describe, expect, it } from "vitest";
import { getEditableStorageKey } from "@/lib/product-image-editor-storage";

const key = "products/2026/09/7e82b334-7d5f-494b-975a-56696056101e-foto-rare-v1-original.png";
describe("crop storage authorization boundary", () => {
  it("only resolves generated product object keys under the exact configured storage prefix", () => {
    expect(getEditableStorageKey(`/uploads/${key}`, "/uploads")).toBe(key);
    expect(getEditableStorageKey(`https://media.example/${key}`, "https://media.example")).toBe(key);
  });
  it.each([
    "https://169.254.169.254/latest/meta-data", "https://media.example.evil/products/foo.png",
    `https://media.example/${key}?download=1`, `https://media.example/${key}#fragment`,
    "https://media.example/products/2026/09/../../secret", "https://media.example/products%2F2026/09/file.png",
    "https://media.example/products/2026/09/%2e%2e%2fsecret", "https://media.example/banners/2026/09/file.png",
    "https://media.example/products/2026/09/file.png", "file:///etc/passwd", "/uploads/../secret",
  ])("rejects untrusted media reference %s without fetching it", (url) => {
    expect(() => getEditableStorageKey(url, "https://media.example")).toThrow();
  });
});
