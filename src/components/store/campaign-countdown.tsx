"use client";

import { useEffect, useState } from "react";

// Counts down to a REAL end instant from the server (ISO string). It never restarts: when the
// end passes it shows "Encerrada" and asks the router for fresh server data, where the campaign
// is no longer active. Screen readers get the end date, not a per-second announcement.

function remainingParts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
  };
}

export function CampaignCountdown({ endsAt, endsAtLabel }: { endsAt: string; endsAtLabel: string }) {
  const end = Date.parse(endsAt);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(end)) return;
    let timer = 0;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= end) {
        window.clearInterval(timer);
        // A full reload, not a client cache: the server decides the campaign is over.
        window.setTimeout(() => window.location.reload(), 1_500);
      }
    };
    const first = window.setTimeout(tick, 0);
    timer = window.setInterval(tick, 1_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [end]);

  if (!Number.isFinite(end)) return null;
  const parts = remainingParts(now === null ? 0 : end - now);
  const ended = now !== null && now >= end;
  const pad = (value: number) => String(value).padStart(2, "0");

  return (
    <div className="mt-6" role="timer" aria-live="off" aria-label={`Termina em ${endsAtLabel}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/70">{ended ? "Campanha encerrada" : "Termina em"}</p>
      {/* Server render shows placeholders: the client fills the time after hydration (no mismatch, no fake numbers). */}
      <dl className="mt-2 flex gap-2 font-mono text-white" aria-hidden="true">
        {([["dias", parts.days], ["h", parts.hours], ["min", parts.minutes], ["s", parts.seconds]] as const).map(([label, value]) => (
          <div key={label} className="min-w-14 rounded-md border border-white/20 bg-white/5 px-2 py-1.5 text-center">
            <dt className="sr-only">{label}</dt>
            <dd className="text-xl font-black tabular-nums sm:text-2xl">{now === null ? "--" : pad(value)}</dd>
            <span className="block text-[10px] uppercase tracking-widest text-white/60">{label}</span>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs font-semibold text-white/60">Até {endsAtLabel} (horário de Brasília)</p>
    </div>
  );
}
