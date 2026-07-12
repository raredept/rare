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
  return errors?.length ? <p className="mt-1 text-sm font-semibold text-red-700">{errors[0]}</p> : null;
}

function AddressFields({ address, state }: { address?: Address; state?: CustomerActionState }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Apelido</span>
        <input name="label" defaultValue={address?.label ?? ""} placeholder="Casa" className="admin-input" />
        <FieldError errors={state?.fieldErrors?.label} />
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Destinatário</span>
        <input name="recipientName" defaultValue={address?.recipientName ?? ""} className="admin-input" />
        <FieldError errors={state?.fieldErrors?.recipientName} />
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">CEP</span>
        <input name="cep" defaultValue={address?.cep ?? ""} required inputMode="numeric" className="admin-input" />
        <FieldError errors={state?.fieldErrors?.cep} />
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Telefone</span>
        <input name="phone" defaultValue={address?.phone ?? ""} inputMode="tel" className="admin-input" />
        <FieldError errors={state?.fieldErrors?.phone} />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Rua</span>
        <input name="street" defaultValue={address?.street ?? ""} required className="admin-input" />
        <FieldError errors={state?.fieldErrors?.street} />
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Número</span>
        <input name="number" defaultValue={address?.number ?? ""} required className="admin-input" />
        <FieldError errors={state?.fieldErrors?.number} />
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Complemento</span>
        <input name="complement" defaultValue={address?.complement ?? ""} className="admin-input" />
        <FieldError errors={state?.fieldErrors?.complement} />
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Bairro</span>
        <input name="neighborhood" defaultValue={address?.neighborhood ?? ""} required className="admin-input" />
        <FieldError errors={state?.fieldErrors?.neighborhood} />
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Cidade</span>
        <input name="city" defaultValue={address?.city ?? ""} required className="admin-input" />
        <FieldError errors={state?.fieldErrors?.city} />
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Estado</span>
        <input name="state" defaultValue={address?.state ?? ""} required maxLength={2} className="admin-input uppercase" />
        <FieldError errors={state?.fieldErrors?.state} />
      </label>
      <label className="flex items-center gap-3 text-sm font-black text-neutral-800">
        <input name="isDefault" type="checkbox" defaultChecked={address?.isDefault ?? false} className="h-4 w-4" />
        Endereço padrão
      </label>
    </div>
  );
}

export function CustomerAddresses({ addresses, pageError, checkoutEnabled = true }: { addresses: Address[]; pageError?: string; checkoutEnabled?: boolean }) {
  const [state, formAction, pending] = useActionState<CustomerActionState, FormData>(createCustomerAddressAction, {});

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
      <form action={formAction} className="h-fit space-y-5 rounded-lg border border-neutral-200 bg-white p-5">
        <div>
          <h2 className="text-lg font-black text-neutral-950">Novo endereço</h2>
          <p className="mt-1 text-sm font-medium text-neutral-500">
            Usado como referência do pedido até a ativação do frete real.
          </p>
        </div>
        <AddressFields state={state} />
        {state.error ? <p className="text-sm font-semibold text-red-700">{state.error}</p> : null}
        {state.success ? <p className="text-sm font-semibold text-green-700">{state.success}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="h-12 w-full rounded-lg bg-black text-sm font-black uppercase tracking-wide text-white disabled:bg-neutral-500"
        >
          {pending ? "Salvando..." : "Cadastrar endereço"}
        </button>
      </form>

      <section className="space-y-4">
        {pageError ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{pageError}</p> : null}
        {addresses.length ? (
          addresses.map((address) => (
            <div key={address.id} className="rounded-lg border border-neutral-200 bg-white p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-neutral-950">{address.label || "Endereço"}</h3>
                    {address.isDefault ? (
                      <span className="rounded-full bg-neutral-950 px-2 py-1 text-[11px] font-black uppercase text-white">Padrão</span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-neutral-600">
                    {address.street}, {address.number}
                    {address.complement ? ` - ${address.complement}` : ""}
                  </p>
                  <p className="text-sm font-semibold text-neutral-600">
                    {address.neighborhood} · {address.city}/{address.state} · CEP {formatCep(address.cep) || address.cep}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {checkoutEnabled ? <Link href={`/finalizar-compra?address=${encodeURIComponent(address.id)}`} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-black">Usar no checkout</Link> : null}
                  {!address.isDefault ? (
                    <form action={setDefaultCustomerAddressAction}>
                      <input type="hidden" name="id" value={address.id} />
                      <button type="submit" className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-black">
                        Tornar padrão
                      </button>
                    </form>
                  ) : null}
                  <form action={deleteCustomerAddressAction}>
                    <input type="hidden" name="id" value={address.id} />
                    <button type="submit" className="rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-700">
                      Remover
                    </button>
                  </form>
                </div>
              </div>
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-black text-neutral-950">Editar endereço</summary>
                <form action={updateCustomerAddressAction.bind(null, address.id)} className="mt-4 space-y-4 border-t border-neutral-200 pt-4">
                  <AddressFields address={address} />
                  <button type="submit" className="h-11 rounded-lg bg-black px-5 text-sm font-black uppercase tracking-wide text-white">
                    Salvar endereço
                  </button>
                </form>
              </details>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
            <h2 className="text-lg font-black text-neutral-950">Nenhum endereço cadastrado</h2>
            <p className="mt-2 text-sm font-medium text-neutral-500">Cadastre um endereço para acelerar próximos pedidos.</p>
          </div>
        )}
      </section>
    </div>
  );
}
