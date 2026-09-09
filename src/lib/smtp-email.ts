import nodemailer from "nodemailer";
import { Socket } from "node:net";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { EmailDeliveryError, type TransactionalEmailMessage, type TransactionalEmailProvider } from "@/lib/transactional-email";
import { isSingleEmailAddress, type SmtpEmailConfig } from "@/lib/email-config";
export { getSmtpEmailConfig } from "@/lib/email-config";

// Transport construction does not connect. No logger/debug, URL or file access;
// verification is intentionally not used as a substitute for a delivered email.
export function createSmtpTransport(config: SmtpEmailConfig) {
  // SMTPTransport.close() only releases transport-level resources. Own the
  // underlying socket so our deadline also stops an in-flight SMTP/TLS session.
  // Nodemailer still performs DNS, connection setup and required TLS upgrades.
  const socket = new Socket();
  const transport = nodemailer.createTransport({
    socket,
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: true,
    auth: { user: config.user, pass: config.password },
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    dnsTimeout: 10_000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  });
  const close = transport.close.bind(transport);
  transport.close = () => {
    socket.destroy();
    close();
  };
  return transport;
}

type SmtpTransport = Pick<ReturnType<typeof createSmtpTransport>, "sendMail" | "close">;

export function classifySmtpError(error: unknown): EmailDeliveryError {
  if (error instanceof EmailDeliveryError) return error;
  const value = error as Partial<SMTPTransport.SentMessageInfo & { code: string; command: string; responseCode: number }> | null;
  const code = value?.code;
  const responseCode = value?.responseCode;
  const command = value?.command?.toUpperCase() ?? "";
  // A negative SMTP response is explicit rejection, including DATA rejection.
  if (responseCode && responseCode >= 400 && responseCode < 500) return new EmailDeliveryError("retry", "SmtpTemporaryRejection");
  if (responseCode && responseCode >= 500 && responseCode < 600) return new EmailDeliveryError("failed", "SmtpPermanentRejection");
  if (["EAUTH", "ENOAUTH", "ETLS", "ECONFIG", "EENVELOPE", "EMAXRECIPIENTS"].includes(code ?? "")) {
    return new EmailDeliveryError("failed", "SmtpConfigurationOrEnvelopeRejected");
  }
  // Network failure is retryable only when known to precede message transfer.
  if (code === "EDNS" || ["CONN", "EHLO", "HELO", "STARTTLS", "MAIL FROM", "RCPT TO"].includes(command) || command.startsWith("AUTH ")) {
    return new EmailDeliveryError("retry", "SmtpFailureBeforeData");
  }
  return new EmailDeliveryError("uncertain", "SmtpAcceptanceUnknown");
}

export function assertEmailRecipientAllowed(message: TransactionalEmailMessage, config: SmtpEmailConfig) {
  if (!isSingleEmailAddress(message.to)) throw new EmailDeliveryError("failed", "InvalidEmailRecipient");
  if (config.mode === "test" && !config.testRecipients.has(message.to.toLowerCase())) {
    throw new EmailDeliveryError("failed", "EmailRecipientNotAllowlisted");
  }
  if (message.replyTo && !isSingleEmailAddress(message.replyTo)) throw new EmailDeliveryError("failed", "InvalidReplyTo");
}

export function createSmtpEmailProvider(
  config: SmtpEmailConfig,
  createTransport: (config: SmtpEmailConfig) => SmtpTransport = createSmtpTransport,
): TransactionalEmailProvider {
  return {
    name: "smtp",
    async send(message, messageId) {
      assertEmailRecipientAllowed(message, config);
      if (!/^<rare-[a-f0-9]{64}@raredept\.com\.br>$/.test(messageId)) {
        throw new EmailDeliveryError("failed", "InvalidEmailMessageId");
      }
      const transport = createTransport(config);
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          transport.sendMail({
            from: { name: "RARE", address: config.from },
            to: { address: message.to, name: "" },
            replyTo: message.replyTo ?? config.replyTo,
            envelope: { from: config.from, to: [message.to] },
            subject: message.subject.replace(/[\r\n]/g, " "),
            text: message.text,
            html: message.html,
            messageId,
            disableFileAccess: true,
            disableUrlAccess: true,
          }),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => {
              transport.close();
              reject(new EmailDeliveryError("uncertain", "SmtpDeadlineExceeded"));
            }, 45_000);
          }),
        ]);
        const accepted = result.accepted.map((value) => value.toLowerCase());
        if (!accepted.includes(message.to.toLowerCase()) || result.rejected.length) {
          throw new EmailDeliveryError("uncertain", "SmtpAcceptanceUnconfirmed");
        }
        return { id: messageId };
      } catch (error) {
        throw classifySmtpError(error);
      } finally {
        if (timeout) clearTimeout(timeout);
        transport.close();
      }
    },
  };
}
