"use client";

export type CheckoutPaymentMethod = "card" | "pix";
/** Gateway that takes NEW payments (PAYMENT_PROVIDER), decided on the server. */
export type CheckoutPaymentProvider = "stripe" | "asaas";

// The shopper must read the name of the gateway that will actually charge them. Asaas takes the
// card on its hosted invoice as CREDIT_CARD only (no debit there).
const optionsByProvider: Record<CheckoutPaymentProvider, Array<{ value: CheckoutPaymentMethod; title: string; detail: string }>> = {
  stripe: [
    { value: "pix", title: "Pix", detail: "QR code ou copia e cola, com confirmação em instantes." },
    { value: "card", title: "Cartão de crédito ou débito", detail: "Pagamento em ambiente seguro da Stripe." },
  ],
  asaas: [
    { value: "pix", title: "Pix", detail: "QR code ou copia e cola, com confirmação em instantes." },
    { value: "card", title: "Cartão de crédito", detail: "Pagamento na página segura do Asaas." },
  ],
};

/** Pre-checkout choice. Rendered only when more than one method is available. */
export function PaymentMethodPicker({
  value,
  onChange,
  disabled,
  provider = "stripe",
}: {
  value: CheckoutPaymentMethod;
  onChange: (method: CheckoutPaymentMethod) => void;
  disabled?: boolean;
  provider?: CheckoutPaymentProvider;
}) {
  const options = optionsByProvider[provider];
  return (
    <fieldset className="mt-5" disabled={disabled}>
      <legend className="text-sm font-semibold text-neutral-950">Forma de pagamento</legend>
      <div className="mt-3 grid gap-2">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              className={`flex min-h-12 cursor-pointer items-start gap-3 border p-3 text-sm transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-black ${selected ? "border-neutral-950 bg-neutral-50" : "border-neutral-300 bg-white hover:border-neutral-500"}`}
            >
              <input
                type="radio"
                name="payment-method"
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="mt-1 h-4 w-4 accent-black"
              />
              <span>
                <span className="block font-semibold text-neutral-950">{option.title}</span>
                <span className="block font-normal text-neutral-600">{option.detail}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
