// Pure browser-side helpers for the Admin Web Push control. They take plain
// values instead of reading `window` so the iOS/standalone decisions can be
// unit-tested without a DOM.

export type PushEnvironmentInput = {
  userAgent: string;
  maxTouchPoints: number;
  displayModeStandalone: boolean;
  navigatorStandalone: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
};

export type PushEnvironment =
  // iPhone/iPad in a Safari tab: Web Push only exists in the Home Screen web app.
  | "install_required"
  // Browser (or iOS older than 16.4 in standalone) without the Push API.
  | "unsupported"
  | "supported";

export function isAppleMobileDevice(userAgent: string, maxTouchPoints: number) {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  // iPadOS 13+ reports a desktop Mac user agent; touch support tells them apart.
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

export function detectPushEnvironment(input: PushEnvironmentInput): PushEnvironment {
  const standalone = input.displayModeStandalone || input.navigatorStandalone;
  if (isAppleMobileDevice(input.userAgent, input.maxTouchPoints) && !standalone) return "install_required";
  if (!input.hasServiceWorker || !input.hasPushManager || !input.hasNotification) return "unsupported";
  return "supported";
}

export function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

// A subscription created with an older VAPID public key can no longer receive
// pushes signed with the current private key, so it has to be recreated.
// Browsers that do not expose the key are treated as matching.
export function subscriptionMatchesServerKey(subscriptionKey: ArrayBuffer | null | undefined, publicKey: string) {
  if (!subscriptionKey) return true;
  let expected: Uint8Array;
  try {
    expected = urlBase64ToUint8Array(publicKey);
  } catch {
    return false;
  }
  const actual = new Uint8Array(subscriptionKey);
  if (actual.length !== expected.length) return false;
  return actual.every((byte, index) => byte === expected[index]);
}
