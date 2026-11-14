import { RegenerateRecoveryCodesForm } from "@/app/admin/(protected)/conta/regenerate-form";
import { countUnusedRecoveryCodes } from "@/lib/admin-mfa";
import { ADMIN_ROLE_LABELS } from "@/lib/admin-permissions";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDateTime(value: Date | null) {
  return value ? value.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—";
}

export default async function AdminAccountPage() {
  const admin = await requireAdmin("self.account");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: admin.id }, select: { mfaEnabledAt: true } });
  const remaining = user.mfaEnabledAt ? await countUnusedRecoveryCodes(admin.id) : 0;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-black text-neutral-950">Minha conta</h1>
      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-5" aria-labelledby="account-role-title">
        <h2 id="account-role-title" className="text-lg font-black text-neutral-950">Acesso</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs font-black uppercase tracking-wide text-neutral-500">Login</dt><dd className="mt-1 font-semibold">{admin.username ?? admin.email}</dd></div>
          <div><dt className="text-xs font-black uppercase tracking-wide text-neutral-500">Papel</dt><dd className="mt-1 font-semibold">{ADMIN_ROLE_LABELS[admin.role]}</dd></div>
        </dl>
        <p className="mt-4 text-xs text-neutral-500">O papel é definido por um Administrador de Sistema em Usuários.</p>
      </section>
      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-5" aria-labelledby="mfa-status-title">
        <h2 id="mfa-status-title" className="text-lg font-black text-neutral-950">Verificação em duas etapas</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-xs font-black uppercase tracking-wide text-neutral-500">Status</dt><dd className="mt-1 font-semibold">{user.mfaEnabledAt ? "Ativa" : "Não ativada"}</dd></div>
          <div><dt className="text-xs font-black uppercase tracking-wide text-neutral-500">Ativada em</dt><dd className="mt-1 font-semibold">{formatDateTime(user.mfaEnabledAt)}</dd></div>
          <div><dt className="text-xs font-black uppercase tracking-wide text-neutral-500">Códigos de recuperação restantes</dt><dd className="mt-1 font-semibold">{user.mfaEnabledAt ? remaining : "—"}</dd></div>
        </dl>
        {user.mfaEnabledAt ? (
          <RegenerateRecoveryCodesForm />
        ) : (
          <p className="mt-4 text-sm text-neutral-600">Saia e entre novamente para ativar a verificação em duas etapas.</p>
        )}
        <p className="mt-4 text-xs text-neutral-500">
          Perdeu o celular e os códigos de recuperação? Um Administrador de Sistema pode redefinir o segundo fator em Usuários
          (ou o responsável técnico, pelo procedimento em docs/runbooks/admin-mfa-recovery.md). A redefinição encerra todas as sessões da conta.
        </p>
      </section>
    </div>
  );
}
