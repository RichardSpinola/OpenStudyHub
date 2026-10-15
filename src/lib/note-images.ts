import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import { getReadableNote } from "@/lib/notes";
import { noteImageId, noteImageMaxBytes } from "@/lib/note-image-url";

function readableImage(userId: number, id: string, db: DatabaseConnection) {
  const refs = db.sqlite
    .prepare("select note_id id from note_image_refs where image_id=?")
    .all(id) as { id: number }[];
  return refs.some((ref) => {
    try {
      getReadableNote(userId, ref.id, db);
      return true;
    } catch {
      return false;
    }
  });
}
export function attachNoteImages(
  userId: number,
  noteId: number,
  urls: Iterable<string>,
  db: DatabaseConnection,
) {
  const ids = [
    ...new Set([...urls].map(noteImageId).filter((id): id is string => !!id)),
  ];
  for (const id of ids) {
    if (!readableImage(userId, id, db))
      throw new Error(
        "Esta imagem não está disponível. Envie o arquivo novamente.",
      );
  }
  const previous = db.sqlite
    .prepare("select image_id id from note_image_refs where note_id=?")
    .all(noteId) as { id: string }[];
  const all = new Set([...ids, ...previous.map((r) => r.id)]);
  const size = db.sqlite.prepare(
    "select length(data) bytes from note_images where id=?",
  );
  const bytes = [...all].reduce(
    (sum, id) =>
      sum + ((size.get(id) as { bytes: number } | undefined)?.bytes ?? 0),
    0,
  );
  if (all.size > 50 || bytes > 20 * 1024 * 1024)
    throw new Error(
      "Esta página atingiu o limite de imagens. Use uma subpágina para continuar.",
    );
  for (const id of ids)
    db.sqlite
      .prepare(
        "insert or ignore into note_image_refs(note_id,image_id) values(?,?)",
      )
      .run(noteId, id);
}
export async function saveNoteImage(
  userId: number,
  noteId: number,
  data: Buffer,
  db: DatabaseConnection = getDatabase(),
) {
  if (!getReadableNote(userId, noteId, db).editable)
    throw new Error("Você tem acesso somente para leitura.");
  if (!data.length || data.length > noteImageMaxBytes)
    throw new Error("Escolha uma imagem de até 5 MB.");
  let image: { data: Buffer; info: { width: number; height: number } };
  try {
    const pipeline = sharp(data, {
      limitInputPixels: 20_000_000,
      failOn: "warning",
      animated: false,
    });
    const metadata = await pipeline.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? ""))
      throw new Error("format");
    image = await pipeline
      .rotate()
      .resize({
        width: 2560,
        height: 2560,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new Error(
      "Escolha uma imagem PNG, JPG ou WebP válida, com até 20 megapixels.",
    );
  }
  return db.sqlite.transaction(() => {
    // Recheck after decoding: sharing may have changed while processing the file.
    if (!getReadableNote(userId, noteId, db).editable)
      throw new Error("Você tem acesso somente para leitura.");
    const usage = db.sqlite
      .prepare(
        "select count(*) count, coalesce(sum(length(i.data)),0) bytes from note_images i join note_image_refs r on r.image_id=i.id where r.note_id=?",
      )
      .get(noteId) as { count: number; bytes: number };
    if (usage.count >= 50 || usage.bytes + image.data.length > 20 * 1024 * 1024)
      throw new Error(
        "Esta página atingiu o limite de imagens. Use uma subpágina para continuar.",
      );
    const id = randomUUID();
    db.sqlite
      .prepare(
        "insert into note_images(id,data,mime_type,width,height,created_at) values(?,?,?,?,?,?)",
      )
      .run(
        id,
        image.data,
        "image/webp",
        image.info.width,
        image.info.height,
        Date.now(),
      );
    db.sqlite
      .prepare("insert into note_image_refs(note_id,image_id) values(?,?)")
      .run(noteId, id);
    return {
      url: `/api/note-images/${id}`,
      width: image.info.width,
      height: image.info.height,
    };
  })();
}
export function readNoteImage(
  userId: number,
  id: string,
  db: DatabaseConnection = getDatabase(),
) {
  if (!readableImage(userId, id, db)) return null;
  return db.sqlite
    .prepare("select data,mime_type mimeType from note_images where id=?")
    .get(id) as { data: Buffer; mimeType: string } | undefined;
}
