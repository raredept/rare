"use client";

import type { LucideIcon } from "lucide-react";
import {
  BadgePercent,
  Bell,
  ChartNoAxesCombined,
  Boxes,
  ClipboardCheck,
  FolderTree,
  Image,
  LayoutDashboard,
  LifeBuoy,
  MousePointerClick,
  PackageCheck,
  Settings,
  ShieldCheck,
  UserCog,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminPermission } from "@/lib/admin-permissions";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: AdminPermission;
};

const navSections: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Operação",
    items: [
      { href: "/admin", label: "Visão geral", icon: LayoutDashboard, permission: "commerce.dashboard" },
      { href: "/admin/analytics", label: "Analytics", icon: ChartNoAxesCombined, permission: "analytics.sales" },
      { href: "/admin/analytics/site", label: "Analytics do site", icon: MousePointerClick, permission: "analytics.site" },
      { href: "/admin/orders", label: "Pedidos", icon: PackageCheck, permission: "commerce.orders" },
      { href: "/admin/customers", label: "Clientes", icon: Users, permission: "commerce.customers" },
      { href: "/admin/notifications", label: "Notificações", icon: Bell, permission: "commerce.notifications" },
      { href: "/admin/support", label: "Suporte", icon: LifeBuoy, permission: "commerce.support" },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { href: "/admin/products", label: "Produtos", icon: Boxes, permission: "commerce.products" },
      { href: "/admin/promotions", label: "Promoções", icon: BadgePercent, permission: "commerce.promotions" },
      { href: "/admin/categories", label: "Categorias", icon: FolderTree, permission: "commerce.catalog" },
      { href: "/admin/banners", label: "Banners", icon: Image, permission: "commerce.catalog" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/admin/users", label: "Usuários", icon: UserCog, permission: "system.users" },
      { href: "/admin/readiness", label: "Prontidão", icon: ClipboardCheck, permission: "system.readiness" },
      { href: "/admin/settings", label: "Configurações", icon: Settings, permission: "system.settings" },
      { href: "/admin/security", label: "Segurança", icon: ShieldCheck, permission: "system.security" },
    ],
  },
  {
    label: "Conta",
    items: [{ href: "/admin/conta", label: "Minha conta", icon: UserRound, permission: "self.account" }],
  },
];

function matchesPath(pathname: string, href: string) {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const allHrefs = navSections.flatMap((section) => section.items.map((item) => item.href));

/** The most specific item wins: /admin/analytics/site is not also "Analytics". */
function isActivePath(pathname: string, href: string) {
  if (!matchesPath(pathname, href)) return false;
  return !allHrefs.some((other) => other.length > href.length && other.startsWith(`${href}/`) && matchesPath(pathname, other));
}

/** Mirrors the server guards so nobody is offered a link that ends on the access-denied page. */
export function AdminNav({
  permissions,
  unreadNotifications = 0,
  onNavigate,
}: {
  permissions: readonly AdminPermission[];
  unreadNotifications?: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const allowed = new Set(permissions);
  const sections = navSections
    .map((section) => ({ ...section, items: section.items.filter((item) => allowed.has(item.permission)) }))
    .filter((section) => section.items.length > 0);

  return (
    <nav aria-label="Navegação administrativa" className="space-y-6">
      {sections.map((section) => (
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
                    // Colours come from .admin-nav-badge (both nav states). Tailwind bg-white would be
                    // remapped by the dark theme and leave black text on a near-black pill.
                    <span className="admin-nav-badge ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black">
                      {unreadNotifications > 99 ? "99+" : unreadNotifications}
                      <span className="sr-only"> não lidas</span>
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
