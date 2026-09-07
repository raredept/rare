import type { Metadata } from "next";
import localFont from "next/font/local";
import { buildNoIndexMetadata } from "@/lib/seo";

const geistMono = localFont({
  src: "../fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  style: "normal",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
});

export const metadata: Metadata = buildNoIndexMetadata({
  title: "Admin RARE",
  description: "Área administrativa privada da RARE.",
  path: "/admin",
});

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={geistMono.variable}>{children}</div>;
}
