"use client";
import { useCallback, useEffect, useState } from "react";
import type { AiConfig } from "@/lib/ai/config";
import type { LoadedModel } from "@/lib/ai/provider";
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
    [loaded, setLoaded] = useState<LoadedModel[] | null>(null),
    [memoryBusy, setMemoryBusy] = useState(""),
    [feedback, setFeedback] = useState("");
  function update<K extends keyof AiConfig>(key: K, value: AiConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }));
    if (["provider", "endpoint", "models", "vision"].includes(key))
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
              "Conexão confirmada. Marque os modelos liberados e teste novamente se necessário; depois ative e salve. Durante o teste, a IA fica desativada.",
              "Connection confirmed. Tick the allowed models and test again if needed, then enable and save. AI stays disabled during testing.",
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
  const memory = useCallback(
    async (action: "loaded" | "load" | "unload", model?: string) => {
      setMemoryBusy(model ?? action);
      try {
        const response = await fetch("/control/ai/manage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, model, config: initial }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setLoaded(data.loaded);
      } catch (error) {
        setLoaded(null);
        if (action !== "loaded")
          setFeedback(
            error instanceof Error ? error.message : "Unable to connect.",
          );
      } finally {
        setMemoryBusy("");
      }
    },
    [initial],
  );
  useEffect(() => {
    if (initial.provider !== "ollama" || !initial.models.length) return;
    const timer = setTimeout(() => void memory("loaded"), 0);
    return () => clearTimeout(timer);
  }, [initial, memory]);
  // Detected models plus the ones already allowed, so a saved choice stays visible.
  const detected = [...new Set([...models, ...config.models])];
  const toggleModel = (model: string, on: boolean) =>
    update(
      "models",
      on
        ? [...config.models, model].slice(0, 8)
        : config.models.filter((m) => m !== model),
    );
  const modelSelect = (
    key: "defaultModel" | "chatGlobalModel" | "chatGroupModel",
    pt: string,
    en: string,
  ) => (
    <label>
      {t(pt, en)}
      <select
        value={config[key]}
        disabled={!config.models.length}
        onChange={(e) => update(key, e.target.value)}
      >
        {config.models.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
    </label>
  );
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
            ? t(
                "Conexão e modelos verificados",
                "Connection and models verified",
              )
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
          {toggle(
            "vision",
            "Permitir imagens nos modelos que aceitam (confirme na documentação do provedor)",
            "Allow images on models that accept them (confirm in the provider documentation)",
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
        <h2>{t("Modelos", "Models")}</h2>
        <p>
          {t(
            "Os modelos aparecem depois do teste de conexão. Marque até oito que as pessoas podem escolher e teste novamente; nada é baixado ou instalado.",
            "Models appear after the connection test. Tick up to eight that people may choose, then test again; nothing is downloaded or installed.",
          )}
        </p>
        {detected.length ? (
          <fieldset className="ai-model-list">
            <legend>{t("Modelos liberados", "Allowed models")}</legend>
            {detected.map((model) => (
              <label key={model} className="ai-setting-toggle">
                <input
                  type="checkbox"
                  checked={config.models.includes(model)}
                  onChange={(e) => toggleModel(model, e.target.checked)}
                />
                <span>{model}</span>
                {config.visionModels.includes(model) && (
                  <small>{t("aceita imagens", "accepts images")}</small>
                )}
              </label>
            ))}
          </fieldset>
        ) : (
          <p role="status">
            {t("Nenhum modelo detectado ainda.", "No models detected yet.")}
          </p>
        )}
        <div className="v2-fields">
          {modelSelect(
            "defaultModel",
            "Modelo padrão do assistente",
            "Default assistant model",
          )}
          {modelSelect(
            "chatGlobalModel",
            "Modelo do @IA no chat global",
            "Model for @IA in global chat",
          )}
          {modelSelect(
            "chatGroupModel",
            "Modelo do @IA nos grupos",
            "Model for @IA in groups",
          )}
        </div>
      </section>
      {initial.provider === "ollama" && initial.models.length > 0 && (
        <section>
          <h2>{t("Memória do servidor de IA", "AI server memory")}</h2>
          <p>
            {t(
              "Um modelo carregado responde mais rápido, mas ocupa memória RAM do servidor. Depois do tempo sem uso abaixo, o Ollama o descarrega sozinho.",
              "A loaded model answers faster but uses the server's RAM. After the idle time below, Ollama unloads it automatically.",
            )}
          </p>
          <div className="v2-fields">
            <label>
              {t(
                "Descarregar após (minutos sem uso; -1 = nunca, 0 = logo após responder)",
                "Unload after (idle minutes; -1 = never, 0 = right after replying)",
              )}
              <input
                type="number"
                min={-1}
                max={1440}
                required
                value={config.keepAlive}
                onChange={(e) => update("keepAlive", Number(e.target.value))}
              />
            </label>
          </div>
          <ul className="ai-memory-list">
            {initial.models.map((model) => {
              const state = loaded?.find((item) => item.name === model);
              return (
                <li key={model}>
                  <span>
                    <strong>{model}</strong>
                    <small>
                      {loaded === null
                        ? t("Estado indisponível", "Status unavailable")
                        : state
                          ? `${t("Carregado", "Loaded")} · ${state.sizeMb} MB${
                              state.until &&
                              new Date(state.until).getFullYear() < 2200
                                ? ` · ${t("até", "until")} ${new Date(state.until).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
                                : ""
                            }`
                          : t("Fora da memória", "Not in memory")}
                    </small>
                  </span>
                  <button
                    type="button"
                    disabled={!!memoryBusy}
                    onClick={() =>
                      void memory(state ? "unload" : "load", model)
                    }
                  >
                    {memoryBusy === model
                      ? t("Aguarde…", "Please wait…")
                      : state
                        ? t("Descarregar", "Unload")
                        : t("Carregar agora", "Load now")}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            disabled={!!memoryBusy}
            onClick={() => void memory("loaded")}
          >
            {t("Atualizar estado", "Refresh status")}
          </button>
        </section>
      )}
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
