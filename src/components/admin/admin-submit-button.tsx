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
};

export function AdminSubmitButton({ idleLabel, pendingLabel, className = "", disabled = false, icon }: AdminSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={`${className} inline-flex items-center justify-center gap-2 transition disabled:cursor-not-allowed disabled:opacity-60`}
      aria-busy={pending}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
