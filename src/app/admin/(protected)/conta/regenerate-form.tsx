"use client";

import { useActionState } from "react";
import { regenerateRecoveryCodesAction, type RegenerateCodesState } from "@/app/admin/(protected)/conta/actions";

export function RegenerateRecoveryCodesForm() {
  const [state, formAction, pending] = useActionState<RegenerateCodesState, FormData>(regenerateRecoveryCodesAction, {});

  if (state.recoveryCodes) {
    return (
      <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-neutral-900" role="status">
        <p className="font-black">Novos códigos de recuperação</p>
        <p className="mt-1 text-sm">Os códigos anteriores deixaram de funcionar. Estes não serão exibidos novamente.</p>
        <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-5" aria-label="Códigos de recuperação">
          {state.recoveryCodes.map((code) => <li key={code} className="rounded bg-white px-2 py-1 text-center">{code}</li>)}
        </ul>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="block sm:w-56">
        <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Código atual do autenticador</span>
        <input name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={7} className="admin-input font-mono tracking-widest" />
      </label>
      <button type="submit" disabled={pending} className="h-11 rounded-lg border border-neutral-300 px-4 text-sm font-black hover:bg-neutral-950 hover:text-white disabled:opacity-60">
        {pending ? "Gerando..." : "Gerar novos códigos de recuperação"}
      </button>
      {state.error ? <p role="alert" className="text-sm font-semibold text-red-700">{state.error}</p> : null}
    </form>
  );
}
