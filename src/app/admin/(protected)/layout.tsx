import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { logoutAction } from "@/app/admin/(protected)/actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminToast } from "@/components/admin/admin-toast";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="admin-dark min-h-screen bg-[#050505] text-neutral-100">
      <Suspense fallback={null}>
        <AdminToast />
      </Suspense>
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-neutral-900 bg-[#080808] p-5 shadow-[20px_0_80px_rgba(0,0,0,0.34)] lg:block">
        <Link href="/admin" className="block rounded-lg border border-neutral-800 bg-black px-4 py-3 text-lg font-black tracking-[0.18em] text-white">
          RARE
          <span className="mt-1 block text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Admin</span>
        </Link>
        <nav className="mt-8 grid gap-2">
          <AdminNav />
        </nav>
        <form action={logoutAction} className="absolute bottom-5 left-5 right-5">
          <button
            className="h-11 w-full rounded-lg border border-neutral-800 text-sm font-black text-neutral-300 transition hover:border-neutral-300 hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            type="submit"
          >
            Sair
          </button>
        </form>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-neutral-900 bg-black/85 px-4 py-4 backdrop-blur lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-neutral-500">RARE Admin</p>
              <p className="text-sm font-semibold text-neutral-300">{admin.email}</p>
            </div>
            <div className="scrollbar-none flex gap-2 overflow-x-auto lg:hidden">
              <AdminNav compact />
            </div>
          </div>
        </header>
        <main className="admin-page-transition px-4 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
