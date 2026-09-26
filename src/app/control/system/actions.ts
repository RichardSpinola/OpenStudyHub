"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDatabase } from "@/lib/db/client";
import { listExternalLinks } from "@/lib/external-links";
import { createShortcut, deleteShortcut, listShortcuts } from "@/lib/shortcuts";
import { parseExternalDocumentationUrl } from "@/lib/external-documentation";
import {
  INSTITUTION_NAME_SETTING,
  institutionNameSchema,
} from "@/lib/institution";
import {
  brandFigletFontSchema,
  brandTextSchema,
  updateBrandConfig,
} from "@/lib/home-settings";
import { setBundledStarterEnabled } from "@/lib/starter-document-templates";
import { createManualBackup } from "@/lib/v2/manual-backup";
import { currentAdminV2, withV2DbAsync } from "@/lib/v2/runtime";
import { updateUiLanguage } from "@/lib/ui-language";

async function requireControlAdmin() {
  await withV2DbAsync(async (db) => {
    const admin = await currentAdminV2(db);
    if (!admin || admin.mustChangePassword)
      throw new Error("Admin necessário.");
  });
}

export async function setInstanceLanguageAction(form: FormData) {
  await requireControlAdmin();
  try {
    updateUiLanguage(form.get("language"));
    revalidatePath("/", "layout");
    redirect("/control/system?status=language-saved");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/control/system?status=language-error");
  }
}

export async function saveInstitutionalLinkAction(form: FormData) {
  await requireControlAdmin();
  let result = "link-error";
  try {
    const label = z.string().trim().min(1).max(80).parse(form.get("label"));
    const url = parseExternalDocumentationUrl(String(form.get("url") ?? ""));
    if (!url) throw new Error("URL vazia");
    const connection = getDatabase();
    connection.sqlite.transaction(() => {
      const links = listExternalLinks(connection);
      if (links.length >= 20) throw new Error("Limite de links");
      links.push({ id: randomUUID(), label, url, newTab: true });
      if (
        form.get("alsoShortcut") === "on" &&
        !listShortcuts(connection).some((shortcut) => shortcut.url === url)
      ) {
        createShortcut({ name: label, url }, connection);
      }
      connection.sqlite
        .prepare(
          `INSERT INTO app_settings(key,value,updated_at) VALUES('links.external',?,?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`,
        )
        .run(JSON.stringify(links), Date.now());
    })();
    result = "link-saved";
    revalidatePath("/", "layout");
  } catch {
    result = "link-error";
  }
  redirect(`/control/system?status=${result}`);
}

export async function publishLinkAsShortcutAction(form: FormData) {
  await requireControlAdmin();
  const id = z.string().uuid().parse(form.get("id"));
  const connection = getDatabase();
  const link = listExternalLinks(connection).find((item) => item.id === id);
  if (!link) redirect("/control/system?status=shortcut-error");
  if (!listShortcuts(connection).some((item) => item.url === link.url))
    createShortcut({ name: link.label, url: link.url }, connection);
  revalidatePath("/");
  redirect("/control/system?status=shortcut-saved");
}

export async function saveDefaultShortcutAction(form: FormData) {
  await requireControlAdmin();
  try {
    createShortcut({
      name: z.string().trim().min(1).max(80).parse(form.get("name")),
      url: z.url().parse(form.get("url")),
    });
    revalidatePath("/");
  } catch {
    redirect("/control/system?status=shortcut-error");
  }
  redirect("/control/system?status=shortcut-saved");
}

export async function removeDefaultShortcutAction(form: FormData) {
  await requireControlAdmin();
  deleteShortcut(z.coerce.number().int().positive().parse(form.get("id")));
  revalidatePath("/");
  redirect("/control/system?status=shortcut-removed");
}

export async function removeInstitutionalLinkAction(form: FormData) {
  await requireControlAdmin();
  const id = z.string().uuid().parse(form.get("id"));
  const connection = getDatabase();
  connection.sqlite.transaction(() => {
    const links = listExternalLinks(connection);
    connection.sqlite
      .prepare(
        `INSERT INTO app_settings(key,value,updated_at) VALUES('links.external',?,?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`,
      )
      .run(JSON.stringify(links.filter((link) => link.id !== id)), Date.now());
  })();
  revalidatePath("/", "layout");
  redirect("/control/system?status=link-removed");
}

export async function saveInstitutionDisplayAction(form: FormData) {
  await requireControlAdmin();
  const name = institutionNameSchema.parse(form.get("name"));
  const connection = getDatabase();
  connection.sqlite
    .prepare(
      `INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`,
    )
    .run(INSTITUTION_NAME_SETTING, name, Date.now());
  revalidatePath("/", "layout");
  redirect("/control/system?status=institution-saved");
}

export async function saveBrandDisplayAction(form: FormData) {
  await requireControlAdmin();
  try {
    const text = brandTextSchema.parse(form.get("brandText"));
    const font = brandFigletFontSchema.parse(form.get("brandFont"));
    updateBrandConfig({ text, font }, getDatabase());
  } catch {
    redirect("/control/system?status=brand-error");
  }
  revalidatePath("/");
  redirect("/control/system?status=brand-saved");
}

export async function moveInstitutionalLinkAction(form: FormData) {
  await requireControlAdmin();
  const id = z.string().uuid().parse(form.get("id"));
  const direction = z.enum(["up", "down"]).parse(form.get("direction"));
  const connection = getDatabase();
  connection.sqlite.transaction(() => {
    const links = listExternalLinks(connection);
    const index = links.findIndex((link) => link.id === id);
    const next = index + (direction === "up" ? -1 : 1);
    if (index < 0 || next < 0 || next >= links.length) return;
    [links[index], links[next]] = [links[next], links[index]];
    connection.sqlite
      .prepare(
        `INSERT INTO app_settings(key,value,updated_at) VALUES('links.external',?,?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`,
      )
      .run(JSON.stringify(links), Date.now());
  })();
  revalidatePath("/", "layout");
  redirect("/control/system?status=link-saved");
}

export async function setBundledStarterAction(form: FormData) {
  await requireControlAdmin();
  setBundledStarterEnabled(
    String(form.get("starterKey") ?? ""),
    form.get("enabled") === "true",
  );
  revalidatePath("/documents");
  redirect("/control/system?status=starter-saved");
}

export async function createManualBackupAction() {
  await requireControlAdmin();
  let id: string;
  try {
    const backup = await createManualBackup();
    id = backup.id;
  } catch {
    redirect("/control/system?status=backup-error");
  }
  redirect(`/control/system?status=backup-created&backup=${id}`);
}
