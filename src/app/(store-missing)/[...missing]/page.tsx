import { notFound } from "next/navigation";

// UIUX-404-001: any URL no other route matches lands here and renders (store-missing)/not-found.tsx
// inside the store frame, with status 404 (no loading boundary in this group, so nothing streams first).
export default function MissingStorePage() {
  notFound();
}
