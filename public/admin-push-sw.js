// RARE Admin Web Push service worker (scope /admin/).
//
// Safari/iOS revokes the subscription of a site that receives a push without
// showing a notification, so every push event shows one, even when the payload
// is missing or malformed. Clicks only ever open same-origin /admin/* URLs.

var FALLBACK_TITLE = "RARE Admin";
var FALLBACK_BODY = "Nova notificação administrativa.";
var FALLBACK_URL = "/admin/notifications";
var FALLBACK_ICON = "/brand/rare-logo.png";
var FALLBACK_BADGE = "/brand/favicon.ico";
var FALLBACK_TAG = "rare-admin-notification";

function cleanText(value, fallback, maxLength) {
  if (typeof value !== "string") return fallback;
  var trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

// Icons must be same-origin paths; anything else falls back to the RARE icon.
function cleanAssetPath(value, fallback) {
  if (typeof value !== "string" || value.charAt(0) !== "/" || value.charAt(1) === "/" || value.charAt(1) === "\\") {
    return fallback;
  }
  try {
    var url = new URL(value, self.location.origin);
    return url.origin === self.location.origin ? url.pathname : fallback;
  } catch {
    return fallback;
  }
}

// Returns an absolute same-origin URL under /admin, or the notifications page.
function resolveAdminUrl(value) {
  var fallback = new URL(FALLBACK_URL, self.location.origin).href;
  if (typeof value !== "string" || !value) return fallback;
  try {
    var url = new URL(value, self.location.origin);
    var adminPath = url.pathname === "/admin" || url.pathname.indexOf("/admin/") === 0;
    if (url.origin !== self.location.origin || !adminPath) return fallback;
    return url.href;
  } catch {
    return fallback;
  }
}

function readPayload(event) {
  if (!event.data) return {};
  try {
    var parsed = event.data.json();
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

self.addEventListener("install", function () {
  // A fixed service worker should replace the old one without waiting for every Admin tab to close.
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", function (event) {
  var payload = readPayload(event);
  var title = cleanText(payload.title, FALLBACK_TITLE, 120);
  var options = {
    body: cleanText(payload.body, FALLBACK_BODY, 240),
    icon: cleanAssetPath(payload.icon, FALLBACK_ICON),
    badge: cleanAssetPath(payload.badge, FALLBACK_BADGE),
    tag: cleanText(payload.tag, FALLBACK_TAG, 120),
    data: {
      url: resolveAdminUrl(payload.url),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  // Re-validated on click: never trust what is stored in the notification.
  var targetUrl = resolveAdminUrl(event.notification.data && event.notification.data.url);

  // The Admin session is not touched here: if it expired, the normal login/MFA flow runs.
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        for (var index = 0; index < clientList.length; index += 1) {
          var client = clientList[index];
          if (client.url === targetUrl && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      }),
  );
});
