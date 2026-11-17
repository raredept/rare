"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { describeCardInstallmentPlan, type CardInstallmentPlan } from "@/lib/card-installments";

/**
 * UIUX-CHECKOUT-001: compact installment picker. Closed, it takes one row (the chosen plan, with its
 * card total when it has a surcharge). Open, the same native radio group as before — grouped into
 * interest-free and surcharged, inside a box with its own scroll — so the order total stays in view.
 *
 * Presentation only: the plans come from listCardInstallmentPlans and the server recomputes the
 * chosen count at checkout. The text of every option is describeCardInstallmentPlan, unchanged.
 */
export function CardInstallmentSelector({
  plans,
  selectedPlan,
  onSelect,
  disabled = false,
}: {
  plans: CardInstallmentPlan[];
  selectedPlan: CardInstallmentPlan | null;
  onSelect: (installmentCount: number) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const id = useId();
  const panelId = `${id}-installments`;
  const labelId = `${id}-installments-label`;

  // Keyboard users land on the chosen option (arrow keys then move inside the native radio group).
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLInputElement>('input[name="card-installments"]:checked')?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    window.setTimeout(() => toggleRef.current?.focus(), 0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }

  // A pointer pick closes the list; arrow keys (click events with detail 0) keep it open.
  function handleOptionClick(event: MouseEvent<HTMLLabelElement>) {
    if (event.detail > 0) close();
  }

  const groups = [
    { key: "free", label: "Sem juros", plans: plans.filter((plan) => plan.interestFree) },
    { key: "surcharged", label: "Com acréscimo", plans: plans.filter((plan) => !plan.interestFree) },
  ].filter((group) => group.plans.length);

  return (
    // text-sm here: the global `button { font: inherit }` makes the toggle take its size from this box.
    <div className="mt-5 text-sm">
      <p id={labelId} className="text-sm font-black text-neutral-950">Parcelamento no cartão</p>
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-describedby={labelId}
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        className="mt-2 flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-neutral-950 bg-neutral-50 px-3 py-2 text-left text-sm transition hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:cursor-wait disabled:opacity-60"
        data-testid="card-installment-toggle"
      >
        <span className="min-w-0 font-semibold text-neutral-800">{selectedPlan ? describeCardInstallmentPlan(selectedPlan) : "Escolha o parcelamento"}</span>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-black uppercase tracking-wide text-neutral-950">
          {open ? "Fechar" : "Alterar"}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </span>
      </button>
      <div id={panelId} ref={panelRef} hidden={!open} onKeyDown={handleKeyDown}>
        <fieldset
          className="mt-2 max-h-[min(22rem,55vh)] overflow-y-auto overscroll-contain rounded-lg border border-neutral-300 bg-white p-2"
          disabled={disabled}
        >
          <legend className="sr-only">Parcelamento no cartão</legend>
          {groups.map((group) => (
            <div key={group.key} role="group" aria-label={group.label} className="py-1">
              <p aria-hidden="true" className="px-1 pb-1 pt-1 text-xs font-black uppercase tracking-[0.14em] text-neutral-500">{group.label}</p>
              <div className="grid gap-1">
                {group.plans.map((plan) => {
                  const selected = selectedPlan?.installmentCount === plan.installmentCount;
                  return (
                    <label
                      key={plan.installmentCount}
                      onClick={handleOptionClick}
                      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-black ${selected ? "border-neutral-950 bg-neutral-50" : "border-transparent hover:border-neutral-300"}`}
                    >
                      <input
                        type="radio"
                        name="card-installments"
                        value={plan.installmentCount}
                        checked={selected}
                        onChange={() => onSelect(plan.installmentCount)}
                        className="h-4 w-4 shrink-0 accent-black"
                      />
                      <span className="font-semibold text-neutral-800">{describeCardInstallmentPlan(plan)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </fieldset>
      </div>
    </div>
  );
}
