"use client";

import type { LucideIcon } from "lucide-react";
import {
  Bell,
  ChartNoAxesCombined,
  Boxes,
  ClipboardCheck,
  FolderTree,
  Image,
  LayoutDashboard,
  PackageCheck,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const navSections: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Operação",
    items: [
      { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
      { href: "/admin/analytics", label: "Analytics", icon: ChartNoAxesCombined },
      { href: "/admin/orders", label: "Pedidos", icon: PackageCheck },
      { href: "/admin/customers", label: "Clientes", icon: Users },
      { href: "/admin/notifications", label: "Notificações", icon: Bell },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { href: "/admin/products", label: "Produtos", icon: Boxes },
      { href: "/admin/categories", label: "Categorias", icon: FolderTree },
      { href: "/admin/banners", label: "Banners", icon: Image },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/admin/readiness", label: "Prontidão", icon: ClipboardCheck },
      { href: "/admin/settings", label: "Configurações", icon: Settings },
    ],
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({
  unreadNotifications = 0,
  onNavigate,
}: {
  unreadNotifications?: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação administrativa" className="space-y-6">
      {navSections.map((section) => (
        <div key={section.label}>
          <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">
            {section.label}
          </p>
          <div className="grid gap-1">
            {section.items.map((item) => {
              const active = isActivePath(pathname, item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                    active
                      ? "border-white bg-white text-black"
                      : "border-transparent text-neutral-400 hover:border-neutral-800 hover:bg-neutral-900 hover:text-white"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
                  <span>{item.label}</span>
                  {item.href === "/admin/notifications" && unreadNotifications > 0 ? (
                    <span
                      className={`admin-nav-badge ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black ${
                        active ? "bg-black text-white" : "bg-white text-black"
                      }`}
                      aria-label={`${unreadNotifications} notificações não lidas`}
                    >
                      {unreadNotifications > 99 ? "99+" : unreadNotifications}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
