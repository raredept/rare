import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  detectPushEnvironment,
  isAppleMobileDevice,
  subscriptionMatchesServerKey,
  urlBase64ToUint8Array,
  type PushEnvironmentInput,
} from "@/lib/admin-push-client";

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";
const CHROME_WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const capable = { hasServiceWorker: true, hasPushManager: true, hasNotification: true };

function env(overrides: Partial<PushEnvironmentInput>): PushEnvironmentInput {
  return {
    userAgent: CHROME_WINDOWS,
    maxTouchPoints: 0,
    displayModeStandalone: false,
    navigatorStandalone: false,
    ...capable,
    ...overrides,
  };
}

describe("detectPushEnvironment", () => {
  it("asks an iPhone in a Safari tab to install the Home Screen app first", () => {
    // In a Safari tab iOS exposes no PushManager/Notification at all.
    expect(detectPushEnvironment(env({ userAgent: IPHONE_SAFARI, maxTouchPoints: 5, hasPushManager: false, hasNotification: false })))
      .toBe("install_required");
  });

  it("asks an iPad (desktop user agent + touch) in Safari to install first", () => {
    expect(detectPushEnvironment(env({ userAgent: IPAD_DESKTOP_UA, maxTouchPoints: 5 }))).toBe("install_required");
  });

  it("does not mistake a desktop Mac for an iPad", () => {
    expect(detectPushEnvironment(env({ userAgent: IPAD_DESKTOP_UA, maxTouchPoints: 0 }))).toBe("supported");
  });

  it.each([
    ["display-mode: standalone", { displayModeStandalone: true }],
    ["navigator.standalone", { navigatorStandalone: true }],
  ])("allows push in the iPhone Home Screen app (%s)", (_label, overrides) => {
    expect(detectPushEnvironment(env({ userAgent: IPHONE_SAFARI, maxTouchPoints: 5, ...overrides }))).toBe("supported");
  });

  it("reports an installed app on iOS older than 16.4 as unsupported", () => {
    expect(detectPushEnvironment(env({ userAgent: IPHONE_SAFARI, maxTouchPoints: 5, displayModeStandalone: true, hasPushManager: false })))
      .toBe("unsupported");
  });

  it("supports desktop browsers with the Push API and rejects those without it", () => {
    expect(detectPushEnvironment(env({}))).toBe("supported");
    expect(detectPushEnvironment(env({ hasServiceWorker: false }))).toBe("unsupported");
    expect(detectPushEnvironment(env({ hasNotification: false }))).toBe("unsupported");
  });

  it("recognises Apple mobile user agents", () => {
    expect(isAppleMobileDevice(IPHONE_SAFARI, 5)).toBe(true);
    expect(isAppleMobileDevice(IPAD_DESKTOP_UA, 5)).toBe(true);
    expect(isAppleMobileDevice(IPAD_DESKTOP_UA, 0)).toBe(false);
    expect(isAppleMobileDevice(CHROME_WINDOWS, 10)).toBe(false);
  });
});

describe("VAPID key helpers", () => {
  const publicKey = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

  it("decodes a base64url VAPID public key to the 65-byte uncompressed point", () => {
    const bytes = urlBase64ToUint8Array(publicKey);
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(4);
  });

  it("detects a subscription created with a different VAPID key", () => {
    const same = urlBase64ToUint8Array(publicKey);
    const other = new Uint8Array(same);
    other[10] ^= 0xff;

    expect(subscriptionMatchesServerKey(same.buffer, publicKey)).toBe(true);
    expect(subscriptionMatchesServerKey(other.buffer, publicKey)).toBe(false);
    expect(subscriptionMatchesServerKey(new Uint8Array(3).buffer, publicKey)).toBe(false);
    // Browsers that do not expose the key: assume it matches.
    expect(subscriptionMatchesServerKey(null, publicKey)).toBe(true);
  });
});

// Static guarantees of the Admin control that a DOM-less unit test can still prove.
describe("AdminPushSubscriptionControl (static contract)", () => {
  // Full-line comments are dropped so only executable code is checked.
  const source = readFileSync(path.join(process.cwd(), "src/components/admin/admin-push-subscription-control.tsx"), "utf8")
    .split(/\r?\n/)
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");

  it("only requests notification permission inside the click handler", () => {
    const calls = source.match(/Notification\.requestPermission\(/g) ?? [];
    expect(calls).toHaveLength(1);
    const enableBody = source.slice(source.indexOf("async function enablePush()"), source.indexOf("async function disablePush()"));
    expect(enableBody).toContain("Notification.requestPermission(");
    const effectBody = source.slice(source.indexOf("useEffect("), source.indexOf("async function enablePush()"));
    expect(effectBody).not.toContain("requestPermission");
    expect(effectBody).not.toContain("pushManager.subscribe");
  });

  it("asks for permission before any other await in the click handler", () => {
    const enableBody = source.slice(source.indexOf("async function enablePush()"), source.indexOf("async function disablePush()"));
    expect(enableBody.indexOf("await")).toBe(enableBody.indexOf("await Notification.requestPermission("));
  });

  it("creates only user-visible subscriptions", () => {
    expect(source).toContain("userVisibleOnly: true");
  });

  it("shows every state label in Portuguese with accents", () => {
    for (const label of [
      "Não configurado",
      "Instale na Tela de Início",
      "Permissão bloqueada",
      "Desativado",
      "Ativando...",
      "Ativo neste dispositivo",
      "Erro",
      "Ativar neste celular",
      "Desativar neste celular",
      "Enviar notificação de teste",
    ]) {
      expect(source).toContain(label);
    }
  });

  it("explains the iPhone Home Screen installation step by step", () => {
    for (const step of [
      "Abra esta página no Safari.",
      "Toque em Compartilhar.",
      "Adicionar à Tela de Início",
      "Abra a RARE pelo ícone criado.",
      "Entre no Admin.",
      "Ativar neste celular",
    ]) {
      expect(source).toContain(step);
    }
  });
});
