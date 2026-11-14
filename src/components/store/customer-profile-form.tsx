"use client";

import { useActionState, useState } from "react";
import { updateCustomerProfileAction, type CustomerActionState } from "@/lib/customer-actions";
import { formatCpf } from "@/lib/cpf";

type CustomerProfileFormProps = {
  customer: {
    name: string;
    email: string;
    phone: string | null;
    cpfMasked: string;
  };
};

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? <p className="mt-1 text-sm font-semibold text-red-700">{errors[0]}</p> : null;
}

export function CustomerProfileForm({ customer }: CustomerProfileFormProps) {
  const [state, formAction, pending] = useActionState<CustomerActionState, FormData>(updateCustomerProfileAction, {});
  const [cpf, setCpf] = useState("");
  const hasCpf = Boolean(customer.cpfMasked);

  return (
    <form action={formAction} className="max-w-2xl space-y-5 rounded-lg border border-neutral-200 bg-white p-5">
      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Nome</span>
        <input name="name" defaultValue={customer.name} required className="admin-input h-12" />
        <FieldError errors={state.fieldErrors?.name} />
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">E-mail</span>
        <input value={customer.email} readOnly className="admin-input h-12 bg-neutral-50 text-neutral-600" />
        <p className="mt-1 text-xs font-semibold text-neutral-500">Alteração de e-mail fica para uma fase com verificação.</p>
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Telefone</span>
        <input name="phone" defaultValue={customer.phone ?? ""} autoComplete="tel" className="admin-input h-12" />
        <FieldError errors={state.fieldErrors?.phone} />
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">CPF</span>
        <input
          name="cpf"
          value={cpf}
          onChange={(event) => setCpf(formatCpf(event.target.value))}
          required={!hasCpf}
          placeholder={customer.cpfMasked || "000.000.000-00"}
          inputMode="numeric"
          maxLength={14}
          className="admin-input h-12"
        />
        <p className="mt-1 text-xs font-semibold text-neutral-500">
          {hasCpf ? "CPF cadastrado. Digite o CPF completo somente se precisar corrigir." : "Precisamos do CPF para emissão e envio do pedido."}
        </p>
        <FieldError errors={state.fieldErrors?.cpf} />
      </label>
      {state.error ? <p className="text-sm font-semibold text-red-700">{state.error}</p> : null}
      {state.success ? <p className="text-sm font-semibold text-green-700">{state.success}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-lg bg-black px-6 text-sm font-black uppercase tracking-wide text-white disabled:bg-neutral-500"
      >
        {pending ? "Salvando..." : "Salvar alterações"}
      </button>
    </form>
  );
}
