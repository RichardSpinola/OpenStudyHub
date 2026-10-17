import { open, unlink } from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
const state = globalThis as typeof globalThis & {
  oshProjectTransferActive?: boolean;
};
export class ProjectTransferBusy extends Error {
  constructor() {
    super("Há um envio de projeto em andamento. Aguarde e tente novamente.");
  }
}
export async function withProjectTransfer<T>(work: () => Promise<T>) {
  if (state.oshProjectTransferActive) throw new ProjectTransferBusy();
  state.oshProjectTransferActive = true;
  try {
    return await work();
  } finally {
    state.oshProjectTransferActive = false;
  }
}
export async function spoolProjectBody(
  request: Request,
  path: string,
  limit: number,
) {
  if (Number(request.headers.get("content-length")) > limit || !request.body)
    throw new Error("ZIP exceeds the upload size limit.");
  let size = 0;
  const count = new Transform({
    transform(chunk, _, done) {
      size += chunk.length;
      if (size > limit) done(new Error("ZIP exceeds the upload size limit."));
      else done(null, chunk);
    },
  });
  const file = await open(path, "wx", 0o600);
  try {
    await pipeline(
      Readable.fromWeb(request.body as never),
      count,
      file.createWriteStream(),
    );
    if (!size) throw new Error("ZIP is empty.");
  } catch (error) {
    await unlink(path).catch(() => undefined);
    throw error;
  }
}
