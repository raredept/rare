import { describe, expect, it, vi } from "vitest";
import { onRequestError } from "@/instrumentation";

describe("Next instrumentation", () => {
  it("logs action execution failures without copying errors or request headers", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await onRequestError(
      new Error("Bearer private-token for person@example.com"),
      {
        path: "/admin/produtos?token=private",
        method: "POST",
        headers: {
          "next-action": "private-action-id",
          cookie: "private-cookie",
          authorization: "Bearer private-token",
          "x-rare-request-id": "request-123",
        },
      },
      {
        routerKind: "App Router",
        routePath: "/admin/produtos",
        routeType: "action",
        revalidateReason: undefined,
      },
    );
    const serialized = JSON.stringify(consoleError.mock.calls);

    expect(consoleError).toHaveBeenCalledWith(
      "[RARE server action] execution error",
      expect.objectContaining({
        category: "server_action_execution_error",
        requestId: "request-123",
        route: "/admin/produtos",
        method: "POST",
      }),
    );
    expect(serialized).not.toMatch(/private-token|person@example\.com|private-action-id|private-cookie|authorization|cookie/);
    consoleError.mockRestore();
  });

  it("does not classify unrelated render errors as Server Action failures", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await onRequestError(
      new Error("render failure"),
      { path: "/", method: "GET", headers: {} },
      { routerKind: "App Router", routePath: "/", routeType: "render", revalidateReason: undefined },
    );

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
