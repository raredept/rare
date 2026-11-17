"use client";

import { useEffect, useState } from "react";

/**
 * UIUX-ADMIN-002: a server-rendered Admin form gets an "alterações não salvas" marker next to its
 * save button and a browser warning when leaving with unsaved edits. With `confirmInstallments`, the
 * installment form asks for confirmation with a plain summary before saving. Presentation only: the
 * form still posts the same fields to the same Server Action, and the server validates as before.
 */
export function AdminUnsavedChanges({ formId, confirmInstallments = false }: { formId: string; confirmInstallments?: boolean }) {
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    let submitting = false;
    const markDirty = () => setDirty(true);
    const onSubmit = (event: SubmitEvent) => {
      if (confirmInstallments && !window.confirm(summarizeInstallmentForm(form))) {
        event.preventDefault();
        return;
      }
      submitting = true;
      setDirty(false);
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!submitting && form.dataset.dirty === "true") {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const track = () => {
      form.dataset.dirty = "true";
      markDirty();
    };
    form.addEventListener("input", track);
    form.addEventListener("change", track);
    form.addEventListener("submit", onSubmit);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      form.removeEventListener("input", track);
      form.removeEventListener("change", track);
      form.removeEventListener("submit", onSubmit);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [formId, confirmInstallments]);

  return (
    <span role="status" aria-live="polite" className="text-xs font-black uppercase tracking-wide text-amber-700">
      {dirty ? "Alterações não salvas nesta seção" : ""}
    </span>
  );
}

/** "Parcelamento ativado · até 12x · parcela mínima R$ 10,00 · 4x: 9% · 5x: 10% …" */
export function summarizeInstallmentForm(form: HTMLFormElement) {
  const data = new FormData(form);
  const enabled = data.get("cardInstallmentsEnabled") ? "ativado" : "desativado";
  const max = Number(data.get("cardInstallmentsMax") ?? 1);
  const rates: string[] = [];
  for (let count = 4; count <= Math.min(12, max); count += 1) {
    const value = String(data.get(`rate${count}x`) ?? "").trim();
    rates.push(`${count}x: ${value ? `${value}%` : "não oferecido"}`);
  }
  return [
    "Salvar o parcelamento com estas regras? Vale para pedidos novos.",
    "",
    `Parcelamento ${enabled} · até ${max}x · parcela mínima ${String(data.get("cardInstallmentsMin") ?? "").trim()}`,
    "1x a 3x: sem juros",
    ...rates,
  ].join("\n");
}
