import Link from "next/link";
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
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8 lg:py-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-neutral-500">Minha conta</p>
          <h1 className="mt-2 text-2xl font-black text-neutral-950 lg:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-2 max-w-2xl text-sm font-medium text-neutral-500">{subtitle}</p> : null}
        </div>
      </div>
      <nav className="scrollbar-none mt-6 flex gap-2 overflow-x-auto border-b border-neutral-200 pb-3">
        {accountLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="whitespace-nowrap rounded-full border border-neutral-300 px-4 py-2 text-xs font-black uppercase tracking-wide text-neutral-800 hover:border-black"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="mt-8">{children}</div>
    </div>
  );
}
