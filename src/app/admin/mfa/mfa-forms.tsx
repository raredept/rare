"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  confirmEnrollmentAction,
  verifyMfaAction,
  type MfaChallengeState,
  type MfaEnrollmentState,
} from "@/app/admin/mfa/actions";

const inputClass = "h-12 w-full rounded-lg border border-neutral-300 px-3 font-mono text-lg tracking-[0.3em] outline-none focus:border-black focus-visible:ring-2 focus-visible:ring-black/30";
const buttonClass = "h-12 w-full rounded-lg bg-black text-sm font-black uppercase tracking-wide text-white disabled:bg-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2";

export function MfaChallengeForm() {
  const [state, formAction, pending] = useActionState<MfaChallengeState, FormData>(verifyMfaAction, {});
  return (
    <form action={formAction} className="mt-6 space-y-4">
      <label className="block">
        <span className="mb-2 block text-sm font-black uppercase tracking-wide text-neutral-700">Código</span>
        <input
          name="code"
          required
          autoFocus
          autoComplete="one-time-code"
          inputMode="text"
          maxLength={16}
          aria-describedby={state.error ? "mfa-error" : undefined}
          aria-invalid={state.error ? true : undefined}
          className={inputClass}
        />
      </label>
      {state.error ? <p id="mfa-error" role="alert" className="text-sm font-semibold text-red-700">{state.error}</p> : null}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Verificando..." : "Verificar"}
      </button>
      <p className="text-center text-xs text-neutral-500">
        <Link href="/admin/login" className="underline underline-offset-2">Voltar ao login</Link>
      </p>
    </form>
  );
}

export function MfaEnrollmentForm({ completed = false }: { completed?: boolean }) {
  const [state, formAction, pending] = useActionState<MfaEnrollmentState, FormData>(confirmEnrollmentAction, {});

  if (state.recoveryCodes) {
    return (
      <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4" role="status">
        <h2 className="text-base font-black text-neutral-950">Verificação ativada. Guarde seus códigos de recuperação</h2>
        <p className="mt-1 text-sm text-neutral-700">
          Cada código funciona uma única vez, se você perder o celular. Eles não serão exibidos novamente. Guarde em um gerenciador de senhas.
        </p>
        <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm" aria-label="Códigos de recuperação">
          {state.recoveryCodes.map((code) => (
            <li key={code} className="rounded bg-white px-2 py-1 text-center tracking-wider">{code}</li>
          ))}
        </ul>
        <Link href={state.continueTo ?? "/admin"} className={`mt-4 inline-flex items-center justify-center ${buttonClass}`}>
          Já guardei, continuar
        </Link>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="mt-6" role="status">
        <p className="text-sm font-semibold text-neutral-700">A verificação em duas etapas já está ativa nesta conta.</p>
        <Link href="/admin" className={`mt-4 inline-flex items-center justify-center ${buttonClass}`}>Ir para o Admin</Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <label className="block">
        <span className="mb-2 block text-sm font-black uppercase tracking-wide text-neutral-700">Código de 6 dígitos</span>
        <input
          name="code"
          required
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          aria-describedby={state.error ? "mfa-setup-error" : undefined}
          aria-invalid={state.error ? true : undefined}
          className={inputClass}
        />
      </label>
      {state.error ? <p id="mfa-setup-error" role="alert" className="text-sm font-semibold text-red-700">{state.error}</p> : null}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Confirmando..." : "Ativar verificação"}
      </button>
    </form>
  );
}
