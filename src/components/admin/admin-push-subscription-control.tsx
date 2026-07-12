"use client";

import { BellOff, BellRing } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type AdminPushSubscriptionControlProps = {
  publicKey: string | null;
  activeSubscriptionCount: number;
};

type PushStatus = "checking" | "unsupported" | "not_configured" | "disabled" | "enabled" | "denied" | "saving" | "error";

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

async function getCurrentSubscription() {
  const registration = await navigator.serviceWorker.register("/admin-push-sw.js", { scope: "/admin/" });
  return {
    registration,
    subscription: await registration.pushManager.getSubscription(),
  };
}

export function AdminPushSubscriptionControl({ publicKey, activeSubscriptionCount }: AdminPushSubscriptionControlProps) {
  const [status, setStatus] = useState<PushStatus>(publicKey ? "checking" : "not_configured");
  const [message, setMessage] = useState("");

  const pushSupport = useMemo(() => {
    if (typeof window === "undefined") return null;
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  }, []);
  const iosInstallRequired = useMemo(() => {
    if (typeof window === "undefined") return false;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    return ios && !standalone;
  }, []);
  const canUsePush = Boolean(publicKey && pushSupport);
  const displayStatus: PushStatus = !publicKey ? "not_configured" : pushSupport === false ? "unsupported" : status;

  useEffect(() => {
    if (!canUsePush) return;

    let canceled = false;

    getCurrentSubscription()
      .then(({ subscription }) => {
        if (canceled) return;
        if (Notification.permission === "denied") {
          setStatus("denied");
          return;
        }
        setStatus(subscription ? "enabled" : "disabled");
      })
      .catch(() => {
        if (!canceled) setStatus("error");
      });

    return () => {
      canceled = true;
    };
  }, [canUsePush, publicKey]);

  async function enablePush() {
    if (!publicKey || !canUsePush) return;
    setStatus("saving");
    setMessage("");

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "disabled");
        setMessage("Permissao de notificacao nao concedida neste dispositivo.");
        return;
      }

      const { registration, subscription: existing } = await getCurrentSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      const response = await fetch("/api/admin/push-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!response.ok) throw new Error("subscription failed");

      setStatus("enabled");
      setMessage("Este dispositivo recebera alertas de vendas aprovadas.");
    } catch {
      setStatus("error");
      setMessage("Nao foi possivel ativar as notificacoes neste dispositivo.");
    }
  }

  async function disablePush() {
    if (!canUsePush) return;
    setStatus("saving");
    setMessage("");

    try {
      const { subscription } = await getCurrentSubscription();
      if (subscription) {
        const response = await fetch("/api/admin/push-subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        if (!response.ok) throw new Error("subscription removal failed");
        await subscription.unsubscribe();
      }

      setStatus("disabled");
      setMessage("Notificacoes desativadas neste dispositivo.");
    } catch {
      setStatus("error");
      setMessage("Nao foi possivel desativar as notificacoes neste dispositivo.");
    }
  }

  const enabled = displayStatus === "enabled";
  const disabled =
    displayStatus === "saving" ||
    displayStatus === "checking" ||
    displayStatus === "unsupported" ||
    displayStatus === "not_configured";

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-neutral-500">Celular</p>
          <h2 className="mt-2 text-lg font-black text-neutral-950">Notificacoes push</h2>
          <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-neutral-500">
            {publicKey
              ? `${activeSubscriptionCount} dispositivo(s) ativo(s) receberao alertas quando uma venda for aprovada.`
              : "Configure as chaves VAPID na Railway para ativar notificacoes de celular."}
          </p>
          {message ? <p className="mt-2 text-sm font-semibold text-neutral-700">{message}</p> : null}
          {displayStatus === "unsupported" ? (
            <p className="mt-2 text-sm font-semibold text-red-700">
              {iosInstallRequired
                ? "No iPhone, instale a RARE na Tela de Início e abra o app instalado para ativar o Web Push."
                : "Este navegador nao oferece suporte a Web Push."}
            </p>
          ) : null}
          {displayStatus === "denied" ? (
            <p className="mt-2 text-sm font-semibold text-red-700">A permissao foi bloqueada no navegador deste dispositivo.</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={enabled ? disablePush : enablePush}
          disabled={disabled}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-black px-4 text-sm font-black text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300 md:w-fit"
        >
          {enabled ? <BellOff size={18} aria-hidden="true" /> : <BellRing size={18} aria-hidden="true" />}
          {enabled ? "Desativar neste celular" : displayStatus === "saving" ? "Salvando..." : "Ativar neste celular"}
        </button>
      </div>
    </section>
  );
}
