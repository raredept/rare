"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { submitSupportRequestAction, type SupportFormState } from "@/app/(store)/suporte/actions";
import { trackAnalyticsEvent } from "@/lib/site-analytics-client";
import { SUPPORT_CATEGORIES, SUPPORT_CATEGORY_LABELS, SUPPORT_LIMITS, type SupportCategoryValue } from "@/lib/support-request-contract";

type SupportFormProps = {
  /** Fresh per render (server): a double submit of the same render returns the same protocol. */
  submissionKey: string;
  defaultName?: string;
  defaultEmail?: string;
  defaultCategory?: SupportCategoryValue;
  product?: { slug: string; title: string } | null;
  orders?: Array<{ id: string; label: string }>;
};

const labelClass = "mb-2 block text-xs font-black uppercase tracking-[0.16em] text-neutral-700";

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} className="mt-2 text-sm font-semibold text-red-700">{message}</p> : null;
}

export function SupportForm({ submissionKey, defaultName, defaultEmail, defaultCategory, product, orders = [] }: SupportFormProps) {
  const [state, formAction, pending] = useActionState<SupportFormState, FormData>(submitSupportRequestAction, {});
  const [started, setStarted] = useState(false);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const errors = state.fieldErrors ?? {};

  // Behavioural events are no-ops without analytics consent; they never carry form content.
  useEffect(() => {
    trackAnalyticsEvent("support_page_view");
  }, []);
  useEffect(() => {
    if (state.protocol) {
      trackAnalyticsEvent("support_form_submitted");
      statusRef.current?.focus();
    }
  }, [state.protocol]);

  if (state.protocol) {
    return (
      <div ref={statusRef} tabIndex={-1} role="status" aria-live="polite" className="rounded-lg border border-neutral-300 bg-white p-6 focus:outline-none">
        <p className="store-section-label">Mensagem recebida</p>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-neutral-950">Recebemos sua solicitação.</h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-neutral-600">
          Protocolo: <strong className="font-black text-neutral-950">{state.protocol}</strong>. A equipe da RARE vai responder pelo e-mail informado.
        </p>
        <Link href="/" className="store-button-secondary mt-6">Voltar para a loja</Link>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      noValidate={false}
      className="space-y-5"
      onInput={() => {
        if (started) return;
        setStarted(true);
        trackAnalyticsEvent("support_form_started");
      }}
    >
      <input type="hidden" name="submissionKey" value={submissionKey} />
      {product ? <input type="hidden" name="product" value={product.slug} /> : null}
      {/* Honeypot: hidden from people and from assistive technology. */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label>
          Site
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      {errors.form ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{errors.form}</p>
      ) : null}

      {product ? (
        <p className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700">
          Sobre a peça: <strong className="font-black text-neutral-950">{product.title}</strong>
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Nome</span>
          <input name="name" required minLength={SUPPORT_LIMITS.nameMin} maxLength={SUPPORT_LIMITS.nameMax} autoComplete="name" defaultValue={defaultName} aria-invalid={Boolean(errors.name) || undefined} aria-describedby={errors.name ? "support-name-error" : undefined} className="store-input" />
          <FieldError id="support-name-error" message={errors.name} />
        </label>
        <label className="block">
          <span className={labelClass}>E-mail</span>
          <input name="email" type="email" required maxLength={SUPPORT_LIMITS.emailMax} autoComplete="email" defaultValue={defaultEmail} aria-invalid={Boolean(errors.email) || undefined} aria-describedby={errors.email ? "support-email-error" : undefined} className="store-input" />
          <FieldError id="support-email-error" message={errors.email} />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Assunto</span>
          <select name="category" required defaultValue={defaultCategory ?? ""} aria-invalid={Boolean(errors.category) || undefined} aria-describedby={errors.category ? "support-category-error" : undefined} className="store-input">
            <option value="" disabled>Escolha um assunto</option>
            {SUPPORT_CATEGORIES.map((category) => (
              <option key={category} value={category}>{SUPPORT_CATEGORY_LABELS[category]}</option>
            ))}
          </select>
          <FieldError id="support-category-error" message={errors.category} />
        </label>
        {orders.length ? (
          <label className="block">
            <span className={labelClass}>Pedido (opcional)</span>
            <select name="order" defaultValue="" className="store-input">
              <option value="">Nenhum pedido</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>{order.label}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <label className="block">
        <span className={labelClass}>Mensagem</span>
        <textarea name="message" required minLength={SUPPORT_LIMITS.messageMin} maxLength={SUPPORT_LIMITS.messageMax} rows={7} aria-invalid={Boolean(errors.message) || undefined} aria-describedby={`support-message-help${errors.message ? " support-message-error" : ""}`} className="store-input h-auto min-h-40 py-3 leading-6" />
        <span id="support-message-help" className="mt-2 block text-xs font-semibold text-neutral-600">Até {SUPPORT_LIMITS.messageMax} caracteres. Não envie dados de cartão ou senhas.</span>
        <FieldError id="support-message-error" message={errors.message} />
      </label>

      <p className="text-xs font-semibold leading-5 text-neutral-600">
        Usamos seu nome, e-mail e mensagem apenas para responder a esta solicitação. Veja a{" "}
        <Link href="/privacidade-e-termos" className="font-black text-neutral-950 underline underline-offset-4">Política de Privacidade</Link>.
      </p>

      <button type="submit" disabled={pending} className="store-button-primary w-full sm:w-auto">
        {pending ? "Enviando..." : "Enviar mensagem"}
      </button>
    </form>
  );
}
