"use client";

import { BellOff, BellRing, Send } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  detectPushEnvironment,
  isAppleMobileDevice,
  subscriptionMatchesServerKey,
  urlBase64ToUint8Array,
  type PushEnvironment,
} from "@/lib/admin-push-client";

type AdminPushSubscriptionControlProps = {
  publicKey: string | null;
  activeSubscriptionCount: number;
};

type PushStatus =
  | "checking"
  | "not_configured"
  | "install_required"
  | "unsupported"
  | "denied"
  | "disabled"
  | "activating"
  | "deactivating"
  | "enabled"
  | "error";

type TestState = "idle" | "sending" | "sent" | "error";

const SERVICE_WORKER_URL = "/admin-push-sw.js";
const SERVICE_WORKER_SCOPE = "/admin/";
const SUBSCRIPTIONS_API = "/api/admin/push-subscriptions";

const statusLabels: Record<PushStatus, string> = {
  checking: "Verificando...",
  not_configured: "Não configurado",
  install_required: "Instale na Tela de Início",
  unsupported: "Sem suporte neste navegador",
  denied: "Permissão bloqueada",
  disabled: "Desativado",
  activating: "Ativando...",
  deactivating: "Desativando...",
  enabled: "Ativo neste dispositivo",
  error: "Erro",
};

const statusTone: Record<PushStatus, string> = {
  checking: "border-neutral-200 bg-neutral-50 text-neutral-600",
  not_configured: "border-amber-200 bg-amber-50 text-amber-800",
  install_required: "border-amber-200 bg-amber-50 text-amber-800",
  unsupported: "border-neutral-200 bg-neutral-50 text-neutral-600",
  denied: "border-red-200 bg-red-50 text-red-700",
  disabled: "border-neutral-200 bg-neutral-50 text-neutral-600",
  activating: "border-neutral-200 bg-neutral-50 text-neutral-600",
  deactivating: "border-neutral-200 bg-neutral-50 text-neutral-600",
  enabled: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-700",
};

type ClientEnvironment = { push: PushEnvironment; appleMobile: boolean };

// The browser environment never changes during a page view, so there is nothing to subscribe to.
const subscribeToNothing = () => () => {};
let cachedEnvironment: ClientEnvironment | null = null;

function readClientEnvironment(): ClientEnvironment {
  if (cachedEnvironment) return cachedEnvironment;
  const nav = navigator as Navigator & { standalone?: boolean };
  cachedEnvironment = {
    push: detectPushEnvironment({
      userAgent: nav.userAgent,
      maxTouchPoints: nav.maxTouchPoints ?? 0,
      displayModeStandalone: window.matchMedia("(display-mode: standalone)").matches,
      navigatorStandalone: nav.standalone === true,
      hasServiceWorker: "serviceWorker" in nav,
      hasPushManager: "PushManager" in window,
      hasNotification: "Notification" in window,
    }),
    appleMobile: isAppleMobileDevice(nav.userAgent, nav.maxTouchPoints ?? 0),
  };
  return cachedEnvironment;
}

async function registerServiceWorker() {
  // Registering never prompts the user; only the click handler asks for permission.
  await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: SERVICE_WORKER_SCOPE });
  // pushManager.subscribe needs an active worker; `ready` waits for the one controlling /admin/.
  return navigator.serviceWorker.ready;
}

async function saveSubscription(subscription: PushSubscription) {
  const response = await fetch(SUBSCRIPTIONS_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!response.ok) throw new Error("subscription failed");
}

function testResultMessage(status: number, sent: number) {
  if (status === 200) {
    return `Notificação de teste enviada para ${sent} dispositivo(s). Bloqueie a tela para conferir a chegada.`;
  }
  if (status === 409) return "Nenhum dispositivo ativo nesta conta. Ative as notificações neste celular primeiro.";
  if (status === 429) return "Muitos testes seguidos. Aguarde alguns minutos e tente de novo.";
  if (status === 503) return "O Web Push não está configurado no servidor.";
  if (status === 502) return "O serviço de push recusou a entrega. Desative e ative novamente neste celular.";
  return "Não foi possível enviar a notificação de teste.";
}

export function AdminPushSubscriptionControl({ publicKey, activeSubscriptionCount }: AdminPushSubscriptionControlProps) {
  const environment = useSyncExternalStore(subscribeToNothing, readClientEnvironment, () => null);
  const [status, setStatus] = useState<PushStatus>("checking");
  const [message, setMessage] = useState("");
  const [testState, setTestState] = useState<TestState>("idle");
  const [testMessage, setTestMessage] = useState("");

  const canUsePush = Boolean(publicKey) && environment?.push === "supported";
  const displayStatus: PushStatus = !publicKey
    ? "not_configured"
    : environment === null
      ? "checking"
      : environment.push === "install_required"
        ? "install_required"
        : environment.push === "unsupported"
          ? "unsupported"
          : status;

  // Reads the current state only. It never calls Notification.requestPermission():
  // WebKit requires that to come from a user gesture, so it lives in the click handler.
  useEffect(() => {
    if (!canUsePush || !publicKey) return;

    let canceled = false;

    (async () => {
      const registration = await registerServiceWorker();
      if (Notification.permission === "denied") return "denied" as const;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription || Notification.permission !== "granted") return "disabled" as const;
      if (!subscriptionMatchesServerKey(subscription.options?.applicationServerKey, publicKey)) return "disabled" as const;
      // Idempotent upsert by endpoint: confirms the server still delivers to this device
      // (it may have been switched off after a 404/410) without prompting anything.
      await saveSubscription(subscription);
      return "enabled" as const;
    })()
      .then((next) => {
        if (!canceled) setStatus(next);
      })
      .catch(() => {
        if (!canceled) {
          setStatus("error");
          setMessage("Não foi possível verificar as notificações neste dispositivo.");
        }
      });

    return () => {
      canceled = true;
    };
  }, [canUsePush, publicKey]);

  async function enablePush() {
    if (!publicKey || !canUsePush) return;
    setStatus("activating");
    setMessage("");
    setTestState("idle");
    setTestMessage("");

    try {
      // First await of the click handler, so Safari/iOS still sees the user gesture.
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "disabled");
        setMessage("A permissão de notificação não foi concedida neste dispositivo.");
        return;
      }

      const registration = await registerServiceWorker();
      let subscription = await registration.pushManager.getSubscription();
      if (subscription && !subscriptionMatchesServerKey(subscription.options?.applicationServerKey, publicKey)) {
        // Created with an older VAPID key: it would never receive a push signed with the current one.
        await subscription.unsubscribe();
        subscription = null;
      }
      subscription ??= await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await saveSubscription(subscription);

      setStatus("enabled");
      setMessage("Pronto. Este dispositivo receberá um alerta a cada venda aprovada.");
    } catch {
      setStatus("error");
      setMessage("Não foi possível ativar as notificações neste dispositivo. Tente novamente.");
    }
  }

  async function disablePush() {
    if (!canUsePush) return;
    setStatus("deactivating");
    setMessage("");
    setTestState("idle");
    setTestMessage("");

    try {
      const registration = await registerServiceWorker();
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        // Only this device's endpoint is switched off; other devices of the account keep receiving.
        const response = await fetch(SUBSCRIPTIONS_API, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        if (!response.ok) throw new Error("subscription removal failed");
        await subscription.unsubscribe();
      }

      setStatus("disabled");
      setMessage("Notificações desativadas neste dispositivo.");
    } catch {
      setStatus("error");
      setMessage("Não foi possível desativar as notificações neste dispositivo.");
    }
  }

  async function sendTestPush() {
    setTestState("sending");
    setTestMessage("");
    try {
      const response = await fetch(`${SUBSCRIPTIONS_API}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = (await response.json().catch(() => ({}))) as { sent?: number };
      setTestState(response.ok ? "sent" : "error");
      setTestMessage(testResultMessage(response.status, body.sent ?? 0));
    } catch {
      setTestState("error");
      setTestMessage("Não foi possível enviar a notificação de teste.");
    }
  }

  const enabled = displayStatus === "enabled";
  const busy = displayStatus === "activating" || displayStatus === "deactivating" || displayStatus === "checking";
  const actionUnavailable =
    busy ||
    displayStatus === "unsupported" ||
    displayStatus === "not_configured" ||
    displayStatus === "install_required";
  const buttonLabel = enabled
    ? "Desativar neste celular"
    : displayStatus === "activating"
      ? "Ativando..."
      : displayStatus === "deactivating"
        ? "Desativando..."
        : "Ativar neste celular";

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5" aria-labelledby="admin-push-title">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-neutral-500">Celular</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h2 id="admin-push-title" className="text-lg font-black text-neutral-950">Notificações push</h2>
            <span
              className={`rounded-full border px-2 py-1 text-[11px] font-black ${statusTone[displayStatus]}`}
              data-testid="admin-push-status"
              role="status"
            >
              {statusLabels[displayStatus]}
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-neutral-500">
            {publicKey
              ? `${activeSubscriptionCount} dispositivo(s) ativo(s) recebem um alerta quando uma venda é aprovada.`
              : "Configure as chaves VAPID na Railway para ativar as notificações no celular."}
          </p>

          {displayStatus === "install_required" ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
              <p className="font-black">No iPhone e no iPad, o alerta de venda só funciona no app da Tela de Início.</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Abra esta página no Safari.</li>
                <li>Toque em Compartilhar.</li>
                <li>Escolha “Adicionar à Tela de Início”.</li>
                <li>Abra a RARE pelo ícone criado.</li>
                <li>Entre no Admin.</li>
                <li>Toque em “Ativar neste celular”.</li>
              </ol>
            </div>
          ) : null}

          {displayStatus === "unsupported" ? (
            <p className="mt-2 text-sm font-semibold text-neutral-700">
              {environment?.appleMobile
                ? "Este iPhone ou iPad não oferece Web Push. Atualize para o iOS/iPadOS 16.4 ou superior."
                : "Este navegador não oferece suporte a Web Push."}
            </p>
          ) : null}

          {displayStatus === "denied" ? (
            <p className="mt-2 text-sm font-semibold text-red-700">
              A permissão foi bloqueada neste dispositivo. Libere as notificações da RARE nos Ajustes do aparelho
              (no iPhone: Ajustes › Notificações › RARE) e toque em “Ativar neste celular” de novo.
            </p>
          ) : null}

          {message ? <p className="mt-2 text-sm font-semibold text-neutral-700" aria-live="polite">{message}</p> : null}
          {testMessage ? (
            <p
              className={`mt-2 text-sm font-semibold ${testState === "error" ? "text-red-700" : "text-neutral-700"}`}
              aria-live="polite"
            >
              {testMessage}
            </p>
          ) : null}
        </div>

        <div className="flex w-full flex-col gap-2 md:w-fit">
          <button
            type="button"
            onClick={enabled ? disablePush : enablePush}
            disabled={actionUnavailable}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-black px-4 text-sm font-black text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300 md:w-fit"
          >
            {enabled ? <BellOff size={18} aria-hidden="true" /> : <BellRing size={18} aria-hidden="true" />}
            {buttonLabel}
          </button>
          {enabled ? (
            <button
              type="button"
              onClick={sendTestPush}
              disabled={testState === "sending"}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 px-4 text-sm font-black text-neutral-800 transition hover:border-neutral-950 hover:text-neutral-950 disabled:cursor-not-allowed disabled:text-neutral-300 md:w-fit"
            >
              <Send size={16} aria-hidden="true" />
              {testState === "sending" ? "Enviando teste..." : "Enviar notificação de teste"}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
