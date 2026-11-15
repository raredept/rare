import { redirect } from "next/navigation";
import { MfaEnrollmentForm } from "@/app/admin/mfa/mfa-forms";
import { getCurrentAdmin, getPendingMfaAdmin } from "@/lib/auth";
import { ensurePendingEnrollment, type MfaEnrollmentView } from "@/lib/admin-mfa";

export const dynamic = "force-dynamic";

function groupSecret(secret: string) {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}

export default async function AdminMfaSetupPage() {
  const admin = await getPendingMfaAdmin();
  let enrollment: MfaEnrollmentView | null = null;
  if (admin) {
    if (admin.mfaEnabledAt) redirect("/admin/mfa");
    enrollment = await ensurePendingEnrollment(admin);
  } else {
    // Right after a successful confirmation the action swaps the pending credential for a full
    // session, and Next re-renders this page. Keep the same tree so the client form can still
    // show the one-time recovery codes it received. Anyone else goes back to the login.
    const current = await getCurrentAdmin();
    if (!current?.mfaVerifiedAt) redirect("/admin/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4 py-12">
      <section className="w-full max-w-xl rounded-lg border border-neutral-200 bg-white p-6 shadow-sm sm:p-8" aria-labelledby="mfa-setup-title">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-neutral-500">RARE Admin</p>
        <h1 id="mfa-setup-title" className="mt-3 text-2xl font-black text-neutral-950">Ative a verificação em duas etapas</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Obrigatória para acessar o Admin. Use Google Authenticator, Microsoft Authenticator, 1Password, Authy ou outro aplicativo TOTP.
        </p>
        {enrollment ? (
        <ol className="mt-6 grid gap-5 text-sm text-neutral-800">
          <li>
            <p className="font-black">1. Escaneie o QR Code no aplicativo</p>
            <div
              className="mt-3 h-48 w-48 rounded border border-neutral-200 bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
              role="img"
              aria-label="QR Code para cadastrar a RARE Admin no aplicativo autenticador"
              // Library-generated SVG of our own otpauth URI; no user-controlled markup.
              dangerouslySetInnerHTML={{ __html: enrollment.qrSvg }}
            />
          </li>
          <li>
            <p className="font-black">Ou digite a chave manualmente</p>
            <code className="mt-2 block break-all rounded bg-neutral-100 px-3 py-2 font-mono text-sm tracking-wider" aria-label="Chave secreta para cadastro manual">
              {groupSecret(enrollment.secret)}
            </code>
            <p className="mt-1 text-xs text-neutral-500">Tipo: baseado em tempo (TOTP), 6 dígitos, 30 segundos.</p>
          </li>
          <li>
            <p className="font-black">2. Confirme com o código gerado</p>
            <p className="text-xs text-neutral-500">
              A verificação só fica ativa depois desta confirmação. Este QR expira às{" "}
              {enrollment.expiresAt.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}.
            </p>
          </li>
        </ol>
        ) : null}
        <MfaEnrollmentForm completed={!enrollment} />
      </section>
    </main>
  );
}
