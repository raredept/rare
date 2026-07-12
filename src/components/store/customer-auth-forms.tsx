"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import {
  loginCustomerAction,
  registerCustomerAction,
  type CustomerActionState,
} from "@/lib/customer-actions";
import { formatCpf } from "@/lib/cpf";

function FieldError({ errors, id }: { errors?: string[]; id: string }) {
  return errors?.length ? <p id={id} className="mt-2 text-sm font-semibold text-red-700" role="alert">{errors[0]}</p> : null;
}

function PasswordField({
  name,
  label,
  autoComplete,
  errorId,
  invalid = false,
}: {
  name: string;
  label: string;
  autoComplete: string;
  errorId?: string;
  invalid?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-neutral-700">{label}</span>
      <span className="relative block">
        <input
          name={name}
          type={visible ? "text" : "password"}
          required
          autoComplete={autoComplete}
          minLength={name.includes("password") && autoComplete === "new-password" ? 8 : undefined}
          aria-describedby={invalid ? errorId : undefined}
          aria-invalid={invalid || undefined}
          className="store-input pr-12"
        />
        <button type="button" onClick={() => setVisible((current) => !current)} className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950" aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}>
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
    </label>
  );
}

export function CustomerLoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<CustomerActionState, FormData>(loginCustomerAction, {});

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-neutral-700">E-mail</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          aria-describedby={state.fieldErrors?.email?.length ? "login-email-error" : undefined}
          aria-invalid={Boolean(state.fieldErrors?.email?.length) || undefined}
          className="store-input"
        />
        <FieldError id="login-email-error" errors={state.fieldErrors?.email} />
      </label>
      <div>
        <PasswordField
          name="password"
          label="Senha"
          autoComplete="current-password"
          errorId="login-password-error"
          invalid={Boolean(state.fieldErrors?.password?.length)}
        />
        <FieldError id="login-password-error" errors={state.fieldErrors?.password} />
      </div>
      {state.error ? <p className="rounded-md bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="store-button-primary w-full"
      >
        {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando</> : "Entrar"}
      </button>
      <p className="text-center text-sm font-semibold text-neutral-600">
        Ainda não tem cadastro?{" "}
        <Link href={`/cadastro${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-black text-neutral-950 underline">
          Criar conta
        </Link>
      </p>
    </form>
  );
}

export function CustomerRegisterForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<CustomerActionState, FormData>(registerCustomerAction, {});
  const [cpf, setCpf] = useState("");

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-neutral-700">Nome</span>
        <input name="name" required autoComplete="name" aria-describedby={state.fieldErrors?.name?.length ? "register-name-error" : undefined} aria-invalid={Boolean(state.fieldErrors?.name?.length) || undefined} className="store-input" />
        <FieldError id="register-name-error" errors={state.fieldErrors?.name} />
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-neutral-700">E-mail</span>
        <input name="email" type="email" required autoComplete="email" aria-describedby={state.fieldErrors?.email?.length ? "register-email-error" : undefined} aria-invalid={Boolean(state.fieldErrors?.email?.length) || undefined} className="store-input" />
        <FieldError id="register-email-error" errors={state.fieldErrors?.email} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-neutral-700">Telefone</span>
          <input name="phone" autoComplete="tel" aria-describedby={state.fieldErrors?.phone?.length ? "register-phone-error" : undefined} aria-invalid={Boolean(state.fieldErrors?.phone?.length) || undefined} className="store-input" />
          <FieldError id="register-phone-error" errors={state.fieldErrors?.phone} />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-neutral-700">CPF</span>
          <input
            name="cpf"
            value={cpf}
            onChange={(event) => setCpf(formatCpf(event.target.value))}
            required
            inputMode="numeric"
            autoComplete="off"
            maxLength={14}
            placeholder="000.000.000-00"
            aria-describedby={state.fieldErrors?.cpf?.length ? "register-cpf-error" : undefined}
            aria-invalid={Boolean(state.fieldErrors?.cpf?.length) || undefined}
            className="store-input"
          />
          <FieldError id="register-cpf-error" errors={state.fieldErrors?.cpf} />
        </label>
      </div>
      <div>
        <PasswordField name="password" label="Senha" autoComplete="new-password" errorId="register-password-error" invalid={Boolean(state.fieldErrors?.password?.length)} />
        <FieldError id="register-password-error" errors={state.fieldErrors?.password} />
      </div>
      <div>
        <PasswordField name="passwordConfirmation" label="Confirmar senha" autoComplete="new-password" errorId="register-password-confirmation-error" invalid={Boolean(state.fieldErrors?.passwordConfirmation?.length)} />
        <FieldError id="register-password-confirmation-error" errors={state.fieldErrors?.passwordConfirmation} />
      </div>
      {state.error ? <p className="rounded-md bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="store-button-primary w-full"
      >
        {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando</> : "Criar conta"}
      </button>
      <p className="text-center text-sm font-semibold text-neutral-600">
        Já tem cadastro?{" "}
        <Link href={`/entrar${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-black text-neutral-950 underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
