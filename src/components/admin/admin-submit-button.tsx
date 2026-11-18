"use client";

import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type AdminSubmitButtonProps = {
  idleLabel: string;
  pendingLabel: string;
  className?: string;
  disabled?: boolean;
  icon?: ReactNode;
  /** The id of the form to submit, for a button rendered outside it in the DOM (e.g. a portaled bar). */
  form?: string;
  /** Accessible name when the visible label is only a symbol (e.g. ↑ / ↓). */
  ariaLabel?: string;
  title?: string;
};

export function AdminSubmitButton({ idleLabel, pendingLabel, className = "", disabled = false, icon, form, ariaLabel, title }: AdminSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      form={form}
      disabled={disabled || pending}
      className={`${className} inline-flex items-center justify-center gap-2 transition disabled:cursor-not-allowed disabled:opacity-60`}
      aria-busy={pending}
      aria-label={ariaLabel}
      title={title}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
