"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

type ConfirmButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  message: string;
  pendingChildren?: ReactNode;
  children: ReactNode;
};

export function ConfirmButton({ message, pendingChildren, children, disabled, onClick, ...props }: ConfirmButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      disabled={disabled || pending}
      aria-busy={pending}
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {pending ? (pendingChildren ?? children) : children}
    </button>
  );
}
