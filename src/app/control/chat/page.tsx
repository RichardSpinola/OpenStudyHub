import { redirect } from "next/navigation";
import { ConsoleShell } from "../ui";
import { currentAdminV2, withV2DbAsync } from "@/lib/v2/runtime";
import { getDatabase } from "@/lib/db/client";
import { ensureGlobalChatRoom } from "@/lib/v2/chat-state";
import { moderateGlobalAction } from "./actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import Link from "next/link";
export default async function ChatControlPage() {
  return withV2DbAsync(async (db) => {
    const admin = await currentAdminV2(db);
    if (!admin) redirect("/control/login");
    if (admin.mustChangePassword) redirect("/control/password");
    const connection = getDatabase(),
      room = ensureGlobalChatRoom(connection);
    const messages = connection.sqlite
      .prepare(
        "SELECT m.id,m.body_source body,u.display_name name FROM chat_messages m JOIN users u ON u.id=m.author_user_id WHERE m.room_id=? AND m.deleted_at IS NULL ORDER BY m.id DESC LIMIT 50",
      )
      .all(room) as { id: number; body: string; name: string }[];
    const reports = connection.sqlite
      .prepare(
        "SELECT r.id,r.message_id messageId,r.excerpt,r.reason,u.display_name name FROM chat_reports r JOIN users u ON u.id=r.reporter_id WHERE r.resolved_at IS NULL ORDER BY r.id DESC LIMIT 100",
      )
      .all() as {
      id: number;
      messageId: number;
      excerpt: string;
      reason: string;
      name: string;
    }[];
    return (
      <ConsoleShell
        title="Chat e denúncias"
        kicker="ADMINISTRAÇÃO / COMUNICAÇÃO"
        name={admin.name}
        admin
        active="extras"
      >
        <Link href="/control/extras">← Extras e foto do Chat Global</Link>
        <section className="panel">
          <h2>Denúncias voluntárias</h2>
          <p>
            Somente o conteúdo denunciado aparece aqui. Conversas diretas não
            ficam disponíveis para navegação administrativa.
          </p>
          {!reports.length ? (
            <p>Nenhuma denúncia pendente.</p>
          ) : (
            reports.map((r) => (
              <article key={r.id} className="tool-panel">
                <p>Enviado por {r.name}</p>
                <blockquote style={{ whiteSpace: "pre-wrap" }}>
                  {r.excerpt}
                </blockquote>
                <p>Motivo: {r.reason}</p>
                <form action={moderateGlobalAction}>
                  <input type="hidden" name="reportId" value={r.id} />
                  <input type="hidden" name="messageId" value={r.messageId} />
                  <button name="intent" value="dismiss">
                    Encerrar sem remover
                  </button>
                  <ConfirmSubmitButton
                    confirmation="Remover esta mensagem para todos?"
                    name="intent"
                    value="remove"
                  >
                    Remover mensagem denunciada
                  </ConfirmSubmitButton>
                </form>
              </article>
            ))
          )}
        </section>
        <section className="panel">
          <h2>Chat Global · mensagens recentes</h2>
          {messages.length ? (
            messages.map((m) => (
              <article key={m.id} className="tool-panel">
                <strong>{m.name}</strong>
                <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {m.body || "Imagem anexada"}
                </p>
                <form action={moderateGlobalAction}>
                  <input type="hidden" name="messageId" value={m.id} />
                  <ConfirmSubmitButton confirmation="Remover esta mensagem do Chat Global para todos?">
                    Remover mensagem
                  </ConfirmSubmitButton>
                </form>
              </article>
            ))
          ) : (
            <p>Nenhuma mensagem recente.</p>
          )}
        </section>
      </ConsoleShell>
    );
  });
}
