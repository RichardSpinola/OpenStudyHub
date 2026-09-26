import { UiCopy } from "@/components/ui-language-provider";
import {
  chatWallpaperAction,
  chatWallpaperUploadAction,
} from "@/app/chat/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getUiLanguage } from "@/lib/ui-language";

export function ChatWallpaperSettings({
  roomId,
  wallpaper,
  version,
  status,
}: {
  roomId: number;
  wallpaper: "plain" | "grid" | "dots" | "custom";
  version: number;
  status?: string;
}) {
  return (
    <section className="chat-wallpaper-controls">
      <h3>
        <UiCopy pt="Fundo do Chat" en="Chat background" />
      </h3>
      <p>
        <UiCopy
          pt="Esta escolha é pessoal e vale só para o Chat."
          en="This setting is personal and applies only to Chat."
        />
      </p>
      {wallpaper === "custom" ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/chat-wallpaper?v=${version}`}
            alt={
              getUiLanguage() === "en"
                ? "Preview of your Chat background"
                : "Prévia do seu fundo do Chat"
            }
          />
        </>
      ) : null}
      <form action={chatWallpaperAction}>
        <input type="hidden" name="roomId" value={roomId} />
        <label>
          <UiCopy pt="Padrão do fundo" en="Background preset" />{" "}
          <select
            name="preset"
            defaultValue={wallpaper === "custom" ? "plain" : wallpaper}
          >
            <option value="plain">
              <UiCopy pt="Nenhum" en="None" />
            </option>
            <option value="grid">
              <UiCopy pt="Grade" en="Grid" />
            </option>
            <option value="dots">
              <UiCopy pt="Linhas diagonais" en="Diagonal lines" />
            </option>
          </select>
        </label>
        <button type="submit">
          <UiCopy pt="Aplicar / remover imagem" en="Apply / remove image" />
        </button>
      </form>
      <form action={chatWallpaperUploadAction}>
        <input type="hidden" name="roomId" value={roomId} />
        <label>
          <UiCopy pt="Imagem pessoal" en="Personal image" />{" "}
          <input
            type="file"
            name="image"
            accept="image/png,image/jpeg,image/webp"
            required
          />
        </label>
        <small>
          <UiCopy
            pt="PNG, JPEG ou WebP; até 10 MiB."
            en="PNG, JPEG or WebP; up to 10 MiB."
          />
        </small>
        <PendingSubmitButton
          pendingLabel={<UiCopy pt="Enviando imagem…" en="Uploading image…" />}
        >
          <UiCopy pt="Usar imagem" en="Use image" />
        </PendingSubmitButton>
      </form>
      {status === "error" ? (
        <p role="alert">
          <UiCopy
            pt="Imagem inválida. Escolha PNG, JPEG ou WebP de até 10 MiB."
            en="Invalid image. Choose PNG, JPEG or WebP up to 10 MiB."
          />
        </p>
      ) : null}
      {status === "saved" ? (
        <p role="status">
          <UiCopy pt="Fundo atualizado." en="Background updated." />
        </p>
      ) : null}
    </section>
  );
}
