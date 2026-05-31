"use client";

import { Loader2, MapPin, Minus, Plus, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCart, type CartItem } from "@/components/store/cart-context";
import { ProductMediaPlaceholder } from "@/components/store/product-media-placeholder";
import { formatCep, parseCep } from "@/lib/cep";
import { formatMoney } from "@/lib/money";
import { calculateProvisionalShipping, type ProvisionalShippingSettings } from "@/lib/shipping";

type CheckoutAddress = {
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

type CartPageClientProps = {
  customer: {
    name: string;
    email: string;
    phone: string | null;
  } | null;
  addresses: CheckoutAddress[];
  initialSelectedAddressId: string;
  shippingSettings: ProvisionalShippingSettings & {
    shippingInstructions?: string | null;
  };
  shippingConfig: {
    enabled: boolean;
    mode: string;
    provider: string;
    originCepConfigured: boolean;
  };
};

type ShippingQuoteOption = {
  id: string;
  provider: string;
  service: string;
  label: string;
  amountCents: number;
  estimatedDaysMin?: number;
  estimatedDaysMax?: number;
  deliveryEstimateText: string;
  originCep: string | null;
  destinationCep: string;
  expiresAt?: string;
  companyName?: string;
  rawServiceId?: string | number;
};

type ShippingQuoteContext = {
  cartSignature: string;
  cep: string;
};

type ShippingSelection = ShippingQuoteContext & {
  option: ShippingQuoteOption;
};

const emptyGuestCustomer = {
  name: "",
  email: "",
  phone: "",
  cpf: "",
};

const emptyGuestAddress = {
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};

const shippingSelectionStorageKey = "rare_store_shipping_selection";

function getCartSignature(items: CartItem[]) {
  return items
    .map((item) => `${item.productId}:${item.variantId}:${item.quantity}`)
    .sort()
    .join("|");
}

function clearStoredShippingSelection() {
  window.localStorage.removeItem(shippingSelectionStorageKey);
}

function persistShippingSelection(selection: ShippingSelection) {
  window.localStorage.setItem(shippingSelectionStorageKey, JSON.stringify(selection));
}

function isShippingOptionFresh(option: ShippingQuoteOption, now = Date.now()) {
  const expiresAt = option.expiresAt ? Date.parse(option.expiresAt) : null;
  return !expiresAt || expiresAt > now;
}

function isShippingOptionValidForCep(option: ShippingQuoteOption, normalizedCep: string, now = Date.now()) {
  return parseCep(option.destinationCep) === normalizedCep && isShippingOptionFresh(option, now);
}

export function resolveShippingOptionSelection(
  options: ShippingQuoteOption[],
  params: {
    normalizedCep: string;
    preferredOptionId?: string | null;
    autoSelectSingle?: boolean;
    now?: number;
  },
) {
  const validOptions = options.filter((option) => isShippingOptionValidForCep(option, params.normalizedCep, params.now));
  if (params.preferredOptionId) {
    const preferred = validOptions.find((option) => option.id === params.preferredOptionId);
    if (preferred) return preferred;
  }

  if (params.autoSelectSingle && validOptions.length === 1) {
    return validOptions[0];
  }

  return null;
}

function readStoredShippingSelection(cartSignature: string, normalizedCep: string) {
  try {
    const stored = window.localStorage.getItem(shippingSelectionStorageKey);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<ShippingSelection>;
    const option = parsed.option;

    if (
      parsed.cartSignature === cartSignature &&
      parsed.cep === normalizedCep &&
      option &&
      isShippingOptionValidForCep(option, normalizedCep)
    ) {
      return parsed as ShippingSelection;
    }
  } catch {
    // Invalid persisted state should never influence the checkout total.
  }

  clearStoredShippingSelection();
  return null;
}

function formatShippingError(message: string) {
  if (message.includes("peso e medidas")) {
    return "Esse produto ainda precisa de peso e medidas para calcular o frete.";
  }
  if (message.includes("CEP de origem")) {
    return "Frete indisponível no momento. A RARE precisa revisar o CEP de origem da loja.";
  }
  if (message.includes("MELHOR_ENVIO_TOKEN") || message.includes("OAuth do Melhor Envio")) {
    return "A loja precisa finalizar a configuração do Melhor Envio para calcular o frete.";
  }
  return formatCheckoutMessage(message);
}

function formatCheckoutMessage(message: string) {
  if (message === "Checkout temporariamente indisponível." || message.includes("Checkout temporariamente indisponível")) {
    return "Estamos finalizando o checkout da loja. Chame a RARE no WhatsApp para concluir seu pedido por enquanto.";
  }

  return message;
}

export function CartPageClient({ customer, addresses, initialSelectedAddressId, shippingSettings, shippingConfig }: CartPageClientProps) {
  const { items, subtotalInCents, updateQuantity, removeItem } = useCart();
  const [selectedAddressId, setSelectedAddressId] = useState(initialSelectedAddressId);
  const [guestCustomerData, setGuestCustomerData] = useState(emptyGuestCustomer);
  const [guestAddress, setGuestAddress] = useState(emptyGuestAddress);
  const [shippingOptions, setShippingOptions] = useState<ShippingQuoteOption[]>([]);
  const [shippingQuoteContext, setShippingQuoteContext] = useState<ShippingQuoteContext | null>(null);
  const [selectedShipping, setSelectedShipping] = useState<ShippingSelection | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shippingRequestId = useRef(0);
  const selectedAddress = addresses.find((address) => address.id === selectedAddressId) ?? null;
  const checkoutCep = customer ? selectedAddress?.cep : guestAddress.cep;
  const normalizedCheckoutCep = parseCep(checkoutCep);
  const cartSignature = useMemo(() => getCartSignature(items), [items]);
  const currentShippingOptions =
    shippingQuoteContext?.cartSignature === cartSignature && shippingQuoteContext.cep === normalizedCheckoutCep
      ? shippingOptions
      : [];
  const selectedShippingOption =
    selectedShipping?.cartSignature === cartSignature && selectedShipping.cep === normalizedCheckoutCep
      ? selectedShipping.option
      : null;
  const isFixedShipping = shippingConfig.enabled && shippingConfig.mode === "fixed";
  const isMelhorEnvioShipping = shippingConfig.enabled && shippingConfig.provider === "melhor_envio";
  const legacyShippingPreview = useMemo(() => {
    if (shippingConfig.enabled) {
      return { result: null, error: null };
    }

    try {
      return {
        result: calculateProvisionalShipping({
          subtotalInCents,
          cep: checkoutCep,
          settings: shippingSettings,
        }),
        error: null,
      };
    } catch (previewError) {
      return {
        result: null,
        error: previewError instanceof Error ? previewError.message : "Frete indisponível.",
      };
    }
  }, [checkoutCep, shippingConfig.enabled, shippingSettings, subtotalInCents]);
  const shippingInCents = shippingConfig.enabled
    ? selectedShippingOption?.amountCents ?? 0
    : legacyShippingPreview.result?.shippingInCents ?? 0;
  const totalInCents = subtotalInCents + shippingInCents;

  const checkoutPayload = useMemo(
    () => {
      const hasGuestAddress = Object.values(guestAddress).some((value) => value.trim());

      return {
        items: items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        ...(customer
          ? {
              customerAddressId: selectedAddressId || undefined,
            }
          : {
              guestCustomerData,
              guestAddress: hasGuestAddress || shippingSettings.checkoutRequiresAddress !== false ? guestAddress : undefined,
            }),
        ...(shippingConfig.enabled
          ? {
              shippingOptionId: selectedShippingOption?.id,
              shippingOptionProvider: selectedShippingOption?.provider,
              shippingOptionService: selectedShippingOption?.service,
              shippingDestinationCep: checkoutCep,
            }
          : {
              selectedShippingMethod: legacyShippingPreview.result?.shippingMethod,
            }),
      };
    },
    [
      checkoutCep,
      customer,
      guestAddress,
      guestCustomerData,
      items,
      legacyShippingPreview.result?.shippingMethod,
      selectedAddressId,
      selectedShippingOption?.id,
      selectedShippingOption?.provider,
      selectedShippingOption?.service,
      shippingConfig.enabled,
      shippingSettings.checkoutRequiresAddress,
    ],
  );

  const selectShippingOption = useCallback(
    (option: ShippingQuoteOption) => {
      if (!normalizedCheckoutCep || !cartSignature || !isShippingOptionValidForCep(option, normalizedCheckoutCep)) return;

      const selection = {
        cartSignature,
        cep: normalizedCheckoutCep,
        option,
      };

      setSelectedShipping(selection);
      setShippingError(null);
      persistShippingSelection(selection);
    },
    [cartSignature, normalizedCheckoutCep],
  );

  const requestShippingQuote = useCallback(
    async ({
      preferredOptionId,
      autoSelectSingle = false,
      signal,
    }: {
      preferredOptionId?: string | null;
      autoSelectSingle?: boolean;
      signal?: AbortSignal;
    } = {}) => {
      const normalizedCep = normalizedCheckoutCep;
      if (!normalizedCep) {
        setShippingError("Digite um CEP válido para calcular o frete.");
        return;
      }

      const requestId = shippingRequestId.current + 1;
      shippingRequestId.current = requestId;
      setShippingLoading(true);
      setShippingError(null);
      setSelectedShipping(null);
      setShippingQuoteContext(null);
      setShippingOptions([]);
      clearStoredShippingSelection();

      try {
        const response = await fetch("/api/shipping/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal,
          body: JSON.stringify({
            cep: normalizedCep,
            items: items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
            })),
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Frete indisponível.");

        const nextOptions = (data.options ?? []) as ShippingQuoteOption[];
        setShippingQuoteContext({ cartSignature, cep: normalizedCep });
        setShippingOptions(nextOptions);

        const resolvedOption = resolveShippingOptionSelection(nextOptions, {
          normalizedCep,
          preferredOptionId,
          autoSelectSingle,
        });

        if (resolvedOption) {
          const selection = {
            cartSignature,
            cep: normalizedCep,
            option: resolvedOption,
          };
          setSelectedShipping(selection);
          persistShippingSelection(selection);
        } else if (nextOptions.length > 0) {
          setShippingError(null);
        }

        if (data.disabled) {
          setShippingError(data.message ?? "Frete automático desativado; entrega combinada manualmente.");
        }
      } catch (quoteError) {
        if (signal?.aborted) return;
        const message = quoteError instanceof Error ? quoteError.message : "Frete indisponível.";
        setShippingError(formatShippingError(message));
      } finally {
        if (shippingRequestId.current === requestId) {
          setShippingLoading(false);
        }
      }
    },
    [cartSignature, items, normalizedCheckoutCep],
  );

  useEffect(() => {
    if (!shippingConfig.enabled) return;
    if (!selectedShipping) return;
    if (selectedShipping.cartSignature !== cartSignature || selectedShipping.cep !== normalizedCheckoutCep) {
      queueMicrotask(() => setSelectedShipping(null));
      clearStoredShippingSelection();
    }
  }, [cartSignature, normalizedCheckoutCep, selectedShipping, shippingConfig.enabled]);

  useEffect(() => {
    if (!shippingConfig.enabled || !cartSignature || !normalizedCheckoutCep) return;
    if (selectedShippingOption || currentShippingOptions.length || shippingError) return;

    const storedSelection = readStoredShippingSelection(cartSignature, normalizedCheckoutCep);
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      void requestShippingQuote({
        preferredOptionId: storedSelection?.option.id,
        autoSelectSingle: true,
        signal: controller.signal,
      });
    });

    return () => controller.abort();
  }, [
    cartSignature,
    currentShippingOptions.length,
    normalizedCheckoutCep,
    requestShippingQuote,
    selectedShippingOption,
    shippingConfig.enabled,
    shippingError,
  ]);

  function updateGuestCustomer(field: keyof typeof emptyGuestCustomer, value: string) {
    setGuestCustomerData((current) => ({ ...current, [field]: value }));
  }

  function resetSelectedShipping() {
    setShippingOptions([]);
    setShippingQuoteContext(null);
    setSelectedShipping(null);
    setShippingError(null);
    clearStoredShippingSelection();
  }

  async function calculateShipping() {
    await requestShippingQuote({ preferredOptionId: selectedShippingOption?.id, autoSelectSingle: true });
  }

  function selectAddress(id: string) {
    setSelectedAddressId(id);
    resetSelectedShipping();
  }

  function updateGuestAddress(field: keyof typeof emptyGuestAddress, value: string) {
    setGuestAddress((current) => ({ ...current, [field]: value }));
    if (field === "cep") {
      resetSelectedShipping();
    }
  }

  function validateBeforeCheckout() {
    if (customer && shippingSettings.checkoutRequiresAddress !== false && !selectedAddressId) {
      return "Selecione um endereço de entrega.";
    }

    if (!customer) {
      if (!guestCustomerData.name.trim() || !guestCustomerData.email.trim() || !guestCustomerData.phone.trim()) {
        return "Informe nome, e-mail e telefone para finalizar.";
      }

      if (
        shippingSettings.checkoutRequiresAddress !== false &&
        (!guestAddress.cep.trim() ||
          !guestAddress.street.trim() ||
          !guestAddress.number.trim() ||
          !guestAddress.neighborhood.trim() ||
          !guestAddress.city.trim() ||
          !guestAddress.state.trim())
      ) {
        return "Informe o endereço de entrega.";
      }
    }

    if (shippingConfig.enabled && !selectedShippingOption) {
      return "Escolha uma opção de entrega para continuar.";
    }

    if (shippingError) {
      return formatShippingError(shippingError);
    }

    if (legacyShippingPreview.error) {
      return formatCheckoutMessage(legacyShippingPreview.error);
    }

    return null;
  }

  async function checkout() {
    const validationError = validateBeforeCheckout();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkoutPayload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Falha ao iniciar checkout.");
      window.location.href = data.url;
    } catch (checkoutError) {
      const message = checkoutError instanceof Error ? checkoutError.message : "Falha ao iniciar checkout.";
      setError(formatCheckoutMessage(message));
      setLoading(false);
    }
  }

  if (!items.length) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center lg:px-8">
        <div className="mx-auto max-w-xl rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-12">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-neutral-500">Finalizar compra</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-neutral-950">Sua seleção ainda está vazia.</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-neutral-500">
            Adicione uma peça para iniciar o checkout.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/categoria/destaques"
              className="inline-flex min-h-12 items-center justify-center rounded-lg bg-black px-6 text-sm font-black uppercase tracking-wide text-white transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
            >
              Ver destaques
            </Link>
            <Link
              href="/categoria/tudo"
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-neutral-300 px-6 text-sm font-black uppercase tracking-wide text-neutral-950 transition hover:border-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
            >
              Explorar catálogo
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8 lg:py-12">
      <h1 className="text-2xl font-black text-neutral-950 lg:text-3xl">Finalizar compra</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <CartItems items={items} updateQuantity={updateQuantity} removeItem={removeItem} />

          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-neutral-700" />
              <h2 className="text-lg font-black text-neutral-950">Dados de contato</h2>
            </div>

            {customer ? (
              <div className="mt-4 rounded-lg bg-neutral-50 p-4 text-sm font-semibold text-neutral-600">
                <p className="font-black text-neutral-950">{customer.name}</p>
                <p>{customer.email}</p>
                <p>{customer.phone ?? "Telefone não cadastrado"}</p>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Nome">
                  <input value={guestCustomerData.name} onChange={(event) => updateGuestCustomer("name", event.target.value)} className="admin-input" />
                </Field>
                <Field label="E-mail">
                  <input
                    value={guestCustomerData.email}
                    onChange={(event) => updateGuestCustomer("email", event.target.value)}
                    type="email"
                    className="admin-input"
                  />
                </Field>
                <Field label="Telefone">
                  <input
                    value={guestCustomerData.phone}
                    onChange={(event) => updateGuestCustomer("phone", event.target.value)}
                    inputMode="tel"
                    className="admin-input"
                  />
                </Field>
                <Field label="CPF opcional">
                  <input value={guestCustomerData.cpf} onChange={(event) => updateGuestCustomer("cpf", event.target.value)} className="admin-input" />
                </Field>
                <p className="text-sm font-semibold text-neutral-500 sm:col-span-2">
                  Você pode criar uma conta depois para acompanhar próximos pedidos.
                </p>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-neutral-700" />
                <h2 className="text-lg font-black text-neutral-950">Entrega</h2>
              </div>
              {customer ? (
                <Link href="/minha-conta/enderecos" className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-black">
                  Cadastrar ou editar
                </Link>
              ) : null}
            </div>

            {customer ? (
              <LoggedAddressSelector addresses={addresses} selectedAddressId={selectedAddressId} onSelect={selectAddress} />
            ) : (
              <GuestAddressForm guestAddress={guestAddress} onChange={updateGuestAddress} />
            )}

            {shippingSettings.shippingInstructions ? (
              <p className="mt-4 rounded-lg bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-600">{shippingSettings.shippingInstructions}</p>
            ) : null}

            {shippingConfig.enabled ? (
              <div className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-neutral-950">Escolha uma forma de entrega</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-neutral-500">
                      {isFixedShipping
                        ? "Entrega combinada com valor fixo para este pedido."
                        : isMelhorEnvioShipping
                          ? "Frete calculado automaticamente pelo Melhor Envio."
                          : "Calcule pelo CEP para escolher PAC ou SEDEX antes de finalizar."}
                    </p>
                  </div>
                  {isFixedShipping ? null : (
                    <button
                      type="button"
                      onClick={calculateShipping}
                      disabled={shippingLoading}
                      className="inline-flex h-11 items-center justify-center rounded-lg bg-black px-5 text-xs font-black uppercase tracking-wide text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:bg-neutral-500"
                    >
                      {shippingLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Calcule o frete
                    </button>
                  )}
                </div>
                <p className="mt-3 text-xs font-bold text-neutral-500">
                  {checkoutCep ? `CEP usado: ${formatCep(checkoutCep) || checkoutCep}` : "Digite seu CEP no endereço de entrega."}
                </p>
                {currentShippingOptions.length ? (
                  <div className="mt-4 grid gap-2">
                    {currentShippingOptions.map((option) => (
                      <label
                        key={option.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-4 text-sm font-semibold text-neutral-600 transition hover:border-neutral-950/40 ${
                          selectedShippingOption?.id === option.id ? "border-neutral-950 shadow-[0_12px_30px_rgba(15,23,42,0.08)]" : "border-neutral-200"
                        }`}
                      >
                        <input
                          type="radio"
                          name="shippingOption"
                          checked={selectedShippingOption?.id === option.id}
                          onChange={() => selectShippingOption(option)}
                          className="mt-1 h-4 w-4"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-4">
                            <span className="font-black text-neutral-950">
                              {option.provider === "fixed" || option.provider === "melhor_envio" ? option.label : option.service}
                            </span>
                            <span className="whitespace-nowrap font-black text-success">{formatMoney(option.amountCents)}</span>
                          </span>
                          <span className="mt-1 block">{option.deliveryEstimateText}</span>
                          {option.provider === "fixed" || option.provider === "melhor_envio" ? (
                            <span className="mt-2 block text-xs font-bold text-neutral-500">Prazo estimado em dias úteis.</span>
                          ) : null}
                          {option.provider === "manual" ? (
                            <span className="mt-2 block text-xs font-bold text-neutral-500">Cálculo manual/fallback para homologação.</span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : null}
                {shippingError ? <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">{shippingError}</p> : null}
                {currentShippingOptions.length && !selectedShippingOption ? (
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                    {isFixedShipping
                      ? "Selecione Frete fixo para fechar o pedido."
                      : isMelhorEnvioShipping
                        ? "Escolha uma forma de entrega para fechar o pedido."
                        : "Selecione PAC ou SEDEX para fechar o pedido."}
                  </p>
                ) : null}
                <p className="mt-3 text-xs font-semibold leading-5 text-neutral-500">
                  {isFixedShipping
                    ? "Entrega combinada com valor fixo para este pedido."
                    : isMelhorEnvioShipping
                      ? "Frete calculado automaticamente pelo Melhor Envio. Valor e prazo podem variar conforme disponibilidade."
                      : "Frete e prazo podem variar conforme endereço e disponibilidade."}
                </p>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="h-fit rounded-lg border border-neutral-200 bg-white p-5 lg:sticky lg:top-36">
          <h2 className="text-lg font-black text-neutral-950">Resumo do pedido</h2>
          <div className="mt-5 space-y-3 text-sm font-semibold text-neutral-600">
            <div className="flex justify-between gap-4">
              <span>Subtotal</span>
              <span className="whitespace-nowrap">{formatMoney(subtotalInCents)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Frete</span>
              <span className="whitespace-nowrap text-right">
                {shippingConfig.enabled
                  ? selectedShippingOption
                    ? `${
                        selectedShippingOption.provider === "fixed" || selectedShippingOption.provider === "melhor_envio"
                          ? selectedShippingOption.label
                          : selectedShippingOption.service
                      } · ${formatMoney(shippingInCents)}`
                    : shippingLoading
                      ? "Calculando frete"
                      : normalizedCheckoutCep
                        ? isFixedShipping
                          ? "Aguardando frete fixo"
                        : isMelhorEnvioShipping
                          ? "Escolha uma forma"
                          : "Escolha uma opção"
                        : isFixedShipping
                          ? "Informe o CEP"
                          : "Calcule o frete"
                  : legacyShippingPreview.result
                    ? shippingInCents
                      ? formatMoney(shippingInCents)
                      : legacyShippingPreview.result.shippingMethod
                    : "A calcular"}
              </span>
            </div>
            {selectedShippingOption?.destinationCep || legacyShippingPreview.result?.shippingCep ? (
              <div className="flex justify-between gap-4 text-xs text-neutral-500">
                <span>CEP</span>
                <span>{formatCep(selectedShippingOption?.destinationCep ?? legacyShippingPreview.result?.shippingCep)}</span>
              </div>
            ) : null}
            {shippingConfig.enabled && !selectedShippingOption ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                {shippingLoading
                  ? "Calculando opções de entrega."
                  : normalizedCheckoutCep
                    ? currentShippingOptions.length
                      ? isFixedShipping
                        ? "Selecione Frete fixo para fechar o pedido."
                        : isMelhorEnvioShipping
                          ? "Escolha uma forma de entrega para fechar o pedido."
                          : "Selecione PAC ou SEDEX para fechar o pedido."
                      : isFixedShipping
                        ? "Aguarde a validação do frete fixo."
                        : "Escolha uma entrega para continuar."
                    : isFixedShipping
                      ? "Informe o CEP do endereço de entrega."
                      : "Calcule o frete com seu CEP."}
              </p>
            ) : null}
            {legacyShippingPreview.error ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                {formatCheckoutMessage(legacyShippingPreview.error)}
              </p>
            ) : null}
            <div className="border-t border-neutral-200 pt-4">
              <div className="flex justify-between gap-4 text-xl font-black text-neutral-950">
                <span>Total</span>
                <span className="whitespace-nowrap">{formatMoney(totalInCents)}</span>
              </div>
            </div>
          </div>
          {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
          <button
            type="button"
            onClick={checkout}
            disabled={loading || (shippingConfig.enabled && !selectedShippingOption)}
            className="mt-6 flex h-12 w-full items-center justify-center rounded-lg bg-black px-6 text-sm font-black uppercase tracking-wide text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:bg-neutral-500"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Finalizar compra
          </button>
          <p className="mt-3 text-center text-xs font-bold text-neutral-500">Pagamento seguro pelos métodos habilitados na Stripe</p>
          <div className="mt-4 grid gap-2 border-t border-neutral-200 pt-4 text-center text-xs font-bold text-neutral-500 sm:grid-cols-2">
            <Link href="/politica-de-envio" className="underline underline-offset-4 hover:text-neutral-950">
              Política de envio
            </Link>
            <Link href="/trocas-e-devolucoes" className="underline underline-offset-4 hover:text-neutral-950">
              Trocas e devoluções
            </Link>
          </div>
          <Link
            href="/categoria/tudo"
            className="mt-5 flex h-11 items-center justify-center rounded-lg border border-neutral-300 px-4 text-sm font-black uppercase tracking-wide text-neutral-950"
          >
            Continuar comprando
          </Link>
        </aside>
      </div>
    </div>
  );
}

function CartItems({
  items,
  updateQuantity,
  removeItem,
}: {
  items: CartItem[];
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div className="hidden grid-cols-[1fr_100px_110px_130px_110px] bg-neutral-50 px-5 py-3 text-xs font-black uppercase tracking-wide text-neutral-500 lg:grid">
        <span>Produto</span>
        <span>Tamanho</span>
        <span>Preço</span>
        <span>Qtd</span>
        <span>Total</span>
      </div>
      <div className="divide-y divide-neutral-200">
        {items.map((item) => (
          <div key={item.variantId} className="grid gap-4 px-4 py-5 lg:grid-cols-[1fr_100px_110px_130px_110px] lg:items-center lg:px-5">
            <div className="flex gap-4">
              <div className="h-24 w-20 shrink-0 overflow-hidden rounded-md bg-neutral-100">
                {item.image ? (
                  <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                ) : (
                  <ProductMediaPlaceholder compact />
                )}
              </div>
              <div>
                <Link href={`/produto/${item.slug}`} className="font-black text-neutral-950 hover:underline">
                  {item.title}
                </Link>
                <p className="mt-1 text-sm font-semibold text-neutral-500 lg:hidden">Tamanho: {item.size}</p>
                <button
                  type="button"
                  onClick={() => removeItem(item.variantId)}
                  className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-neutral-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Remover
                </button>
              </div>
            </div>
            <span className="hidden text-sm font-semibold text-neutral-700 lg:block">{item.size}</span>
            <span className="whitespace-nowrap text-sm font-bold text-neutral-950">{formatMoney(item.priceInCents)}</span>
            <div className="flex h-10 w-32 items-center rounded-lg border border-neutral-300">
              <button
                type="button"
                onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                className="flex h-10 w-10 items-center justify-center"
                aria-label="Diminuir quantidade"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="flex-1 text-center text-sm font-black">{item.quantity}</span>
              <button
                type="button"
                onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                className="flex h-10 w-10 items-center justify-center"
                aria-label="Aumentar quantidade"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <span className="whitespace-nowrap text-sm font-black text-neutral-950">{formatMoney(item.priceInCents * item.quantity)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function LoggedAddressSelector({
  addresses,
  selectedAddressId,
  onSelect,
}: {
  addresses: CheckoutAddress[];
  selectedAddressId: string;
  onSelect: (id: string) => void;
}) {
  if (!addresses.length) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-neutral-300 px-4 py-6 text-sm font-semibold text-neutral-600">
        <p>Nenhum endereço cadastrado.</p>
        <Link href="/minha-conta/enderecos" className="mt-3 inline-flex rounded-lg bg-black px-4 py-2 text-xs font-black uppercase text-white">
          Cadastrar endereço
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-3">
      {addresses.map((address) => (
        <label key={address.id} className="flex cursor-pointer gap-3 rounded-lg border border-neutral-200 p-4 text-sm font-semibold text-neutral-600">
          <input
            type="radio"
            name="customerAddressId"
            value={address.id}
            checked={selectedAddressId === address.id}
            onChange={() => onSelect(address.id)}
            className="mt-1 h-4 w-4"
          />
          <span>
            <span className="block font-black text-neutral-950">
              {address.label || "Endereço"} {address.isDefault ? "· Padrão" : ""}
            </span>
            <span className="mt-1 block">
              {address.street}, {address.number}
              {address.complement ? ` - ${address.complement}` : ""}
            </span>
            <span className="block">
              {address.neighborhood} · {address.city}/{address.state} · CEP {formatCep(address.cep) || address.cep}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}

function GuestAddressForm({
  guestAddress,
  onChange,
}: {
  guestAddress: typeof emptyGuestAddress;
  onChange: (field: keyof typeof emptyGuestAddress, value: string) => void;
}) {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <Field label="CEP">
        <input value={guestAddress.cep} onChange={(event) => onChange("cep", event.target.value)} inputMode="numeric" className="admin-input" />
      </Field>
      <Field label="Rua">
        <input value={guestAddress.street} onChange={(event) => onChange("street", event.target.value)} className="admin-input" />
      </Field>
      <Field label="Número">
        <input value={guestAddress.number} onChange={(event) => onChange("number", event.target.value)} className="admin-input" />
      </Field>
      <Field label="Complemento">
        <input value={guestAddress.complement} onChange={(event) => onChange("complement", event.target.value)} className="admin-input" />
      </Field>
      <Field label="Bairro">
        <input value={guestAddress.neighborhood} onChange={(event) => onChange("neighborhood", event.target.value)} className="admin-input" />
      </Field>
      <Field label="Cidade">
        <input value={guestAddress.city} onChange={(event) => onChange("city", event.target.value)} className="admin-input" />
      </Field>
      <Field label="Estado">
        <input
          value={guestAddress.state}
          onChange={(event) => onChange("state", event.target.value.toUpperCase())}
          maxLength={2}
          className="admin-input uppercase"
        />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">{label}</span>
      {children}
    </label>
  );
}
