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
  return errors?.length ? <p className="mt-1 text-sm font-medium text-red-700">{errors[0]}</p> : null;
}

export function CustomerProfileForm({ customer }: CustomerProfileFormProps) {
  const [state, formAction, pending] = useActionState<CustomerActionState, FormData>(updateCustomerProfileAction, {});
  const [cpf, setCpf] = useState("");
  const hasCpf = Boolean(customer.cpfMasked);

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-neutral-700">Nome</span>
        <input name="name" defaultValue={customer.name} required className="store-input" />
        <FieldError errors={state.fieldErrors?.name} />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-neutral-700">E-mail</span>
        <input value={customer.email} readOnly className="store-input bg-neutral-50 text-neutral-600" />
        <p className="mt-2 text-xs leading-5 text-neutral-600">Alteração de e-mail fica para uma fase com verificação.</p>
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-neutral-700">Telefone</span>
        <input name="phone" defaultValue={customer.phone ?? ""} autoComplete="tel" className="store-input" />
        <FieldError errors={state.fieldErrors?.phone} />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-neutral-700">CPF</span>
        <input
          name="cpf"
          value={cpf}
          onChange={(event) => setCpf(formatCpf(event.target.value))}
          required={!hasCpf}
          placeholder={customer.cpfMasked || "000.000.000-00"}
          inputMode="numeric"
          maxLength={14}
          className="store-input"
        />
        <p className="mt-2 text-xs leading-5 text-neutral-600">
          {hasCpf ? "CPF cadastrado. Digite o CPF completo somente se precisar corrigir." : "Precisamos do CPF para emissão e envio do pedido."}
        </p>
        <FieldError errors={state.fieldErrors?.cpf} />
      </label>
      {state.error ? <p className="text-sm font-medium text-red-700">{state.error}</p> : null}
      {state.success ? <p className="text-sm font-medium text-green-700">{state.success}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="store-button-primary w-full sm:w-auto"
      >
        {pending ? "Salvando..." : "Salvar alterações"}
      </button>
    </form>
  );
}
