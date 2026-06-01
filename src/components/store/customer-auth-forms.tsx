"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  loginCustomerAction,
  registerCustomerAction,
  type CustomerActionState,
} from "@/lib/customer-actions";
import { formatCpf } from "@/lib/cpf";

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? <p className="mt-1 text-sm font-semibold text-red-700">{errors[0]}</p> : null;
}

export function CustomerLoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<CustomerActionState, FormData>(loginCustomerAction, {});

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <label className="block">
        <span className="mb-2 block text-sm font-black uppercase tracking-wide text-neutral-700">E-mail</span>
        <input name="email" type="email" required autoComplete="email" className="admin-input h-12" />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-black uppercase tracking-wide text-neutral-700">Senha</span>
        <input name="password" type="password" required autoComplete="current-password" className="admin-input h-12" />
      </label>
      {state.error ? <p className="text-sm font-semibold text-red-700">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-lg bg-black text-sm font-black uppercase tracking-wide text-white disabled:bg-neutral-500"
      >
        {pending ? "Entrando..." : "Entrar"}
      </button>
      <p className="text-center text-sm font-semibold text-neutral-600">
        Ainda não tem cadastro?{" "}
        <Link href={`/cadastro${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-black text-neutral-950 underline">
          Criar conta
        </Link>
      </p>
    </form>
  );
}

export function CustomerRegisterForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<CustomerActionState, FormData>(registerCustomerAction, {});
  const [cpf, setCpf] = useState("");

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <label className="block">
        <span className="mb-2 block text-sm font-black uppercase tracking-wide text-neutral-700">Nome</span>
        <input name="name" required autoComplete="name" className="admin-input h-12" />
        <FieldError errors={state.fieldErrors?.name} />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-black uppercase tracking-wide text-neutral-700">E-mail</span>
        <input name="email" type="email" required autoComplete="email" className="admin-input h-12" />
        <FieldError errors={state.fieldErrors?.email} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-black uppercase tracking-wide text-neutral-700">Telefone</span>
          <input name="phone" autoComplete="tel" className="admin-input h-12" />
          <FieldError errors={state.fieldErrors?.phone} />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-black uppercase tracking-wide text-neutral-700">CPF</span>
          <input
            name="cpf"
            value={cpf}
            onChange={(event) => setCpf(formatCpf(event.target.value))}
            required
            inputMode="numeric"
            autoComplete="off"
            maxLength={14}
            placeholder="000.000.000-00"
            className="admin-input h-12"
          />
          <FieldError errors={state.fieldErrors?.cpf} />
        </label>
      </div>
      <label className="block">
        <span className="mb-2 block text-sm font-black uppercase tracking-wide text-neutral-700">Senha</span>
        <input name="password" type="password" required autoComplete="new-password" minLength={8} className="admin-input h-12" />
        <FieldError errors={state.fieldErrors?.password} />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-black uppercase tracking-wide text-neutral-700">Confirmar senha</span>
        <input name="passwordConfirmation" type="password" required autoComplete="new-password" minLength={8} className="admin-input h-12" />
        <FieldError errors={state.fieldErrors?.passwordConfirmation} />
      </label>
      {state.error ? <p className="text-sm font-semibold text-red-700">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-lg bg-black text-sm font-black uppercase tracking-wide text-white disabled:bg-neutral-500"
      >
        {pending ? "Criando..." : "Criar conta"}
      </button>
      <p className="text-center text-sm font-semibold text-neutral-600">
        Já tem cadastro?{" "}
        <Link href={`/entrar${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-black text-neutral-950 underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
