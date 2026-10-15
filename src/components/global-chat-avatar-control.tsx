"use client";
import { useState } from "react";
import { CroppedImageInput } from "@/components/cropped-image-input";
import { saveGlobalChatAvatarAction } from "@/app/control/extras/actions";
import { useUiText } from "@/components/ui-language-provider";
export function GlobalChatAvatarControl() {
  const tr = useUiText(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [version, setVersion] = useState(0);
  return (
    <section className="control-extras-group">
      <h2>{tr("Chat Global · imagem", "Global Chat · image")}</h2>
      <p>
        {tr(
          "Apenas o Admin pode alterar a foto visível para toda a instância.",
          "Only the Admin can change the photo visible to the whole instance.",
        )}
      </p>
      <form
        key={version}
        className="tool-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          const form = new FormData(e.currentTarget);
          try {
            const result = await saveGlobalChatAvatarAction(form);
            setMessage(
              result.ok
                ? tr(
                    "Imagem atualizada. Abra novamente a conversa para conferir.",
                    "Image updated. Reopen the conversation to view it.",
                  )
                : (result.error ?? "Erro"),
            );
            if (result.ok) setVersion((v) => v + 1);
          } catch {
            setMessage(
              tr(
                "Falha ao salvar. Tente novamente.",
                "Could not save. Try again.",
              ),
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <CroppedImageInput
          name="avatar"
          label={tr("Foto do Chat Global", "Global Chat photo")}
          aspectRatio={1}
          required
        />
        <button disabled={busy}>
          {busy
            ? tr("Salvando…", "Saving…")
            : tr("Salvar foto global", "Save global photo")}
        </button>
      </form>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const form = new FormData();
            form.set("remove", "1");
            const result = await saveGlobalChatAvatarAction(form);
            setMessage(
              result.ok
                ? tr(
                    "Foto removida; ícone padrão restaurado.",
                    "Photo removed; default icon restored.",
                  )
                : (result.error ?? "Erro"),
            );
            if (result.ok) setVersion((v) => v + 1);
          } catch {
            setMessage(tr("Tente novamente.", "Try again."));
          } finally {
            setBusy(false);
          }
        }}
      >
        {tr("Restaurar ícone padrão", "Restore default icon")}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
