"use client";

import { ArrowUp, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ASSISTANT_LIMITS } from "@/lib/assistant/limits";
import type { PublicAssistantBootstrap } from "@/lib/assistant/store";

// RARE Assistant conversation panel (lazy chunk). The conversation lives only in this component's
// memory for the current page: no cookie, localStorage, sessionStorage, database or analytics.
// Every text is rendered as React text (never as HTML).

type Cta = { label: string; href: string };
type NewMessage = { role: "user"; text: string } | { role: "assistant"; text: string; cta: Cta | null; tone?: "error" };
type Message = NewMessage & { id: number };

type AnswerPayload = { matched: boolean; answer: string; category: string | null; cta: Cta | null };

const MAX_MESSAGES = 40;

function isAnswerPayload(value: unknown): value is AnswerPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  const cta = payload.cta as Record<string, unknown> | null | undefined;
  return (
    typeof payload.answer === "string" &&
    typeof payload.matched === "boolean" &&
    (cta === null || cta === undefined || (typeof cta === "object" && typeof cta.label === "string" && typeof cta.href === "string"))
  );
}

/** Same rule as the Admin validation: a path on this site or an https URL. Anything else is dropped. */
function safeCta(cta: Cta | null | undefined): Cta | null {
  if (!cta) return null;
  const href = cta.href.trim();
  if (href.startsWith("/") && !href.startsWith("//") && !href.includes("\\")) return { label: cta.label, href };
  try {
    const url = new URL(href);
    return url.protocol === "https:" ? { label: cta.label, href: url.toString() } : null;
  } catch {
    return null;
  }
}

function CtaLink({ cta }: { cta: Cta }) {
  const className =
    "mt-3 inline-flex min-h-11 items-center justify-center rounded-lg border border-black bg-black px-4 text-xs font-black uppercase tracking-[0.14em] text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2";
  if (cta.href.startsWith("/")) {
    return (
      <Link href={cta.href} className={className}>
        {cta.label}
      </Link>
    );
  }
  return (
    <a href={cta.href} className={className} target="_blank" rel="noopener noreferrer">
      {cta.label}
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  );
}

export function AssistantPanel({
  id,
  open,
  bootstrap,
  onClose,
}: {
  id: string;
  open: boolean;
  bootstrap: PublicAssistantBootstrap;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const nextId = useRef(1);
  const titleId = useId();
  const inputId = useId();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Esc also works when focus fell back to the page body (e.g. a control that just got disabled).
  const sectionRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const active = document.activeElement;
      if (active === document.body || active === null || sectionRef.current?.contains(active)) {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, pending]);

  const push = useCallback((message: NewMessage) => {
    const withId: Message = { ...message, id: nextId.current++ };
    setMessages((current) => [...current, withId].slice(-MAX_MESSAGES));
  }, []);

  const ask = useCallback(
    async (raw: string) => {
      const text = raw.replace(/\s+/g, " ").trim().slice(0, ASSISTANT_LIMITS.message);
      if (!text || pending) return;
      push({ role: "user", text });
      setDraft("");
      setPending(true);
      // The send button disables while waiting: keep the keyboard in the conversation.
      inputRef.current?.focus({ preventScroll: true });
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const response = await fetch("/api/assistant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: text }),
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => null);
        if (response.ok && isAnswerPayload(payload)) {
          push({ role: "assistant", text: payload.answer, cta: safeCta(payload.cta) });
        } else if (response.status === 429) {
          push({ role: "assistant", text: "Muitas perguntas seguidas. Aguarde um instante e tente de novo.", cta: null, tone: "error" });
        } else {
          push({ role: "assistant", text: "Não consegui responder agora. Tente novamente em instantes.", cta: null, tone: "error" });
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        push({ role: "assistant", text: "Não consegui responder agora. Verifique sua conexão e tente de novo.", cta: null, tone: "error" });
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setPending(false);
        }
      }
    },
    [pending, push],
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(draft);
  }

  const showSuggestions = bootstrap.suggestions.length > 0 && !messages.some((message) => message.role === "user");

  return (
    <section
      id={id}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      hidden={!open}
      ref={sectionRef}
      data-assistant-panel
      className="assistant-panel fixed z-[60] flex flex-col overflow-hidden rounded-lg border border-neutral-300 bg-white text-neutral-950 shadow-[0_24px_70px_rgba(0,0,0,0.32)]"
    >
      <header className="flex items-center justify-between gap-3 bg-black px-4 py-3 text-white">
        <h2 id={titleId} className="min-w-0 truncate text-sm font-black uppercase tracking-[0.16em]">
          {bootstrap.displayName}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Fechar ${bootstrap.displayName}`}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </header>

      <div ref={logRef} role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversa" className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
        <p className="max-w-[90%] whitespace-pre-line rounded-lg bg-neutral-100 px-3.5 py-2.5 text-sm font-semibold leading-6 text-neutral-900">{bootstrap.welcomeMessage}</p>

        {showSuggestions ? (
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-neutral-600">Perguntas frequentes</p>
            <ul className="flex flex-col items-start gap-2">
              {bootstrap.suggestions.map((suggestion) => (
                <li key={suggestion} className="max-w-full">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void ask(suggestion)}
                    className="min-h-11 max-w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-left text-sm font-bold text-neutral-900 transition-colors hover:border-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 disabled:opacity-60"
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-line rounded-lg bg-black px-3.5 py-2.5 text-sm font-semibold leading-6 text-white" data-assistant-message="user">
                <span className="sr-only">Você: </span>
                {message.text}
              </p>
            </div>
          ) : (
            <div key={message.id} className="max-w-[90%]" data-assistant-message="assistant">
              <p className={`whitespace-pre-line rounded-lg px-3.5 py-2.5 text-sm font-semibold leading-6 ${message.tone === "error" ? "border border-neutral-300 bg-white text-neutral-800" : "bg-neutral-100 text-neutral-900"}`}>
                <span className="sr-only">{bootstrap.displayName}: </span>
                {message.text}
              </p>
              {message.cta ? <CtaLink cta={message.cta} /> : null}
            </div>
          ),
        )}

        {pending ? (
          <p className="inline-flex items-center gap-2 text-xs font-bold text-neutral-600" aria-live="off">
            <Loader2 aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
            Procurando a resposta…
          </p>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-neutral-200 bg-white p-3">
        <label htmlFor={inputId} className="sr-only">
          Sua pergunta
        </label>
        <input
          ref={inputRef}
          id={inputId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={ASSISTANT_LIMITS.message}
          placeholder={bootstrap.inputPlaceholder}
          autoComplete="off"
          enterKeyHint="send"
          className="h-12 min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3.5 text-base font-semibold text-neutral-950 placeholder:text-neutral-500 focus:border-neutral-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          aria-label="Enviar pergunta"
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-black text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-neutral-400"
        >
          <ArrowUp aria-hidden="true" className="h-5 w-5" />
        </button>
      </form>
    </section>
  );
}
