"use client";

import { Bell, ExternalLink, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/app/admin/(protected)/actions";
import { AdminNav } from "@/components/admin/admin-nav";

const focusableSelector = "a[href],button:not([disabled]),[tabindex]:not([tabindex='-1'])";

const routeLabels = [
  { path: "/admin/analytics", label: "Analytics" },
  { path: "/admin/products/new", label: "Novo produto" },
  { path: "/admin/products", label: "Produtos" },
  { path: "/admin/categories", label: "Categorias" },
  { path: "/admin/banners", label: "Banners" },
  { path: "/admin/orders", label: "Pedidos" },
  { path: "/admin/notifications", label: "Notificações" },
  { path: "/admin/customers", label: "Clientes" },
  { path: "/admin/readiness", label: "Prontidão" },
  { path: "/admin/settings", label: "Configurações" },
];

function getPageLabel(pathname: string) {
  if (pathname === "/admin") return "Visão geral";
  const route = routeLabels.find(({ path }) => pathname === path || pathname.startsWith(`${path}/`));
  if (!route) return "Admin";
  if (pathname === route.path || route.path === "/admin/products/new") return route.label;
  if (route.path === "/admin/products") return "Editar produto";
  if (route.path === "/admin/categories") return "Editar categoria";
  if (route.path === "/admin/orders") return "Detalhes do pedido";
  if (route.path === "/admin/customers") return "Detalhes do cliente";
  return route.label;
}

export function AdminHeader({
  adminLabel,
  unreadNotifications,
}: {
  adminLabel: string;
  unreadNotifications: number;
}) {
  const pathname = usePathname() ?? "/admin";
  const [menuOpen, setMenuOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const pageLabel = getPageLabel(pathname);

  useEffect(() => {
    if (!menuOpen) return;
    const triggerButton = triggerButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const desktopViewport = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktopViewport.matches) setMenuOpen(false);
    };
    desktopViewport.addEventListener("change", closeOnDesktop);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);
      if (!firstElement || !lastElement) return;
      if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus();
      } else if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
      desktopViewport.removeEventListener("change", closeOnDesktop);
      window.requestAnimationFrame(() => triggerButton?.focus());
    };
  }, [menuOpen]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-neutral-900 bg-black/90 px-4 py-3 backdrop-blur lg:px-8">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              ref={triggerButtonRef}
              type="button"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-neutral-800 text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-900 focus-visible:ring-2 focus-visible:ring-white/70 lg:hidden"
              aria-expanded={menuOpen}
              aria-controls="admin-mobile-navigation"
              aria-label="Abrir menu administrativo"
              onClick={() => setMenuOpen(true)}
            >
              <Menu aria-hidden="true" className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
                <Link href="/admin" className="transition hover:text-white">RARE Admin</Link>
                <span aria-hidden="true">/</span>
                <span className="truncate text-neutral-300" aria-current="page">{pageLabel}</span>
              </div>
              <p className="mt-0.5 truncate text-sm font-black text-white sm:text-base">{pageLabel}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <form action={logoutAction} className="lg:hidden">
              <button type="submit" className="min-h-11 rounded-lg border border-neutral-800 px-3 text-xs font-black text-neutral-300 focus-visible:ring-2 focus-visible:ring-white/70">Sair</button>
            </form>
            <Link
              href="/"
              className="hidden min-h-11 items-center gap-2 rounded-lg border border-neutral-800 px-3 text-xs font-black text-neutral-300 transition hover:border-neutral-600 hover:text-white sm:inline-flex"
            >
              Ver loja
              <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/admin/notifications"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-lg border border-neutral-800 text-neutral-300 transition hover:border-neutral-600 hover:text-white"
              aria-label={unreadNotifications ? `Notificações: ${unreadNotifications} não lidas` : "Notificações"}
            >
              <Bell aria-hidden="true" className="h-4 w-4" />
              {unreadNotifications > 0 ? (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-white ring-2 ring-black" />
              ) : null}
            </Link>
            <div className="hidden max-w-48 truncate text-right text-xs font-semibold text-neutral-400 xl:block">
              {adminLabel}
            </div>
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/75"
            aria-label="Fechar menu administrativo"
            onClick={() => setMenuOpen(false)}
          />
          <div
            ref={dialogRef}
            id="admin-mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-mobile-navigation-title"
            className="absolute inset-y-0 left-0 flex w-[min(88vw,20rem)] flex-col border-r border-neutral-800 bg-neutral-950 p-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <Link id="admin-mobile-navigation-title" href="/admin" onClick={() => setMenuOpen(false)} className="text-lg font-black tracking-[0.18em] text-white">
                RARE <span className="text-xs tracking-[0.14em] text-neutral-500">ADMIN</span>
              </Link>
              <button
                ref={closeButtonRef}
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-neutral-800 text-neutral-300"
                aria-label="Fechar menu administrativo"
                onClick={() => setMenuOpen(false)}
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <div className="scrollbar-none flex-1 overflow-y-auto py-5">
              <AdminNav unreadNotifications={unreadNotifications} onNavigate={() => setMenuOpen(false)} />
            </div>
            <div className="border-t border-neutral-800 pt-4">
              <p className="truncate px-1 text-xs font-semibold text-neutral-500">{adminLabel}</p>
              <form action={logoutAction} className="mt-3">
                <button className="min-h-11 w-full rounded-lg border border-neutral-800 text-sm font-black text-neutral-300 transition hover:border-neutral-300 hover:bg-white hover:text-black" type="submit">
                  Sair
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
