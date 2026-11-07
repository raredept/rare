"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  createCustomerAddressAction,
  deleteCustomerAddressAction,
  setDefaultCustomerAddressAction,
  updateCustomerAddressAction,
  type CustomerActionState,
} from "@/lib/customer-actions";
import { formatCep } from "@/lib/cep";
import { resolveCustomerAddressError } from "@/lib/feedback-messages";

type Address = {
  id: string;
  label: string | null;
  recipientName: string | null;
  phone: string | null;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  isDefault: boolean;
};

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? <p className="mt-1 text-sm font-medium text-red-700">{errors[0]}</p> : null;
}

function AddressFields({ address, state }: { address?: Address; state?: CustomerActionState }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-neutral-700">Apelido</span>
        <input name="label" defaultValue={address?.label ?? ""} placeholder="Casa" className="store-input" />
        <FieldError errors={state?.fieldErrors?.label} />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-neutral-700">Destinatário</span>
        <input name="recipientName" defaultValue={address?.recipientName ?? ""} className="store-input" />
        <FieldError errors={state?.fieldErrors?.recipientName} />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-neutral-700">CEP</span>
        <input name="cep" defaultValue={address?.cep ?? ""} required inputMode="numeric" className="store-input" />
        <FieldError errors={state?.fieldErrors?.cep} />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-neutral-700">Telefone</span>
        <input name="phone" defaultValue={address?.phone ?? ""} inputMode="tel" className="store-input" />
        <FieldError errors={state?.fieldErrors?.phone} />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-2 block text-sm font-medium text-neutral-700">Rua</span>
        <input name="street" defaultValue={address?.street ?? ""} required className="store-input" />
        <FieldError errors={state?.fieldErrors?.street} />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-neutral-700">Número</span>
        <input name="number" defaultValue={address?.number ?? ""} required className="store-input" />
        <FieldError errors={state?.fieldErrors?.number} />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-neutral-700">Complemento</span>
        <input name="complement" defaultValue={address?.complement ?? ""} className="store-input" />
        <FieldError errors={state?.fieldErrors?.complement} />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-neutral-700">Bairro</span>
        <input name="neighborhood" defaultValue={address?.neighborhood ?? ""} required className="store-input" />
        <FieldError errors={state?.fieldErrors?.neighborhood} />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-neutral-700">Cidade</span>
        <input name="city" defaultValue={address?.city ?? ""} required className="store-input" />
        <FieldError errors={state?.fieldErrors?.city} />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-neutral-700">Estado</span>
        <input name="state" defaultValue={address?.state ?? ""} required maxLength={2} className="store-input uppercase" />
        <FieldError errors={state?.fieldErrors?.state} />
      </label>
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-neutral-800">
        <input name="isDefault" type="checkbox" defaultChecked={address?.isDefault ?? false} className="h-4 w-4 accent-black" />
        Endereço padrão
      </label>
    </div>
  );
}

export function CustomerAddresses({ addresses, pageError, checkoutEnabled = true }: { addresses: Address[]; pageError?: string; checkoutEnabled?: boolean }) {
  // The message arrives in the URL; only the server's own messages are shown verbatim.
  const resolvedPageError = resolveCustomerAddressError(pageError);
  const [state, formAction, pending] = useActionState<CustomerActionState, FormData>(createCustomerAddressAction, {});

  return (
    <div className="grid gap-12 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] xl:gap-16">
      <form action={formAction} className="h-fit min-w-0 space-y-6">
        <div>
          <h2 className="text-xl font-medium tracking-tight text-neutral-950">Novo endereço</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Usado como referência do pedido até a ativação do frete real.
          </p>
        </div>
        <AddressFields state={state} />
        {state.error ? <p className="text-sm font-medium text-red-700">{state.error}</p> : null}
        {state.success ? <p className="text-sm font-medium text-green-700">{state.success}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="store-button-primary w-full"
        >
          {pending ? "Salvando..." : "Cadastrar endereço"}
        </button>
      </form>

      <section className="min-w-0 border-t border-neutral-200">
        {resolvedPageError ? <p className="my-5 border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{resolvedPageError}</p> : null}
        {addresses.length ? (
          addresses.map((address) => (
            <div key={address.id} className="border-b border-neutral-200 py-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-medium text-neutral-950">{address.label || "Endereço"}</h3>
                    {address.isDefault ? (
                      <span className="border border-neutral-300 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-neutral-700">Padrão</span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-neutral-600">
                    {address.street}, {address.number}
                    {address.complement ? ` - ${address.complement}` : ""}
                  </p>
                  <p className="text-sm leading-6 text-neutral-600">
                    {address.neighborhood} · {address.city}/{address.state} · CEP {formatCep(address.cep) || address.cep}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {checkoutEnabled ? <Link href={`/finalizar-compra?address=${encodeURIComponent(address.id)}`} className="inline-flex min-h-11 items-center border-b border-neutral-400 px-2 text-xs font-medium text-neutral-950 hover:border-neutral-950">Usar no checkout</Link> : null}
                  {!address.isDefault ? (
                    <form action={setDefaultCustomerAddressAction}>
                      <input type="hidden" name="id" value={address.id} />
                      <button type="submit" className="inline-flex min-h-11 items-center border-b border-neutral-400 px-2 text-xs font-medium text-neutral-950 hover:border-neutral-950">
                        Tornar padrão
                      </button>
                    </form>
                  ) : null}
                  <form action={deleteCustomerAddressAction}>
                    <input type="hidden" name="id" value={address.id} />
                    <button type="submit" className="inline-flex min-h-11 items-center border-b border-red-300 px-2 text-xs font-medium text-red-700 hover:border-red-700">
                      Remover
                    </button>
                  </form>
                </div>
              </div>
              <details className="mt-4">
                <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-neutral-950">Editar endereço</summary>
                <form action={updateCustomerAddressAction.bind(null, address.id)} className="mt-4 space-y-5 border-t border-neutral-200 pt-6">
                  <AddressFields address={address} />
                  <button type="submit" className="store-button-primary w-full sm:w-auto">
                    Salvar endereço
                  </button>
                </form>
              </details>
            </div>
          ))
        ) : (
          <div className="border-b border-neutral-200 py-12">
            <h2 className="text-xl font-medium tracking-tight text-neutral-950">Nenhum endereço cadastrado</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-600">Cadastre um endereço para acelerar próximos pedidos.</p>
          </div>
        )}
      </section>
    </div>
  );
}
