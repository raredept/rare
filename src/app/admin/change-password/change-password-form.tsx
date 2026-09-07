"use client";

import { useActionState } from "react";
import {
  changePasswordAction,
  type ChangePasswordState,
} from "@/app/admin/change-password/actions";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<ChangePasswordState, FormData>(
    changePasswordAction,
    {},
  );

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <label className="block">
        <span className="mb-2 block text-sm font-black uppercase tracking-wide text-neutral-700">
          Nova senha
        </span>
        <input
          name="password"
          type="password"
          required
          minLength={12}
          maxLength={72}
          autoComplete="new-password"
          className="h-12 w-full rounded-lg border border-neutral-300 px-3 text-sm font-semibold outline-none focus:border-black"
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-black uppercase tracking-wide text-neutral-700">
          Confirmar nova senha
        </span>
        <input
          name="passwordConfirmation"
          type="password"
          required
          minLength={12}
          maxLength={72}
          autoComplete="new-password"
          className="h-12 w-full rounded-lg border border-neutral-300 px-3 text-sm font-semibold outline-none focus:border-black"
        />
      </label>
      <p className="text-xs leading-5 text-neutral-500">
        Use de 12 a 72 caracteres, com letra maiuscula, letra minuscula e numero.
        Acentos e outros caracteres especiais podem reduzir o limite.
      </p>
      {state.error ? <p className="text-sm font-semibold text-red-700">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-lg bg-black text-sm font-black uppercase tracking-wide text-white disabled:bg-neutral-500"
      >
        {pending ? "Salvando..." : "Definir nova senha"}
      </button>
    </form>
  );
}
