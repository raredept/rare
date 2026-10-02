import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { logoutAction } from "@/app/admin/(protected)/actions";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminToast } from "@/components/admin/admin-toast";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  const unreadNotifications = await prisma.adminNotification.count({ where: { readAt: null } });

  return (
    <div className="admin-dark min-h-screen bg-neutral-950 text-neutral-100">
      <Suspense fallback={null}>
        <AdminToast />
      </Suspense>
      <aside aria-label="Menu lateral do Admin" className="fixed inset-y-0 left-0 hidden w-72 border-r border-neutral-900 bg-neutral-950 p-5 shadow-[20px_0_80px_rgba(0,0,0,0.34)] lg:flex lg:flex-col">
        <Link href="/admin" className="block rounded-lg border border-neutral-800 bg-black px-4 py-3 text-lg font-black tracking-[0.18em] text-white">
          RARE
          <span className="admin-brand-subtitle mt-1 block text-[10px] font-black uppercase tracking-[0.22em]">Admin</span>
        </Link>
        <div className="scrollbar-none mt-8 flex-1 overflow-y-auto">
          <AdminNav unreadNotifications={unreadNotifications} />
        </div>
        <div className="mt-5 border-t border-neutral-900 pt-4">
          <p className="truncate px-1 text-xs font-semibold text-neutral-500">{admin.username ?? admin.email}</p>
          <form action={logoutAction} className="mt-3">
            <button
              className="h-11 w-full rounded-lg border border-neutral-800 text-sm font-black text-neutral-300 transition hover:border-neutral-300 hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              type="submit"
            >
              Sair
            </button>
          </form>
        </div>
      </aside>

      <div className="lg:pl-72">
        <AdminHeader adminLabel={admin.username ?? admin.email} unreadNotifications={unreadNotifications} />
        <main id="admin-main-content" className="admin-page-transition mx-auto w-full max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
