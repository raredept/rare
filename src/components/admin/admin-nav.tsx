"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/products", label: "Produtos" },
  { href: "/admin/categories", label: "Categorias" },
  { href: "/admin/banners", label: "Banners" },
  { href: "/admin/orders", label: "Pedidos" },
  { href: "/admin/notifications", label: "Notificações" },
  { href: "/admin/customers", label: "Clientes" },
  { href: "/admin/readiness", label: "Prontidão" },
  { href: "/admin/settings", label: "Configurações" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ compact = false, unreadNotifications = 0 }: { compact?: boolean; unreadNotifications?: number }) {
  const pathname = usePathname();

  return (
    <>
      {navItems.map((item) => {
        const active = isActivePath(pathname, item.href);
        const className = compact
          ? `whitespace-nowrap rounded-full border px-3 py-2 text-xs font-black transition ${
              active
                ? "border-white bg-white text-black"
                : "border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-500 hover:text-white"
            }`
          : `rounded-lg border px-3 py-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
              active
                ? "border-white bg-white text-black"
                : "border-transparent text-neutral-400 hover:border-neutral-800 hover:bg-neutral-950 hover:text-white"
            }`;

        return (
          <Link key={item.href} href={item.href} className={className} aria-current={active ? "page" : undefined}>
            <span className="inline-flex items-center gap-2">
              <span>{item.label}</span>
              {item.href === "/admin/notifications" && unreadNotifications > 0 ? (
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black ${
                    active ? "bg-black text-white" : "bg-white text-black"
                  }`}
                >
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </>
  );
}
