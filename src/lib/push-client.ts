"use client";

function decodeKey(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(
    normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="),
  );
  const result = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) result[i] = binary.charCodeAt(i);
  return result;
}

export async function enableBrowserPush(): Promise<string> {
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  )
    return "Este navegador não oferece notificações em segundo plano.";
  const response = await fetch("/api/push/subscription", { cache: "no-store" });
  if (!response.ok) return "Entre novamente para ativar as notificações.";
  const config = (await response.json()) as {
    available: boolean;
    publicKey: string | null;
  };
  if (!config.available || !config.publicKey)
    return "Notificações em segundo plano não foram configuradas nesta instalação.";
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    return permission === "denied"
      ? "Permissão bloqueada no navegador."
      : "Permissão não concedida.";
  const registration = await navigator.serviceWorker.register("/push-sw.js", {
    scope: "/",
  });
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeKey(config.publicKey),
    }));
  const save = await fetch("/api/push/subscription", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!save.ok) {
    if (!existing) await subscription.unsubscribe();
    return "Não foi possível registrar este dispositivo.";
  }
  return "Notificações ativadas neste dispositivo.";
}

export async function disableBrowserPush(): Promise<string> {
  if (!("serviceWorker" in navigator))
    return "Nenhuma inscrição neste navegador.";
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return "Nenhuma inscrição neste navegador.";
  const response = await fetch("/api/push/subscription", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  if (!response.ok)
    return "Não foi possível remover a inscrição. Tente novamente.";
  await subscription.unsubscribe();
  return "Notificações desativadas neste dispositivo.";
}
