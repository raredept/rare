import { describe, expect, it, vi } from "vitest";
import { readBoundedRequestBody, RequestBodyTooLargeError } from "./request-body";

function streamedRequest(contentLength?: string) {
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) { controller.enqueue(new TextEncoder().encode("abc")); },
    cancel,
  });
  const request = new Request("http://localhost", {
    method: "POST", body: stream, duplex: "half",
    headers: contentLength === undefined ? {} : { "content-length": contentLength },
  } as RequestInit);
  return { request, cancel };
}

describe("bounded request bodies", () => {
  it("accepts exact limits and an absent body", async () => {
    const request = new Request("http://localhost", { method: "POST", body: "abc" });
    expect(new TextDecoder().decode(await readBoundedRequestBody(request, 3))).toBe("abc");
    expect(await readBoundedRequestBody(new Request("http://localhost"), 3)).toHaveLength(0);
  });

  it.each([undefined, "1", "invalid"])("cancels actual oversized streams (declared length %s)", async (length) => {
    const { request, cancel } = streamedRequest(length);
    await expect(readBoundedRequestBody(request, 4)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
    expect(cancel).toHaveBeenCalledOnce();
    expect(request.body?.locked).toBe(false);
  });

  it("rejects and cancels a declared oversized body without parsing it", async () => {
    const { request, cancel } = streamedRequest("5");
    await expect(readBoundedRequestBody(request, 4)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
    expect(cancel).toHaveBeenCalledOnce();
  });
});
