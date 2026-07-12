import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { buildNoIndexMetadata } from "@/lib/seo";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = buildNoIndexMetadata({
  title: "Admin RARE",
  description: "Área administrativa privada da RARE.",
  path: "/admin",
});

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={geistMono.variable}>{children}</div>;
}
