type RequestOriginSource = Pick<Request, "headers" | "url">;

export function isSameOriginRequest(request: RequestOriginSource) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host")?.trim() || new URL(request.url).host;
  if (!origin || !host) return false;

  try {
    const parsedOrigin = new URL(origin);
    const allowedProtocol =
      parsedOrigin.protocol === "https:" ||
      (process.env.NODE_ENV !== "production" && parsedOrigin.protocol === "http:");

    return allowedProtocol && parsedOrigin.host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}
