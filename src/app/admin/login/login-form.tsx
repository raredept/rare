"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/admin/login/actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <label className="block">
        <span className="mb-2 block text-sm font-black uppercase tracking-wide text-neutral-700">E-mail</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="h-12 w-full rounded-lg border border-neutral-300 px-3 text-sm font-semibold outline-none focus:border-black"
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-black uppercase tracking-wide text-neutral-700">Senha</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="h-12 w-full rounded-lg border border-neutral-300 px-3 text-sm font-semibold outline-none focus:border-black"
        />
      </label>
      {state.error ? <p className="text-sm font-semibold text-red-700">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-lg bg-black text-sm font-black uppercase tracking-wide text-white disabled:bg-neutral-500"
      >
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
