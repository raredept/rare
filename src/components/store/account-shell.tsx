"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const accountLinks = [
  { href: "/minha-conta", label: "Resumo" },
  { href: "/minha-conta/dados", label: "Dados" },
  { href: "/minha-conta/enderecos", label: "Endereços" },
  { href: "/minha-conta/pedidos", label: "Pedidos" },
];

export function AccountShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="store-shell py-10 sm:py-14 lg:py-16">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="store-section-label">Minha conta</p>
          <h1 className="mt-4 text-3xl font-medium tracking-tight text-neutral-950 lg:text-4xl">{title}</h1>
          {subtitle ? <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-600">{subtitle}</p> : null}
        </div>
      </div>
      <nav aria-label="Seções da conta" className="scrollbar-none mt-8 flex gap-6 overflow-x-auto border-b border-neutral-200 sm:gap-8">
        {accountLinks.map((link) => {
          const active = pathname === link.href || (link.href !== "/minha-conta" && pathname.startsWith(`${link.href}/`));
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-2 py-3 text-sm font-medium transition-colors ${active ? "border-neutral-950 text-neutral-950" : "border-transparent text-neutral-600 hover:border-neutral-400 hover:text-neutral-950"}`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-10 lg:mt-12">{children}</div>
    </div>
  );
}
