import { z } from "zod";
import type { V2Database } from "./database";

const boardElement = z
  .object({
    id: z.string().min(1).max(100),
    version: z.number().int().min(1).max(1_000_000_000),
    isDeleted: z.boolean(),
  })
  .passthrough();

export type BoardElement = z.infer<typeof boardElement>;
const boardScene = z.array(boardElement).max(3000);
export const maxBoardPayloadBytes = 2 * 1024 * 1024;

export function changedBoardElements(
  elements: BoardElement[],
  known: Map<string, string>,
): BoardElement[] {
  return elements.filter(
    (element) =>
      known.get(element.id) !==
      `${element.version}:${element.versionNonce ?? 0}`,
  );
}

export function parseBoardScene(value: unknown): BoardElement[] {
  if (Buffer.byteLength(JSON.stringify(value)) > maxBoardPayloadBytes)
    throw new Error("Quadro excede o limite.");
  return boardScene.parse(value);
}

export function mergeBoardScene(
  existing: BoardElement[],
  incoming: BoardElement[],
): BoardElement[] {
  const merged = new Map(existing.map((element) => [element.id, element]));
  for (const element of incoming) {
    const previous = merged.get(element.id);
    if (
      !previous ||
      element.version > previous.version ||
      (element.version === previous.version &&
        Number(element.versionNonce ?? 0) > Number(previous.versionNonce ?? 0))
    )
      merged.set(element.id, element);
  }
  return [...merged.values()];
}

export function readGlobalWhiteboard(db: V2Database): BoardElement[] {
  const row = db
    .prepare("SELECT scene_json scene FROM global_whiteboard_v2 WHERE id=1")
    .get() as { scene: string };
  return parseBoardScene(JSON.parse(row.scene));
}

export function updateGlobalWhiteboard(
  db: V2Database,
  value: unknown,
): BoardElement[] {
  const incoming = parseBoardScene(value);
  if (incoming.some((element) => element.type === "image"))
    throw new Error("Imagens ainda não são suportadas no quadro.");
  return db.transaction(() => {
    const merged = mergeBoardScene(readGlobalWhiteboard(db), incoming);
    const json = JSON.stringify(merged);
    if (Buffer.byteLength(json) > maxBoardPayloadBytes)
      throw new Error("Quadro excede o limite.");
    db.prepare(
      "UPDATE global_whiteboard_v2 SET scene_json=?,updated_at=? WHERE id=1",
    ).run(json, Date.now());
    return merged;
  })();
}
