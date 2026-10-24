import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import http from "node:http";
import https from "node:https";
import type { AiConfig } from "./config";
export type ProviderMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  images?: { mime: string; data: string }[];
};
export function allowedAddress(address: string) {
  let value = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (value.startsWith("::ffff:")) value = value.slice(7);
  if (!isIP(value)) return false;
  if (isIP(value) === 4) {
    const p = value.split(".").map(Number);
    return (
      p[0] !== 0 &&
      p[0] < 224 &&
      !(p[0] === 169 && p[1] === 254) &&
      value !== "100.100.100.200"
    );
  }
  return (
    value !== "::" &&
    !value.startsWith("ff") &&
    !/^fe[89ab]/.test(value) &&
    value !== "fd00:ec2::254"
  );
}
export function providerUrl(endpoint: string, path: string) {
  const url = new URL(endpoint);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    /(?:^|\.)metadata(?:\.|$)/i.test(url.hostname) ||
    /[\\]/.test(endpoint)
  )
    throw new Error("Endpoint inválido / Invalid endpoint");
  // Administrator may supply /v1 for compatible providers; fixed paths cannot escape it.
  url.pathname = `${url.pathname.replace(/\/$/, "").replace(/\/v1$/, "")}${path}`;
  return url;
}
async function call(
  config: AiConfig,
  path: string,
  credential: string | undefined,
  signal: AbortSignal,
  body?: unknown,
) {
  const url = providerUrl(config.endpoint, path);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => !allowedAddress(a.address)))
    throw new Error(
      "Endereço do provedor bloqueado / Provider address blocked",
    );
  const target = addresses[0];
  // Pin the validated address in the socket lookup to prevent DNS rebinding. Never follow redirects.
  return await new Promise<http.IncomingMessage>((resolve, reject) => {
    const req = (url.protocol === "https:" ? https : http).request(
      url,
      {
        method: body === undefined ? "GET" : "POST",
        signal,
        lookup: (_hostname, options, callback) => {
          if (options.all)
            callback(
              null,
              addresses.map((item) => ({
                address: item.address,
                family: item.family,
              })),
            );
          else callback(null, target.address, target.family);
        },
        headers: {
          "Content-Type": "application/json",
          ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
        },
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.destroy();
          reject(new Error("Provedor indisponível / Provider unavailable"));
        } else resolve(response);
      },
    );
    req.on("error", () =>
      reject(new Error("Falha de conexão / Connection failed")),
    );
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
async function json(
  config: AiConfig,
  path: string,
  credential?: string,
  body?: unknown,
  timeout = 15000,
): Promise<Record<string, unknown>> {
  const signal = AbortSignal.timeout(timeout);
  const response = await call(config, path, credential, signal, body);
  let text = "";
  for await (const chunk of response) {
    text += chunk.toString();
    if (text.length > 2_000_000) {
      response.destroy();
      throw new Error("Provider response too large");
    }
  }
  return JSON.parse(text);
}
export async function probeProvider(config: AiConfig, credential?: string) {
  const result = await json(
    config,
    config.provider === "ollama" ? "/api/tags" : "/v1/models",
    credential,
  );
  const list = (config.provider === "ollama" ? result.models : result.data) as {
    name?: string;
    id?: string;
  }[];
  if (!Array.isArray(list))
    throw new Error("Lista de modelos inválida / Invalid model list");
  const models = list
    .slice(0, 500)
    .map((m) => (config.provider === "ollama" ? m.name : m.id))
    .filter((id): id is string => typeof id === "string");
  // Every allowed model must exist; image support is recorded per model.
  const visionModels: string[] = [];
  for (const model of config.models) {
    if (!models.includes(model))
      throw new Error(`Modelo não encontrado / Model not found: ${model}`);
    if (config.provider === "ollama") {
      const show = await json(config, "/api/show", credential, { model });
      if (
        Array.isArray(show.capabilities) &&
        show.capabilities.includes("vision")
      )
        visionModels.push(model);
    } else if (config.vision) visionModels.push(model); // OpenAI-compatible model lists have no standard capability field; Admin confirms this explicitly.
  }
  if (config.vision && config.models.length && !visionModels.length)
    throw new Error(
      "Nenhum modelo aceita imagens / No selected model supports images",
    );
  return { models, visionModels };
}
export async function* streamProvider(
  config: AiConfig & { model: string },
  credential: string | undefined,
  messages: ProviderMessage[],
  signal: AbortSignal,
) {
  const ollama = config.provider === "ollama";
  const body = ollama
    ? {
        model: config.model,
        stream: true,
        // Hidden reasoning would consume the output budget and timeout before any visible reply.
        think: false,
        keep_alive: config.keepAlive < 0 ? -1 : `${config.keepAlive}m`,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          ...(m.images?.length ? { images: m.images.map((i) => i.data) } : {}),
        })),
        options: {
          temperature: config.temperature,
          num_ctx: config.context,
          num_predict: config.maxOutput,
          // Small local models otherwise fall into repeated characters or phrases.
          repeat_penalty: 1.15,
        },
      }
    : {
        model: config.model,
        stream: true,
        temperature: config.temperature,
        max_tokens: config.maxOutput,
        frequency_penalty: 0.3,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.images?.length
            ? [
                { type: "text", text: m.content },
                ...m.images.map((i) => ({
                  type: "image_url",
                  image_url: { url: `data:${i.mime};base64,${i.data}` },
                })),
              ]
            : m.content,
        })),
      };
  const response = await call(
    config,
    ollama ? "/api/chat" : "/v1/chat/completions",
    credential,
    signal,
    body,
  );
  const decoder = new TextDecoder();
  let pending = "",
    total = 0,
    done = false;
  try {
    for await (const chunk of response) {
      pending += decoder.decode(chunk, { stream: true });
      total += chunk.length;
      if (pending.length > 1_000_000 || total > 4_000_000)
        throw new Error("Provider response too large");
      const lines = pending.split("\n");
      pending = lines.pop()!;
      for (const raw of lines) {
        const line = raw.trim();
        if (!line || (!ollama && !line.startsWith("data:"))) continue;
        const data = ollama ? line : line.slice(5).trim();
        if (data === "[DONE]") {
          done = true;
          break;
        }
        const item = JSON.parse(data);
        if (item.error) throw new Error("Provider generation failed");
        const content = ollama
          ? item.message?.content
          : item.choices?.[0]?.delta?.content;
        if (typeof content === "string") yield content;
        if (item.done || item.choices?.[0]?.finish_reason) done = true;
      }
      if (done) break;
    }
    if (!done)
      throw new Error(
        "Resposta interrompida pelo provedor / Provider interrupted the response",
      );
  } finally {
    response.destroy();
  }
}

export type LoadedModel = {
  name: string;
  sizeMb: number;
  until: string | null;
};
/** Ollama only: models currently held in memory. */
export async function loadedModels(
  config: AiConfig,
  credential?: string,
): Promise<LoadedModel[]> {
  if (config.provider !== "ollama") return [];
  const result = await json(config, "/api/ps", credential);
  const list = Array.isArray(result.models) ? result.models : [];
  return list.slice(0, 50).flatMap((item) => {
    const m = item as { name?: unknown; size?: unknown; expires_at?: unknown };
    // Right after an unload Ollama still lists the model with an expiry of "now".
    const leaving =
      typeof m.expires_at === "string" &&
      Date.parse(m.expires_at) <= Date.now() + 2000;
    return typeof m.name === "string" && !leaving
      ? [
          {
            name: m.name,
            sizeMb: Math.round(Number(m.size) / 1048576) || 0,
            until: typeof m.expires_at === "string" ? m.expires_at : null,
          },
        ]
      : [];
  });
}
/** Ollama only: load an allowed model now, or release its memory. */
export async function setModelLoaded(
  config: AiConfig,
  credential: string | undefined,
  model: string,
  load: boolean,
) {
  if (config.provider !== "ollama" || !config.models.includes(model))
    throw new Error("Modelo indisponível / Model unavailable");
  await json(
    config,
    "/api/generate",
    credential,
    {
      model,
      keep_alive: load
        ? config.keepAlive < 0
          ? -1
          : `${config.keepAlive}m`
        : 0,
    },
    180000,
  );
}
