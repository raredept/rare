import type { Metadata } from "next";
import Link from "next/link";
import { getAdminHomePath } from "@/lib/admin-permissions";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sem acesso", robots: { index: false, follow: false } };

export default async function AdminAccessDeniedPage() {
  const admin = await requireAdmin("self.account");

  return (
    <div className="max-w-xl rounded-lg border border-neutral-200 bg-white p-6">
      <h1 className="text-2xl font-black text-neutral-950">Sem acesso a esta área</h1>
      <p className="mt-2 text-sm text-neutral-600">
        O seu papel não inclui esta área do Admin. Se precisar dela, peça a um Administrador de Sistema.
      </p>
      <Link href={getAdminHomePath(admin.role)} className="mt-5 inline-flex h-11 items-center rounded-lg bg-black px-5 text-sm font-black text-white">
        Ir para o início
      </Link>
    </div>
  );
}
