"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { configurePushAction } from "@/app/control/system/backup-actions";
import { useUiText } from "./ui-language-provider";
export function PushSetup({ configured }: { configured: boolean }) {
  const tr = useUiText(),
    router = useRouter();
  const [subject, setSubject] = useState(""),
    [status, setStatus] = useState(""),
    [pending, start] = useTransition();
  return (
    <section className="admin-system-links">
      <h2>{tr("Notificações neste dispositivo", "Device notifications")}</h2>
      <p>
        {configured
          ? tr(
              "Chaves de envio configuradas. Cada pessoa ainda precisa autorizar o navegador em Configurações → Notificações.",
              "Delivery keys configured. Each person still needs to authorize their browser under Settings → Notifications.",
            )
          : tr(
              "Falta configurar as chaves de envio desta instância. Elas identificam o servidor; não são a permissão do navegador.",
              "This instance needs delivery keys. They identify the server; they are separate from browser permission.",
            )}
      </p>
      {!configured ? (
        <form
          className="stack-form"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const result = await configurePushAction(subject);
              setStatus(
                result.error ??
                  tr(
                    "Chaves criadas. Ative as notificações no navegador.",
                    "Keys created. Enable notifications in your browser.",
                  ),
              );
              if (result.ok) router.refresh();
            });
          }}
        >
          <label>
            {tr("Contato do responsável", "Administrator contact")}
            <input
              type="text"
              value={subject}
              required
              maxLength={250}
              placeholder="mailto:admin@instituicao.edu"
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <button disabled={pending}>
            {tr(
              "Configurar envio de notificações",
              "Configure notification delivery",
            )}
          </button>
          <p role="status">{status}</p>
        </form>
      ) : null}
      <p>
        {tr(
          "Fora do notebook, o site precisa de HTTPS. Se o navegador bloqueou notificações, revise a permissão do site. Não troque chaves de uma instalação em uso; os dispositivos perderiam a inscrição.",
          "Outside localhost, the site needs HTTPS. If the browser blocked notifications, review site permission. Do not replace keys on an active installation; devices would lose their subscription.",
        )}
      </p>
    </section>
  );
}
