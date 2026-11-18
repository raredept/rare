"use client";

import { Loader2, Search } from "lucide-react";
import { useActionState, useId } from "react";
import { previewAssistantAction, type AssistantPreviewState } from "@/app/admin/(protected)/assistant/actions";
import { ASSISTANT_LIMITS } from "@/lib/assistant/limits";
import { ASSISTANT_MATCH_THRESHOLD } from "@/lib/assistant/matching";

const percent = (value: number) => `${Math.round(value * 100)}%`;

/** Admin-only: the score is shown here and never on the storefront. */
export function AssistantPreview() {
  const [state, formAction, pending] = useActionState<AssistantPreviewState, FormData>(previewAssistantAction, { status: "idle" });
  const inputId = useId();
  const resultId = useId();

  return (
    <div>
      <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="block min-w-0 flex-1" htmlFor={inputId}>
          <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-neutral-500">Pergunta de teste</span>
          <input
            id={inputId}
            name="question"
            required
            maxLength={ASSISTANT_LIMITS.message}
            placeholder="quanto tempo demora pra chegar?"
            autoComplete="off"
            className="admin-input"
            aria-describedby={resultId}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-black px-5 text-sm font-black uppercase tracking-wide text-white transition disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          {pending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Search aria-hidden="true" className="h-4 w-4" />}
          {pending ? "Testando..." : "Testar"}
        </button>
      </form>

      <div id={resultId} aria-live="polite" className="mt-4">
        {state.status === "invalid" ? <p className="text-sm font-semibold text-red-600">{state.message}</p> : null}
        {state.status === "done" ? (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4" data-assistant-preview-result>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-black uppercase tracking-wide text-neutral-500">Pergunta testada</dt>
                <dd className="mt-1 font-semibold text-neutral-900">{state.question}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-black uppercase tracking-wide text-neutral-500">Resultado</dt>
                <dd className="mt-1 font-black text-neutral-900" data-assistant-preview-outcome={state.fallback ? "fallback" : "matched"}>
                  {state.fallback ? "Fallback (nenhuma resposta confiável)" : "Resposta encontrada"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-black uppercase tracking-wide text-neutral-500">Confiança</dt>
                <dd className="mt-1 font-semibold text-neutral-900">
                  {percent(state.confidence)} <span className="text-neutral-500">(mínimo {percent(ASSISTANT_MATCH_THRESHOLD)})</span>
                </dd>
              </div>
              {state.entry ? (
                <div className="sm:col-span-2">
                  <dt className="text-[11px] font-black uppercase tracking-wide text-neutral-500">Pergunta cadastrada usada</dt>
                  <dd className="mt-1 font-semibold text-neutral-900">
                    <a className="underline underline-offset-4" href={`#pergunta-${state.entry.id}`}>{state.entry.question}</a>
                    {state.entry.category ? <span className="text-neutral-500"> · {state.entry.category}</span> : null}
                  </dd>
                </div>
              ) : null}
              {state.closest ? (
                <div className="sm:col-span-2">
                  <dt className="text-[11px] font-black uppercase tracking-wide text-neutral-500">Mais próxima (abaixo do mínimo)</dt>
                  <dd className="mt-1 font-semibold text-neutral-700">{state.closest.question} · {percent(state.closest.score)}</dd>
                </div>
              ) : null}
              {state.runnerUp ? (
                <div className="sm:col-span-2">
                  <dt className="text-[11px] font-black uppercase tracking-wide text-neutral-500">Segunda opção</dt>
                  <dd className="mt-1 font-semibold text-neutral-700">{state.runnerUp.question} · {percent(state.runnerUp.score)}</dd>
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-black uppercase tracking-wide text-neutral-500">Resposta que a loja mostraria</dt>
                <dd className="mt-1 whitespace-pre-line rounded-lg border border-neutral-200 bg-white p-3 font-semibold text-neutral-900">{state.answer}</dd>
                {state.cta ? <dd className="mt-2 text-xs font-semibold text-neutral-600">Com o botão “{state.cta.label}” → {state.cta.href}</dd> : null}
              </div>
            </dl>
            {!state.enabled ? (
              <p className="mt-3 text-xs font-semibold text-amber-700">O Assistente está desativado: a loja não mostra o widget. O teste usa as respostas ativas mesmo assim.</p>
            ) : null}
            {state.activeEntries === 0 ? <p className="mt-3 text-xs font-semibold text-amber-700">Nenhuma resposta ativa: toda pergunta cai no fallback.</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
