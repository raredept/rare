import { redirect } from "next/navigation";
import { logoutAction } from "@/app/admin/(protected)/actions";
import { ChangePasswordForm } from "@/app/admin/change-password/change-password-form";
import { getCurrentAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (!admin.mustChangePassword) redirect("/admin");

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4 py-12">
      <section className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-neutral-500">RARE</p>
        <h1 className="mt-3 text-2xl font-black text-neutral-950">Defina uma nova senha</h1>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Este e o primeiro acesso de {admin.username ?? admin.email}. Troque a senha temporaria para liberar o painel administrativo.
        </p>
        <ChangePasswordForm />
        <form action={logoutAction} className="mt-4">
          <button
            type="submit"
            className="h-11 w-full rounded-lg border border-neutral-300 text-sm font-black text-neutral-700 transition hover:border-black hover:text-black"
          >
            Sair
          </button>
        </form>
      </section>
    </main>
  );
}
