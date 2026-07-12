import type { ReactNode } from "react";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata = buildNoIndexMetadata({
  title: "Minha conta | RARE",
  description: "Área privada do cliente RARE.",
  path: "/minha-conta",
});

export default function CustomerAccountLayout({ children }: { children: ReactNode }) {
  return children;
}
