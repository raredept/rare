import type { ReactNode } from "react";
import { StoreChrome } from "@/components/store/store-chrome";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: ReactNode }) {
  return <StoreChrome>{children}</StoreChrome>;
}
