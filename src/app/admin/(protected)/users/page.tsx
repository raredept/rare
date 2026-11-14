import { CreateAdminUserForm } from "@/app/admin/(protected)/users/create-user-form";
import {
  assignAdminRoleAction,
  resetAdminUserMfaAction,
  revokeAdminUserSessionsAction,
  setAdminUserActiveAction,
} from "@/app/admin/(protected)/users/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { ADMIN_ROLE_LABELS, ASSIGNABLE_ADMIN_ROLES, isAdminRole } from "@/lib/admin-permissions";
import { listAdminUsers } from "@/lib/admin-users";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const secondaryButton = "h-10 rounded-lg border border-neutral-300 px-3 text-xs font-black hover:bg-neutral-950 hover:text-white";

function formatDate(value: Date | null) {
  return value ? value.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
}

export default async function AdminUsersPage() {
  const admin = await requireAdmin("system.users");
  const users = await listAdminUsers();

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-black text-neutral-950">Usuários</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Administrador de Sistema: usuários, segurança, prontidão, configurações e analytics do site. Administrador Vendedor: pedidos,
        catálogo, estoque, promoções, clientes e analytics. Toda alteração de papel ou status encerra as sessões da conta e fica no registro de auditoria.
      </p>

      <section className="mt-6 grid gap-4" aria-label="Contas Admin">
        {users.map((user) => {
          const self = user.id === admin.id;
          const roleLabel = isAdminRole(user.role) ? ADMIN_ROLE_LABELS[user.role] : user.role;
          return (
            <article key={user.id} className="rounded-lg border border-neutral-200 bg-white p-5" aria-label={`Conta ${user.username ?? user.email}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-neutral-950">
                    {user.name}
                    {self ? <span className="ml-2 rounded bg-neutral-950 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">Você</span> : null}
                  </h2>
                  <p className="text-sm text-neutral-600">{user.email}{user.username ? ` · ${user.username}` : ""}</p>
                  <p className="mt-1 font-mono text-[11px] text-neutral-400">ID {user.id}</p>
                </div>
                <dl className="grid grid-cols-3 gap-4 text-xs">
                  <div><dt className="font-black uppercase tracking-wide text-neutral-500">Status</dt><dd className="mt-1 font-semibold">{user.active ? "Ativa" : "Desativada"}</dd></div>
                  <div><dt className="font-black uppercase tracking-wide text-neutral-500">2 etapas</dt><dd className="mt-1 font-semibold">{user.mfaEnabledAt ? `Desde ${formatDate(user.mfaEnabledAt)}` : "Não cadastrada"}</dd></div>
                  <div><dt className="font-black uppercase tracking-wide text-neutral-500">Papel</dt><dd className="mt-1 font-semibold">{roleLabel}</dd></div>
                </dl>
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-neutral-200 pt-4">
                <form action={assignAdminRoleAction} className="flex items-end gap-2">
                  <input type="hidden" name="userId" value={user.id} />
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-neutral-500">Papel</span>
                    <select name="role" defaultValue={user.role === "ADMIN" ? "" : user.role} required className="admin-input h-10 py-0 text-sm">
                      {user.role === "ADMIN" ? <option value="" disabled>Escolha um papel</option> : null}
                      {ASSIGNABLE_ADMIN_ROLES.map((role) => (
                        <option key={role} value={role} disabled={self && role !== "SYSTEM_ADMIN"}>{ADMIN_ROLE_LABELS[role]}</option>
                      ))}
                    </select>
                  </label>
                  <AdminSubmitButton idleLabel="Salvar papel" pendingLabel="Salvando..." className={secondaryButton} />
                </form>

                {self ? null : (
                  <>
                    <form action={setAdminUserActiveAction}>
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="active" value={user.active ? "false" : "true"} />
                      <AdminSubmitButton idleLabel={user.active ? "Desativar" : "Reativar"} pendingLabel="Salvando..." className={secondaryButton} />
                    </form>
                    <form action={revokeAdminUserSessionsAction}>
                      <input type="hidden" name="userId" value={user.id} />
                      <AdminSubmitButton idleLabel="Encerrar sessões" pendingLabel="Encerrando..." className={secondaryButton} />
                    </form>
                    {user.mfaEnabledAt ? (
                      <details className="w-full">
                        <summary className="cursor-pointer text-xs font-black text-neutral-700">Redefinir segundo fator</summary>
                        <form action={resetAdminUserMfaAction} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                          <input type="hidden" name="userId" value={user.id} />
                          <label className="block flex-1">
                            <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-neutral-500">
                              Motivo (confirme a identidade da pessoa por outro canal antes)
                            </span>
                            <input name="reason" required minLength={8} maxLength={200} className="admin-input h-10 text-sm" />
                          </label>
                          <AdminSubmitButton idleLabel="Redefinir e encerrar sessões" pendingLabel="Redefinindo..." className={secondaryButton} />
                        </form>
                      </details>
                    ) : null}
                  </>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section className="mt-8 rounded-lg border border-neutral-200 bg-white p-5" aria-labelledby="create-user-title">
        <h2 id="create-user-title" className="text-lg font-black text-neutral-950">Nova conta Admin</h2>
        <p className="mb-4 mt-1 text-sm text-neutral-600">A conta nasce com senha temporária e precisa trocá-la e cadastrar o segundo fator no primeiro acesso.</p>
        <CreateAdminUserForm />
      </section>
    </div>
  );
}
