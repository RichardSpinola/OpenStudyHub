// Isolated parser process: no tools, networking or executable document content.
import { extractAiFile } from "../src/lib/ai/files";
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
  if (input.length > 15 * 1024 * 1024) process.exit(1);
});
process.stdin.on("end", async () => {
  try {
    const { name, data, vision } = JSON.parse(input);
    const result = await extractAiFile(
      name,
      Buffer.from(data, "base64"),
      vision === true,
    );
    process.stdout.write(
      "\nOSH_AI_RESULT:" +
        JSON.stringify({ ...result, bytes: result.bytes.toString("base64") }),
    );
  } catch {
    process.stderr.write(
      "Arquivo inválido ou limites excedidos / Invalid file or limits exceeded",
    );
    process.exitCode = 1;
  }
});
