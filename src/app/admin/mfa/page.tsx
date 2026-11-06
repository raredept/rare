import { redirect } from "next/navigation";
import { MfaChallengeForm } from "@/app/admin/mfa/mfa-forms";
import { getPendingMfaAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminMfaPage() {
  const admin = await getPendingMfaAdmin();
  if (!admin) redirect("/admin/login");
  if (!admin.mfaEnabledAt) redirect("/admin/mfa/setup");

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4 py-12">
      <section className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-sm sm:p-8" aria-labelledby="mfa-title">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-neutral-500">RARE Admin</p>
        <h1 id="mfa-title" className="mt-3 text-2xl font-black text-neutral-950">Verificação em duas etapas</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Digite o código de 6 dígitos do aplicativo autenticador. Sem acesso ao aplicativo? Use um dos códigos de recuperação.
        </p>
        <MfaChallengeForm />
      </section>
    </main>
  );
}
