"use client";

import { useEffect, useState } from "react";

type PixPaymentPanelProps = {
  copyPaste: string;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
  deadlineAt: string;
  serverNow: string;
};

export function PixPaymentPanel({ copyPaste, qrCodeBase64, ticketUrl, deadlineAt, serverNow }: PixPaymentPanelProps) {
  const [copied, setCopied] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    // Count against the SERVER clock, so a wrong device clock cannot extend or shorten the window.
    const offset = Date.parse(serverNow) - Date.now();
    const deadline = Date.parse(deadlineAt);
    const tick = () => setRemaining(Math.max(0, Math.ceil((deadline - (Date.now() + offset)) / 1000)));
    tick();
    const clock = window.setInterval(tick, 1000);
    return () => window.clearInterval(clock);
  }, [deadlineAt, serverNow]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyPaste);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 4000);
    } catch {
      setCopied(false);
    }
  }

  const expired = remaining === 0;

  return (
    <div className="mx-auto mt-6 max-w-md rounded-lg border border-neutral-200 bg-white p-5 text-left">
      {remaining !== null && !expired ? (
        <p className="text-sm font-semibold text-neutral-700">
          Pague em{" "}
          <span role="timer" aria-live="off" className="font-black tabular-nums text-neutral-950">
            {Math.floor(remaining / 60).toString().padStart(2, "0")}:{(remaining % 60).toString().padStart(2, "0")}
          </span>
          . Depois disso o Pix é encerrado e a reserva das peças é liberada.
        </p>
      ) : null}
      {expired ? (
        <p className="text-sm font-semibold text-neutral-700">O prazo deste Pix terminou. Estamos confirmando o encerramento; não pague este código.</p>
      ) : null}

      {!expired ? (
        <>
          {qrCodeBase64 ? (
            <img
              src={`data:image/png;base64,${qrCodeBase64}`}
              alt="QR code do Pix deste pedido"
              width={240}
              height={240}
              className="mx-auto mt-5 h-60 w-60"
            />
          ) : null}

          <label htmlFor="pix-copia-e-cola" className="mt-5 block text-xs font-black uppercase tracking-[0.18em] text-neutral-500">
            Pix copia e cola
          </label>
          <textarea
            id="pix-copia-e-cola"
            readOnly
            rows={4}
            value={copyPaste}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-2 w-full resize-none rounded-lg border border-neutral-300 bg-neutral-50 p-3 font-mono text-xs text-neutral-800 [overflow-wrap:anywhere]"
          />
          <button
            type="button"
            onClick={copy}
            className="mt-3 flex h-12 w-full items-center justify-center rounded-lg bg-black px-6 text-sm font-black uppercase tracking-wide text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          >
            Copiar código
          </button>
          <p role="status" aria-live="polite" className="mt-2 min-h-5 text-center text-xs font-bold text-neutral-600">
            {copied ? "Código copiado. Cole no app do seu banco, na área Pix." : ""}
          </p>
          {ticketUrl ? (
            <p className="mt-2 text-center text-xs font-bold text-neutral-500">
              <a href={ticketUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-neutral-950">
                Abrir o Pix na página do Mercado Pago
              </a>
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
