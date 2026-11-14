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
          <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 xl:px-10">
            <p className="max-w-3xl text-sm font-semibold leading-6 text-neutral-700">
              Usamos cookies essenciais para a loja funcionar. Com a sua permissão, também medimos o uso do site (páginas e produtos vistos), sem ferramentas de
              terceiros e sem identificar você. Veja a{" "}
              <Link href="/politica-de-cookies" className="font-black text-neutral-950 underline underline-offset-4">
                Política de Cookies
              </Link>
              .
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:shrink-0 lg:flex-nowrap">
              <button type="button" className={primaryButton} onClick={() => decide(true, true)}>
                Aceitar
              </button>
              <button type="button" className={primaryButton} onClick={() => decide(false, true)}>
                Recusar não essenciais
              </button>
              <button type="button" className={secondaryButton} onClick={openCookiePreferences}>
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
                <ul className="mt-3 grid gap-3">
                  {category.entries.map((entry) => (
                    <li key={entry.name} className="rounded-lg bg-neutral-50 p-3 text-sm">
                      <p className="break-all font-mono text-xs font-bold text-neutral-950">{entry.name}</p>
                      <p className="mt-1 font-semibold leading-6 text-neutral-700">{entry.purpose}</p>
                      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs font-semibold text-neutral-700 sm:grid-cols-3">
                        <div>
                          <dt className="font-black uppercase tracking-wide text-neutral-600">Tipo</dt>
                          <dd>{kindLabels[entry.kind]}</dd>
                        </div>
                        <div>
                          <dt className="font-black uppercase tracking-wide text-neutral-600">Duração</dt>
                          <dd>{entry.duration}</dd>
                        </div>
                        <div>
                          <dt className="font-black uppercase tracking-wide text-neutral-600">Origem</dt>
                          <dd>{entry.party}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
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
