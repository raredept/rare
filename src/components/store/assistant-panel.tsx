"use client";

import { ArrowRight, ArrowUp, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { firstOfEachRole, splitWelcomeMessage } from "@/components/store/assistant/welcome";
import { ASSISTANT_LIMITS } from "@/lib/assistant/limits";
import type { PublicAssistantBootstrap } from "@/lib/assistant/store";

// RARE Assistant conversation panel (lazy chunk). The conversation lives only in this component's
// memory for the current page: no cookie, localStorage, sessionStorage, database or analytics.
// Every text is rendered as React text (never as HTML).
// RARE-ASSISTANT-UIUX-02: presentation only (layout, motion states, typing, labels). The request,
// the answer handling, the CTA safety rule and every functional message are unchanged.

type Cta = { label: string; href: string };
type NewMessage = { role: "user"; text: string } | { role: "assistant"; text: string; cta: Cta | null; tone?: "error" };
type Message = NewMessage & { id: number };

type AnswerPayload = { matched: boolean; answer: string; category: string | null; cta: Cta | null };

const MAX_MESSAGES = 40;
/** Exit motion length (globals.css `assistant-panel-out`), plus a frame of margin. */
const PANEL_EXIT_MS = 180;

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
  const className = "assistant-cta group/cta";
  const content = (
    <>
      <span>{cta.label}</span>
      <ArrowRight aria-hidden="true" className="assistant-cta-arrow h-4 w-4 shrink-0" strokeWidth={2.25} />
    </>
  );
  if (cta.href.startsWith("/")) {
    return (
      <Link href={cta.href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <a href={cta.href} className={className} target="_blank" rel="noopener noreferrer">
      {content}
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  );
}

/** Small author label above the first message of each side. Decorative: the sr-only prefix in the bubble names the author. */
function AuthorLabel({ children, align }: { children: string; align: "start" | "end" }) {
  return (
    <p aria-hidden="true" className={`assistant-author ${align === "end" ? "text-right" : ""}`}>
      {children}
    </p>
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

  // Visual state only: "closing" keeps the panel on screen (inert) for its exit motion, then it is
  // hidden like before. Opening and closing are still driven by the launcher's `open`.
  const [shown, setShown] = useState(open);
  if (open && !shown) setShown(true);
  useEffect(() => {
    if (open || !shown) return;
    const timer = window.setTimeout(() => setShown(false), PANEL_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open, shown]);
  const state = open ? "open" : shown ? "closing" : "closed";

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
  const welcome = useMemo(() => splitWelcomeMessage(bootstrap.welcomeMessage), [bootstrap.welcomeMessage]);
  const labelled = useMemo(() => firstOfEachRole(messages), [messages]);
  const canSend = !pending && draft.trim().length > 0;

  return (
    <section
      id={id}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      hidden={state === "closed"}
      inert={state === "closing"}
      ref={sectionRef}
      data-assistant-panel
      data-state={state}
      className="assistant-panel fixed z-[60] flex flex-col overflow-hidden bg-white text-neutral-950"
    >
      <header className="assistant-header relative shrink-0 bg-black px-5 pb-3.5 pt-3 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {/* The storefront's own wordmark: the panel reads as RARE, not as a plugin. A CSS background,
                not an <img>, so the conversation keeps its "no image or script element" guarantee. */}
            <span aria-hidden="true" className="assistant-wordmark -ml-1 block h-[38px] w-[76px]" />
            <h2 id={titleId} className="mt-1.5 truncate text-[11px] font-black uppercase leading-4 tracking-[0.22em] text-white">
              {bootstrap.displayName}
            </h2>
            <p className="mt-1.5 flex items-center gap-2 text-[11px] font-medium leading-4 text-white/65">
              <span aria-hidden="true" className="assistant-status-dot" />
              <span>Online · respostas automáticas</span>
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={`Fechar ${bootstrap.displayName}`} className="assistant-close group/close -mr-1.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <X aria-hidden="true" className="h-[18px] w-[18px] transition-transform duration-200 group-hover/close:rotate-90" strokeWidth={2.25} />
          </button>
        </div>
      </header>

      <div ref={logRef} role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversa" className="assistant-log min-h-0 flex-auto overflow-y-auto overscroll-contain px-5 pb-5 pt-5">
        <div data-assistant-welcome className="assistant-rise" style={{ "--assistant-i": 0 } as CSSProperties}>
          {welcome.lead ? <p className="assistant-lead">{welcome.lead}</p> : null}
          {welcome.body ? <p className={`assistant-welcome-body ${welcome.lead ? "mt-2" : ""}`}>{welcome.body}</p> : null}
        </div>

        {showSuggestions ? (
          <div className="mt-6">
            <p className="assistant-eyebrow assistant-rise" style={{ "--assistant-i": 1 } as CSSProperties}>
              Perguntas frequentes
            </p>
            <ul className="mt-2 border-t border-neutral-200">
              {bootstrap.suggestions.map((suggestion, index) => (
                <li key={suggestion} className="assistant-rise border-b border-neutral-200" style={{ "--assistant-i": index + 2 } as CSSProperties}>
                  <button type="button" disabled={pending} onClick={() => void ask(suggestion)} className="assistant-suggestion group/suggestion">
                    <span className="min-w-0 flex-1 break-words">{suggestion}</span>
                    <span aria-hidden="true" className="assistant-suggestion-arrow">
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {messages.length > 0 ? (
          <div className={`flex flex-col gap-3 ${showSuggestions ? "mt-6" : "mt-6 border-t border-neutral-200 pt-5"}`}>
            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="assistant-message-in flex flex-col items-end">
                  {labelled.has(message) ? <AuthorLabel align="end">Você</AuthorLabel> : null}
                  <p className="assistant-bubble assistant-bubble-user" data-assistant-message="user">
                    <span className="sr-only">Você: </span>
                    {message.text}
                  </p>
                </div>
              ) : (
                <div key={message.id} className="assistant-message-in flex max-w-[92%] flex-col items-start" data-assistant-message="assistant">
                  {labelled.has(message) ? <AuthorLabel align="start">RARE</AuthorLabel> : null}
                  <p className={`assistant-bubble ${message.tone === "error" ? "assistant-bubble-note" : "assistant-bubble-assistant"}`}>
                    <span className="sr-only">{bootstrap.displayName}: </span>
                    {message.text}
                  </p>
                  {message.cta ? <CtaLink cta={message.cta} /> : null}
                </div>
              ),
            )}
          </div>
        ) : null}

        {pending ? (
          <div className="assistant-message-in mt-3 flex items-center gap-3" aria-live="off" data-assistant-typing>
            <span className="assistant-typing" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="text-xs font-medium text-neutral-500">Buscando a resposta…</span>
          </div>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="assistant-composer shrink-0 border-t border-neutral-200 bg-white px-3 pb-3 pt-3">
        <div className="assistant-field">
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
            className="h-12 min-w-0 flex-1 bg-transparent pl-4 text-[0.9375rem] font-medium text-neutral-950 placeholder:text-neutral-500 focus:outline-none focus-visible:outline-none"
          />
          <button type="submit" disabled={!canSend} aria-label="Enviar pergunta" className="assistant-send inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <ArrowUp aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </button>
        </div>
      </form>
    </section>
  );
}
