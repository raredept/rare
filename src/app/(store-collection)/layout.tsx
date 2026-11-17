import type { ReactNode } from "react";
import { StoreChrome } from "@/components/store/store-chrome";

export const dynamic = "force-dynamic";

// RARE-COLLECTIONS-CART-01: /colecao/[slug] lives in a group of its own, WITHOUT the store's
// loading.tsx. With that Suspense boundary the shell streams first and Next can only answer 200;
// here a collection that is not public (scheduled, paused, ended, empty) is decided before anything
// is sent, so it answers a real 404 inside the store frame (same approach as (store-missing)).
export default async function StoreCollectionLayout({ children }: { children: ReactNode }) {
  return <StoreChrome>{children}</StoreChrome>;
}
