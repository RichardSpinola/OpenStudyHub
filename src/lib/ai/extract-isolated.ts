import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
export async function extractIsolated(
  name: string,
  bytes: Buffer,
  vision: boolean,
): Promise<{
  text: string;
  truncated: boolean;
  mime: string;
  image: boolean;
  bytes: Buffer;
}> {
  const built = resolve(process.cwd(), "dist/ai-extract.mjs");
  const bundled = existsSync(built);
  return new Promise((accept, reject) => {
    const child = spawn(
      process.execPath,
      [
        // Source checkouts transpile PDF.js with tsx at startup, which needs more heap
        // than the bundled parser used by the production image.
        `--max-old-space-size=${bundled ? 192 : 768}`,
        ...(bundled
          ? [built]
          : [
              "--import",
              "tsx",
              resolve(process.cwd(), "scripts/ai-extract.ts"),
            ]),
      ],
      {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          NODE_ENV: process.env.NODE_ENV,
          PATH: process.env.PATH,
          TZ: "UTC",
        },
      },
    );
    const timeout = setTimeout(() => child.kill("SIGKILL"), 20000);
    let output = "",
      size = 0,
      settled = false;
    const fail = () => {
      if (!settled) {
        settled = true;
        child.kill("SIGKILL");
        clearTimeout(timeout);
        reject(
          new Error(
            "Arquivo inválido ou limites excedidos. / Invalid file or limits exceeded.",
          ),
        );
      }
    };
    child.stdout.on("data", (chunk) => {
      size += chunk.length;
      if (size > 16 * 1024 * 1024) {
        child.kill("SIGKILL");
        fail();
      } else output += chunk;
    });
    child.stderr.on("data", () => {
      /* Parser diagnostics never enter application logs. */
    });
    child.on("error", fail);
    child.stdin.on("error", fail);
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        fail();
        return;
      }
      if (!settled)
        try {
          const marker = output.lastIndexOf("\nOSH_AI_RESULT:");
          if (marker < 0) throw new Error("Invalid parser output");
          const result = JSON.parse(
            output.slice(marker + "\nOSH_AI_RESULT:".length),
          );
          settled = true;
          accept({ ...result, bytes: Buffer.from(result.bytes, "base64") });
        } catch {
          fail();
        }
    });
    child.stdin.end(
      JSON.stringify({ name, data: bytes.toString("base64"), vision }),
    );
  });
}
