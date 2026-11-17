"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { COOKIE_CATALOG, parseCookieConsent } from "@/lib/cookie-consent";
import {
  COOKIE_PREFERENCES_OPEN_EVENT,
  getConsentSnapshot,
  openCookiePreferences,
  storeConsent,
  subscribeToConsent,
} from "@/lib/cookie-consent-client";

const SERVER_SNAPSHOT = "server";

const primaryButton =
  "inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-black bg-black px-4 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 sm:w-auto";
const secondaryButton =
  "inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-neutral-400 bg-white px-4 text-xs font-black uppercase tracking-[0.14em] text-neutral-950 transition hover:border-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 sm:w-auto";

const kindLabels = { cookie: "Cookie", localStorage: "Armazenamento local", sessionStorage: "Armazenamento da sessão" } as const;

function focusMainContent() {
  document.getElementById("store-main")?.focus({ preventScroll: true });
}

/**
 * Cookie banner and preferences panel. Refusing is one click, with the same weight as accepting.
 * Nothing optional runs until a choice is stored; the choice can be changed at any time from the
 * footer ("Preferências de Cookies").
 */
export function CookieConsent() {
  const snapshot = useSyncExternalStore(subscribeToConsent, getConsentSnapshot, () => SERVER_SNAPSHOT);
  const consent = snapshot === SERVER_SNAPSHOT ? null : parseCookieConsent(snapshot);
  const undecided = snapshot !== SERVER_SNAPSHOT && !consent;
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [analyticsChoice, setAnalyticsChoice] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const switchId = useId();

  const openPanel = useCallback(() => {
    setAnalyticsChoice(parseCookieConsent(getConsentSnapshot())?.analytics ?? false);
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    window.addEventListener(COOKIE_PREFERENCES_OPEN_EVENT, openPanel);
    return () => window.removeEventListener(COOKIE_PREFERENCES_OPEN_EVENT, openPanel);
  }, [openPanel]);

  const decide = useCallback((analytics: boolean, fromBanner: boolean) => {
    storeConsent(analytics);
    dialogRef.current?.close();
    // The banner disappears with the decision: leave the keyboard on the page content.
    if (fromBanner) focusMainContent();
  }, []);

  return (
    <>
      {undecided ? (
        <section aria-label="Aviso de cookies" data-cookie-banner className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-300 bg-white text-neutral-950 shadow-[0_-12px_40px_rgba(0,0,0,0.12)]">
          {/* UIUX-COOKIES-002: short text and the two choices side by side, so the banner no longer
              covers half of a phone screen. Accept and refuse keep the same weight. */}
          <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-3 sm:px-6 sm:py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8 xl:px-10">
            <p className="max-w-3xl text-sm font-semibold leading-6 text-neutral-700">
              Usamos cookies essenciais e, com sua permissão, medimos o uso do site sem identificar você.{" "}
              <Link href="/politica-de-cookies" className="font-black text-neutral-950 underline underline-offset-4">
                Política de Cookies
              </Link>
            </p>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center lg:shrink-0 lg:flex-nowrap">
              <button type="button" className={primaryButton} onClick={() => decide(true, true)}>
                Aceitar
              </button>
              <button type="button" className={primaryButton} onClick={() => decide(false, true)}>
                Recusar não essenciais
              </button>
              <button
                type="button"
                className="col-span-2 inline-flex min-h-11 items-center justify-center px-2 text-xs font-black uppercase tracking-[0.14em] text-neutral-800 underline underline-offset-4 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 sm:col-span-1"
                onClick={openCookiePreferences}
              >
                Configurar
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        data-cookie-preferences
        // Esc always closes (the native cancel can be swallowed by the browser's close-watcher rules).
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            dialogRef.current?.close();
          }
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto rounded-lg border border-neutral-300 bg-white p-0 text-neutral-950 shadow-2xl backdrop:bg-black/60"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-xl font-black tracking-tight">
              Preferências de Cookies
            </h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-neutral-300 px-3 text-xs font-black uppercase tracking-[0.14em] text-neutral-950 transition hover:border-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
            >
              Fechar
            </button>
          </div>
          <p id={descriptionId} className="mt-3 text-sm font-semibold leading-6 text-neutral-700">
            Escolha o que a RARE pode guardar neste navegador. Os essenciais ficam sempre ativos; a análise de uso só funciona se você permitir. Você pode mudar de
            ideia a qualquer momento em “Preferências de Cookies”, no rodapé.
          </p>

          <div className="mt-5 grid gap-4">
            {COOKIE_CATALOG.map((category) => (
              <section key={category.id} aria-label={category.label} className="rounded-lg border border-neutral-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-base font-black">{category.label}</h3>
                  {category.required ? (
                    <span className="rounded-full border border-neutral-300 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-neutral-700">Sempre ativos</span>
                  ) : (
                    <label htmlFor={switchId} className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm font-black">
                      <input
                        id={switchId}
                        type="checkbox"
                        role="switch"
                        checked={analyticsChoice}
                        onChange={(event) => setAnalyticsChoice(event.target.checked)}
                        className="h-5 w-5 accent-black"
                      />
                      <span>{analyticsChoice ? "Permitida" : "Desativada"}</span>
                    </label>
                  )}
                </div>
                <p className="mt-2 text-sm font-semibold leading-6 text-neutral-700">{category.purpose}</p>
                {/* UIUX-COOKIES-001: plain language first (what it does, for how long); the technical
                    names stay one click away. Store-team (Admin) entries are only in the policy. */}
                <ul className="mt-3 grid gap-2">
                  {category.entries.filter((entry) => entry.audience !== "staff").map((entry) => (
                    <li key={entry.name} className="flex flex-col gap-0.5 rounded-lg bg-neutral-50 px-3 py-2 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                      <span className="font-semibold leading-6 text-neutral-800">{entry.purpose}</span>
                      <span className="shrink-0 text-xs font-bold text-neutral-600">{entry.duration}</span>
                    </li>
                  ))}
                </ul>
                <details className="mt-3 text-xs">
                  <summary className="inline-flex min-h-11 cursor-pointer items-center font-black uppercase tracking-[0.12em] text-neutral-700 hover:text-neutral-950">
                    Ver detalhes técnicos
                  </summary>
                  <ul className="mt-1 grid gap-1.5">
                    {category.entries.filter((entry) => entry.audience !== "staff").map((entry) => (
                      <li key={entry.name} className="flex flex-wrap gap-x-3 gap-y-0.5 font-semibold text-neutral-700">
                        <span className="break-all font-mono font-bold text-neutral-950">{entry.name}</span>
                        <span>{kindLabels[entry.kind]} · {entry.party}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </section>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button type="button" className={primaryButton} onClick={() => decide(analyticsChoice, undecided)}>
              Salvar preferências
            </button>
            <button type="button" className={secondaryButton} onClick={() => decide(true, undecided)}>
              Aceitar todos
            </button>
            <button type="button" className={secondaryButton} onClick={() => decide(false, undecided)}>
              Recusar não essenciais
            </button>
          </div>
          <p className="mt-4 text-xs font-semibold text-neutral-600">
            Detalhes na{" "}
            <Link href="/politica-de-cookies" className="font-black text-neutral-950 underline underline-offset-4" onClick={() => dialogRef.current?.close()}>
              Política de Cookies
            </Link>
            .
          </p>
        </div>
      </dialog>
    </>
  );
}

/** Footer entry point: reopens the panel so a decision can be changed or withdrawn. */
export function CookiePreferencesButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={openCookiePreferences} className={className}>
      Preferências de Cookies
    </button>
  );
}
