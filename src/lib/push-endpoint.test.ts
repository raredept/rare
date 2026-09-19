import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint } from "@/lib/push-endpoint";

describe("isAllowedPushEndpoint", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
    "https://web.push.apple.com/abc",
  ])("accepts %s", (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://127.0.0.1/x",
    "https://localhost/x",
    "https://169.254.169.254/latest/meta-data",
    "https://redis.railway.internal/x",
    "https://fcm.googleapis.com.evil.example/x",
    "https://evil.example/fcm.googleapis.com",
    "https://user:pass@fcm.googleapis.com/x",
    "https://fcm.googleapis.com:8443/x",
    "javascript:alert(1)",
    "not a url",
  ])("rejects %s", (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });
});
