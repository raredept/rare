import type { ReactNode } from "react";
import { StoreChrome } from "@/components/store/store-chrome";

export const dynamic = "force-dynamic";

// UIUX-404-001: a group of its own, WITHOUT the store's loading.tsx. With that Suspense boundary the
// shell streams first and Next can only answer 200; here notFound() runs before anything is sent,
// so an unknown URL keeps its HTTP 404 while showing the store header, search and footer.
export default async function StoreMissingLayout({ children }: { children: ReactNode }) {
  return <StoreChrome>{children}</StoreChrome>;
}
