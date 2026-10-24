"use client";
import { useState } from "react";
export function SecurityForm({
  enabled: initial,
  english,
}: {
  enabled: boolean;
  english: boolean;
}) {
  const t = (pt: string, en: string) => (english ? en : pt);
  const [enabled, setEnabled] = useState(initial);
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(
    null,
  );
  const [codes, setCodes] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(form: HTMLFormElement, action: string) {
    setBusy(true);
    setFeedback("");
    const data = new FormData(form);
    try {
      const response = await fetch("/control/account/security/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          password: data.get("password"),
          code: data.get("code"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (action === "start") setSetup(result);
      else {
        setCodes(result.codes);
        setSetup(null);
        setEnabled(action !== "disable");
        form.reset();
        setFeedback(
          t(
            "Alteração salva. As outras sessões foram encerradas.",
            "Saved. Other sessions have been signed out.",
          ),
        );
      }
    } catch (e) {
      setFeedback(
        e instanceof Error
          ? e.message
          : t("Não foi possível salvar.", "Unable to save."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-security-panel">
      <h2>{t("Verificação em duas etapas", "Two-step verification")}</h2>
      <p>
        {enabled
          ? t(
              "Ativada nesta conta administrativa.",
              "Enabled for this administrator account.",
            )
          : t(
              "Opcional. Proteja seu acesso com um aplicativo autenticador.",
              "Optional. Protect your sign-in with an authenticator app.",
            )}
      </p>
      <p>
        {t(
          "O aplicativo gera seis dígitos a cada 30 segundos. Guarde os códigos de recuperação fora deste dispositivo.",
          "Your app generates six digits every 30 seconds. Store your recovery codes outside this device.",
        )}
      </p>
      <form
        className="v2-fields"
        onSubmit={(e) => {
          e.preventDefault();
          const action =
            (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ??
            "start";
          void submit(e.currentTarget, action);
        }}
      >
        <label>
          {t("Senha atual", "Current password")}
          <input
            required
            type="password"
            name="password"
            autoComplete="current-password"
            maxLength={1024}
          />
        </label>
        {setup && (
          <div className="mfa-setup">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={setup.qr}
              width={240}
              height={240}
              alt={t("QR Code para o autenticador", "Authenticator QR code")}
            />
            <p>
              {t(
                "Ou insira esta chave no aplicativo:",
                "Or enter this key in your app:",
              )}
            </p>
            <code>{setup.secret}</code>
            <p>
              {t(
                "A chave expira em dez minutos. Confirme com o código do aplicativo.",
                "The key expires in ten minutes. Confirm with your app's code.",
              )}
            </p>
          </div>
        )}
        {(enabled || setup) && (
          <label>
            {t(
              "Código do autenticador ou recuperação",
              "Authenticator or recovery code",
            )}
            <input
              name="code"
              autoComplete="one-time-code"
              required
              maxLength={100}
            />
          </label>
        )}
        <div className="admin-form-actions">
          {!enabled && !setup && (
            <button disabled={busy} name="action" value="start">
              {t("Configurar autenticador", "Set up authenticator")}
            </button>
          )}
          {setup && (
            <button disabled={busy} name="action" value="enable">
              {t("Confirmar e ativar", "Confirm and enable")}
            </button>
          )}
          {enabled && (
            <>
              <button disabled={busy} name="action" value="regenerate">
                {t(
                  "Gerar novos códigos de recuperação",
                  "Generate new recovery codes",
                )}
              </button>
              <button disabled={busy} name="action" value="disable">
                {t("Desativar duas etapas", "Disable two-step verification")}
              </button>
            </>
          )}
        </div>
      </form>
      {feedback && <p role="status">{feedback}</p>}
      {!!codes.length && (
        <div role="status">
          <h3>{t("Salve estes códigos agora", "Save these codes now")}</h3>
          <p>
            {t(
              "Exibidos apenas uma vez. Cada código pode ser usado uma única vez.",
              "Shown once. Each code can be used only once.",
            )}
          </p>
          <pre style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
            {codes.join("\n")}
          </pre>
          <button onClick={() => setCodes([])}>
            {t("Já salvei", "I saved them")}
          </button>
        </div>
      )}
    </section>
  );
}
