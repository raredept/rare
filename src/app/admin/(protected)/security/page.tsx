import { getAdminMfaConfigurationIssue, getAdminMfaPolicyWarning, isAdminMfaRequired } from "@/lib/admin-mfa-config";
import { ADMIN_ROLES } from "@/lib/admin-permissions";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const AUDIT_LIMIT = 50;

function formatDateTime(value: Date) {
  return value.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

export default async function AdminSystemSecurityPage() {
  await requireAdmin("system.security");
  const adminFilter = { role: { in: [...ADMIN_ROLES] }, active: true };
  const [activeAdmins, withoutMfa, legacyRole, mustChangePassword, events] = await Promise.all([
    prisma.user.count({ where: adminFilter }),
    prisma.user.count({ where: { ...adminFilter, mfaEnabledAt: null } }),
    prisma.user.count({ where: { ...adminFilter, role: "ADMIN" } }),
    prisma.user.count({ where: { ...adminFilter, mustChangePassword: true } }),
    prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: AUDIT_LIMIT,
      select: { id: true, createdAt: true, actorLabel: true, action: true, entityType: true, entityId: true },
    }),
  ]);
  const mfaRequired = isAdminMfaRequired();
  const mfaIssue = getAdminMfaConfigurationIssue();
  const mfaWarning = getAdminMfaPolicyWarning();

  const stats = [
    { label: "Contas Admin ativas", value: activeAdmins },
    { label: "Sem segundo fator", value: withoutMfa },
    { label: "Com papel legado", value: legacyRole },
    { label: "Com troca de senha pendente", value: mustChangePassword },
  ];

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-black text-neutral-950">Segurança do sistema</h1>
      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-5" aria-labelledby="mfa-policy-title">
        <h2 id="mfa-policy-title" className="text-lg font-black text-neutral-950">Política de verificação em duas etapas</h2>
        <p className="mt-2 text-sm font-semibold">{mfaRequired ? "Obrigatória para todas as contas Admin." : "Não obrigatória neste ambiente."}</p>
        {mfaIssue ? <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{mfaIssue}</p> : null}
        {mfaWarning ? <p className="mt-2 text-sm text-amber-800">{mfaWarning}</p> : null}
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-xs font-black uppercase tracking-wide text-neutral-500">{stat.label}</dt>
              <dd className="mt-1 text-xl font-black">{stat.value}</dd>
            </div>
          ))}
        </dl>
        {legacyRole > 0 ? (
          <p className="mt-4 text-sm text-amber-800">
            Contas com papel legado têm acesso total. Atribua Administrador de Sistema ou Administrador Vendedor em Usuários.
          </p>
        ) : null}
      </section>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-5" aria-labelledby="audit-title">
        <h2 id="audit-title" className="text-lg font-black text-neutral-950">Registro de auditoria</h2>
        <p className="mt-1 text-xs text-neutral-500">Últimas {AUDIT_LIMIT} ações sensíveis. O conteúdo é sanitizado na gravação; segredos nunca são registrados.</p>
        {events.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-600">Nenhum evento registrado.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-xs font-black uppercase tracking-wide text-neutral-500">
                <tr>
                  <th scope="col" className="py-2 pr-4">Quando</th>
                  <th scope="col" className="py-2 pr-4">Quem</th>
                  <th scope="col" className="py-2 pr-4">Ação</th>
                  <th scope="col" className="py-2">Alvo</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-t border-neutral-200">
                    <td className="py-2 pr-4 whitespace-nowrap">{formatDateTime(event.createdAt)}</td>
                    <td className="py-2 pr-4">{event.actorLabel}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{event.action}</td>
                    <td className="py-2 font-mono text-xs">{event.entityType}{event.entityId ? ` · ${event.entityId.slice(0, 12)}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
