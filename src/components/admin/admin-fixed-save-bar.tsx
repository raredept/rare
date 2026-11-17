"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const subscribeNothing = () => () => {};

/**
 * UIUX-ADMIN-004: a save bar fixed to the bottom of the SCREEN. The Admin's page-entrance animation
 * (`.admin-page-transition`) leaves a transform on <main>, which pins a `fixed` child to the page
 * instead of the screen, so the bar is portaled to <body>. In the React tree it stays inside its
 * <form> (useFormStatus keeps working); its submit button names the form with the `form` attribute.
 * `admin-dark contents` keeps the Admin's dark color remaps without drawing a box of its own.
 */
export function AdminFixedSaveBar({ className, children }: { className: string; children: ReactNode }) {
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  if (!mounted) return null;
  return createPortal(
    <div className="admin-dark contents">
      <div className={className} data-testid="admin-fixed-save-bar">{children}</div>
    </div>,
    document.body,
  );
}
