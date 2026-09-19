// The server POSTs sale notifications to every stored endpoint. An arbitrary URL
// would turn a stored subscription into a server-side request to internal hosts,
// so only the public push services used by browsers are accepted.
const pushServiceHostPatterns = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.push\.services\.mozilla\.com$/,
  /^[a-z0-9.-]+\.notify\.windows\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9.-]+\.push\.apple\.com$/,
];

export function isAllowedPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return false;
    return pushServiceHostPatterns.some((pattern) => pattern.test(url.hostname.toLowerCase()));
  } catch {
    return false;
  }
}
