"use client";

import { useActionState } from "react";
import { createAdminUserAction, type CreateAdminUserState } from "@/app/admin/(protected)/users/actions";

export function CreateAdminUserForm() {
  const [state, formAction, pending] = useActionState<CreateAdminUserState, FormData>(createAdminUserAction, {});

  return (
    <div>
      {state.temporaryPassword ? (
        <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-neutral-900" role="status">
          <p className="font-black">Conta criada para {state.email}</p>
          <p className="mt-1 text-sm">
            Senha temporária (exibida só agora): entregue por um canal seguro. No primeiro acesso a pessoa troca a senha e cadastra o segundo fator.
          </p>
          <p className="mt-3 select-all rounded bg-white px-3 py-2 font-mono text-sm">{state.temporaryPassword}</p>
        </div>
      ) : null}
      <form action={formAction} className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Nome</span>
          <input name="name" required minLength={2} maxLength={120} autoComplete="off" className="admin-input" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">E-mail</span>
          <input name="email" type="email" required maxLength={160} autoComplete="off" className="admin-input" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Login (opcional)</span>
          <input name="username" maxLength={60} pattern="[A-Za-z0-9._\-]*" autoComplete="off" className="admin-input" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Papel</span>
          <select name="role" required defaultValue="SELLER_ADMIN" className="admin-input">
            <option value="SELLER_ADMIN">Administrador Vendedor</option>
            <option value="SYSTEM_ADMIN">Administrador de Sistema</option>
          </select>
        </label>
        <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-center">
          <button type="submit" disabled={pending} className="h-11 rounded-lg bg-black px-5 text-sm font-black uppercase tracking-wide text-white disabled:opacity-60">
            {pending ? "Criando..." : "Criar conta"}
          </button>
          {state.error ? <p role="alert" className="text-sm font-semibold text-red-700">{state.error}</p> : null}
        </div>
      </form>
    </div>
  );
}
