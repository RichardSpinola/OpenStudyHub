"use client";
import { useState } from "react";
import type { AiConfig } from "@/lib/ai/config";
export function AiSettings({
  initial,
  english,
  hasCredential: stored,
  tested: initialTested,
}: {
  initial: AiConfig;
  english: boolean;
  hasCredential: boolean;
  tested: boolean;
}) {
  const t = (pt: string, en: string) => (english ? en : pt);
  const [config, setConfig] = useState(initial),
    [credential, setCredential] = useState(""),
    [hasCredential, setHasCredential] = useState(stored),
    [clear, setClear] = useState(false),
    [tested, setTested] = useState(initialTested),
    [models, setModels] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState("");
  function update<K extends keyof AiConfig>(key: K, value: AiConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }));
    if (["provider", "endpoint", "model", "vision"].includes(key))
      setTested(false);
  }
  async function save(action: string) {
    setBusy(true);
    setFeedback("");
    try {
      const response = await fetch("/control/ai/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          config,
          credential: clear ? "" : credential || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setConfig(data.config);
      setHasCredential(data.hasCredential);
      setTested(data.tested);
      setCredential("");
      setClear(false);
      if (data.models) setModels(data.models);
      setFeedback(
        action === "test"
          ? t(
              "Conexão confirmada. Escolha um modelo e teste novamente se necessário; depois ative e salve. Durante o teste, a IA fica desativada.",
              "Connection confirmed. Choose a model and test again if needed, then enable and save. AI stays disabled during testing.",
            )
          : t("Configuração salva.", "Settings saved."),
      );
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : t("Não foi possível conectar.", "Unable to connect."),
      );
    } finally {
      setBusy(false);
    }
  }
  const toggle = (
    key: "enabled" | "groups" | "global" | "sources" | "attachments" | "vision",
    pt: string,
    en: string,
  ) => (
    <label className="ai-setting-toggle">
      <input
        type="checkbox"
        checked={config[key]}
        onChange={(e) => update(key, e.target.checked)}
      />
      {t(pt, en)}
    </label>
  );
  const number = (
    key:
      | "temperature"
      | "context"
      | "maxOutput"
      | "timeout"
      | "concurrency"
      | "queue"
      | "dailyQuota",
    pt: string,
    en: string,
    min: number,
    max: number,
    step = 1,
  ) => (
    <label>
      {t(pt, en)}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        required
        value={config[key]}
        onChange={(e) => update(key, Number(e.target.value))}
      />
    </label>
  );
  return (
    <form
      className="ai-admin-settings"
      onSubmit={(e) => {
        e.preventDefault();
        void save(
          (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ??
            "save",
        );
      }}
    >
      <section className="admin-security-panel">
        <h2>{t("Estado do assistente", "Assistant status")}</h2>
        {toggle("enabled", "Ativar assistente de IA", "Enable AI assistant")}
        <p>
          {t(
            "Desativado por padrão. Nenhum modelo é instalado. Desativar interrompe gerações e preserva o histórico.",
            "Disabled by default. No model is installed. Disabling stops generation and preserves history.",
          )}
        </p>
        <p role="status">
          {tested
            ? t("Conexão e modelo verificados", "Connection and model verified")
            : t(
                "Teste a conexão e o modelo antes de ativar",
                "Test the connection and model before enabling",
              )}
        </p>
      </section>
      <section>
        <h2>{t("Servidor de IA", "AI server")}</h2>
        <div className="v2-fields">
          <label>
            {t("Provedor", "Provider")}
            <select
              value={config.provider}
              onChange={(e) =>
                update("provider", e.target.value as AiConfig["provider"])
              }
            >
              <option value="ollama">Ollama</option>
              <option value="openai">
                Chat Completions (OpenAI-compatible)
              </option>
            </select>
          </label>
          <label>
            {t("Endereço do servidor", "Server address")}
            <input
              type="url"
              required
              value={config.endpoint}
              onChange={(e) => update("endpoint", e.target.value)}
            />
          </label>
          <label>
            {t("Credencial opcional", "Optional credential")}
            <input
              type="password"
              autoComplete="new-password"
              maxLength={2048}
              placeholder={
                hasCredential
                  ? t(
                      "Credencial salva; deixe vazio para manter",
                      "Credential saved; leave blank to keep",
                    )
                  : t("Sem credencial", "No credential")
              }
              value={credential}
              onChange={(e) => {
                setCredential(e.target.value);
                setTested(false);
              }}
            />
          </label>
          {hasCredential && (
            <label>
              <input
                type="checkbox"
                checked={clear}
                onChange={(e) => {
                  setClear(e.target.checked);
                  setTested(false);
                }}
              />
              {t("Remover credencial salva", "Remove saved credential")}
            </label>
          )}
          <label>
            {t(
              "Modelo (nenhum selecionado automaticamente)",
              "Model (never selected automatically)",
            )}
            <input
              list="ai-models"
              value={config.model}
              maxLength={200}
              onChange={(e) => update("model", e.target.value)}
            />
            <datalist id="ai-models">
              {models.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
          </label>
          {toggle(
            "vision",
            "O modelo aceita imagens (confirme na documentação do provedor)",
            "The model accepts images (confirm in the provider documentation)",
          )}
        </div>
        <p>
          {t(
            "No Docker, 127.0.0.1 aponta para o próprio contêiner. Use o endereço do seu servidor de IA na rede. Metadados de nuvem e redirecionamentos são bloqueados.",
            "In Docker, 127.0.0.1 points to this container. Use your AI server's network address. Cloud metadata and redirects are blocked.",
          )}
        </p>
        <button disabled={busy} name="action" value="test">
          {t(
            "Testar conexão e listar modelos",
            "Test connection and list models",
          )}
        </button>
      </section>
      <section>
        <h2>{t("Respostas e limites", "Responses and limits")}</h2>
        <div className="v2-fields">
          <label>
            {t("Instruções do assistente", "Assistant instructions")}
            <textarea
              rows={4}
              maxLength={8000}
              value={config.instructions}
              onChange={(e) => update("instructions", e.target.value)}
            />
          </label>
          {number("temperature", "Temperatura", "Temperature", 0, 2, 0.1)}
          {number(
            "context",
            "Contexto (tokens)",
            "Context (tokens)",
            1024,
            131072,
          )}
          {number(
            "maxOutput",
            "Saída máxima (tokens)",
            "Maximum output (tokens)",
            64,
            16384,
          )}
          {number(
            "timeout",
            "Tempo limite (segundos)",
            "Timeout (seconds)",
            10,
            600,
          )}
          {number(
            "concurrency",
            "Gerações simultâneas",
            "Concurrent generations",
            1,
            4,
          )}
          {number("queue", "Tamanho da fila", "Queue size", 0, 32)}
          {number(
            "dailyQuota",
            "Cota diária por pessoa (0 = sem cota)",
            "Daily quota per person (0 = unlimited)",
            0,
            10000,
          )}
        </div>
        <p>
          {t(
            "Sem cota mantém os limites técnicos de fila, contexto, arquivos e tempo.",
            "Unlimited quota keeps technical queue, context, file and time limits.",
          )}
        </p>
      </section>
      <section>
        <h2>{t("Permissões", "Permissions")}</h2>
        {toggle(
          "groups",
          "Permitir conversas em grupos existentes",
          "Allow conversations in existing groups",
        )}
        {toggle(
          "global",
          "Permitir @IA no chat global",
          "Allow @IA in global chat",
        )}
        {toggle(
          "sources",
          "Permitir seleção de fontes do Hub",
          "Allow selecting Hub sources",
        )}
        {toggle("attachments", "Permitir anexos", "Allow attachments")}
        <p>
          {t(
            "Cada grupo também precisa autorizar @IA no próprio chat. A IA apenas consulta e sugere; não edita, exclui ou executa arquivos. Conversas e anexos ficam privados e entram no backup da instância.",
            "Each group must also authorize @IA in its chat. AI only consults and suggests; it cannot edit, delete or execute files. Conversations and attachments remain private and are included in instance backups.",
          )}
        </p>
      </section>
      {feedback && <p role="status">{feedback}</p>}
      <button disabled={busy} name="action" value="save">
        {busy
          ? t("Aguarde…", "Please wait…")
          : t("Salvar configuração", "Save settings")}
      </button>
    </form>
  );
}
