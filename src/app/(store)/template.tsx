import type { ReactNode } from "react";

export default function StoreTemplate({ children }: { children: ReactNode }) {
  return <div className="store-page-transition">{children}</div>;
}
