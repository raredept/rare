"use client";

export type CheckoutPaymentMethod = "card" | "pix";

const options: Array<{ value: CheckoutPaymentMethod; title: string; detail: string }> = [
  { value: "pix", title: "Pix", detail: "QR code ou copia e cola, com confirmação em instantes." },
  { value: "card", title: "Cartão de crédito ou débito", detail: "Pagamento em ambiente seguro da Stripe." },
];

/** Pre-checkout choice. Rendered only when more than one method is available. */
export function PaymentMethodPicker({
  value,
  onChange,
  disabled,
}: {
  value: CheckoutPaymentMethod;
  onChange: (method: CheckoutPaymentMethod) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="mt-5" disabled={disabled}>
      <legend className="text-sm font-black text-neutral-950">Forma de pagamento</legend>
      <div className="mt-3 grid gap-2">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-black ${selected ? "border-neutral-950 bg-neutral-50" : "border-neutral-300 bg-white hover:border-neutral-500"}`}
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
                <span className="block font-black text-neutral-950">{option.title}</span>
                <span className="block font-semibold text-neutral-600">{option.detail}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
