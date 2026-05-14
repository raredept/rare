"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ConfirmButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  message: string;
  children: ReactNode;
};

export function ConfirmButton({ message, children, onClick, ...props }: ConfirmButtonProps) {
  return (
    <button
      {...props}
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {children}
    </button>
  );
}
