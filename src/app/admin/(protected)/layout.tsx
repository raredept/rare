import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/admin/(protected)/actions";
import { requireAdmin } from "@/lib/auth";

const navItems = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/products", label: "Produtos" },
  { href: "/admin/categories", label: "Categorias" },
  { href: "/admin/orders", label: "Pedidos" },
  { href: "/admin/customers", label: "Clientes" },
  { href: "/admin/settings", label: "Configurações" },
];

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen bg-neutral-100">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-neutral-200 bg-white p-5 lg:block">
        <Link href="/admin" className="text-lg font-black tracking-[0.18em] text-neutral-950">
          RARE
        </Link>
        <nav className="mt-8 grid gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-black text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={logoutAction} className="absolute bottom-5 left-5 right-5">
          <button className="h-11 w-full rounded-lg border border-neutral-300 text-sm font-black text-neutral-950" type="submit">
            Sair
          </button>
        </form>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 px-4 py-4 backdrop-blur lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-neutral-500">Admin</p>
              <p className="text-sm font-semibold text-neutral-700">{admin.email}</p>
            </div>
            <div className="scrollbar-none flex gap-2 overflow-x-auto lg:hidden">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="whitespace-nowrap rounded-full border border-neutral-300 px-3 py-2 text-xs font-black text-neutral-700"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </header>
        <main className="px-4 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
