import { createServer, type Socket } from "node:net";
import { once } from "node:events";
import { expect, it } from "vitest";
import { createSmtpTransport } from "@/lib/smtp-email";
import type { SmtpEmailConfig } from "@/lib/email-config";

it("closes an active real SMTP connection when the delivery deadline closes its transport", async () => {
  // Loopback only. Stall before EHLO completes: no AUTH, recipient or message
  // can reach this test server, and no external mail server is contacted.
  const peers = new Set<Socket>();
  let observedCommands = "";
  const server = createServer((peer) => {
    peers.add(peer);
    peer.on("data", (chunk) => { observedCommands += String(chunk); });
    peer.write("220 local cancellation test\r\n");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing loopback port.");
  const config: SmtpEmailConfig = {
    driver: "smtp", host: "127.0.0.1", port: address.port as 587,
    user: "synthetic@example.com", password: "synthetic-not-a-credential",
    from: "synthetic@example.com", mode: "test",
    testRecipients: new Set(["controlled@example.com"]), sendNotBefore: new Date(0),
  };
  const transport = createSmtpTransport(config);
  let outcome: Promise<unknown> | undefined;
  try {
    const connected = once(server, "connection");
    // Capture rejection immediately; closing an unfinished exchange is expected.
    outcome = transport.sendMail({ from: config.from, to: "controlled@example.com", text: "Never transferred" }).catch((error: unknown) => error);
    const [peer] = await connected as [Socket];
    await once(peer, "data");
    const disconnected = once(peer, "close");
    transport.close();
    await disconnected;
    expect(await outcome).toBeInstanceOf(Error);
    expect(observedCommands).toMatch(/^EHLO /);
    expect(observedCommands).not.toMatch(/AUTH|MAIL FROM|RCPT TO|DATA/);
    expect(peer.destroyed).toBe(true);
  } finally {
    transport.close();
    for (const peer of peers) peer.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await outcome;
  }
}, 10_000);
