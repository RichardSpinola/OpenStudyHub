import type { V2Database } from "@/lib/v2/database";
import type { Actor } from "@/lib/v2/actor";
import type { ManagedEntity } from "@/lib/v2/control";
import { previewAcademicRemoval } from "@/lib/v2/academic-removal";
import { isAdmin } from "@/lib/v2/access";
import { controlAction } from "./actions";
import { HiddenContext } from "./ui";
export function RemovalPanel({
  db,
  actor,
  entity,
  id,
  returnTo,
  archived = false,
}: {
  db: V2Database;
  actor: Actor;
  entity: ManagedEntity;
  id: number;
  returnTo: string;
  archived?: boolean;
}) {
  const preview = previewAcademicRemoval(db, actor, entity, id);
  return (
    <details className="admin-removal">
      <summary>Arquivar ou remover do catálogo</summary>
      <p>
        Arquivar retira o cadastro das novas escolhas e mantém vínculos e
        histórico. Excluir é definitivo e só está disponível para um cadastro
        sem dependências.
      </p>
      {preview.dependencies.length > 0 && (
        <ul>
          {preview.dependencies.map((d, i) => (
            <li key={d.table + "-" + i}>
              {d.label}: {d.count}
            </li>
          ))}
        </ul>
      )}
      <form action={controlAction}>
        <HiddenContext
          returnTo={returnTo}
          intent="lifecycle"
          entity={entity}
          id={id}
          operation={archived ? "reactivate" : "archive"}
        />
        <button>{archived ? "Reativar cadastro" : "Arquivar cadastro"}</button>
      </form>
      {isAdmin(db, actor) && (
        <form action={controlAction}>
          <HiddenContext
            returnTo={returnTo}
            intent="lifecycle"
            entity={entity}
            id={id}
            operation="delete"
          />
          <label>
            <input
              type="checkbox"
              name="confirmDelete"
              value="yes"
              required
              disabled={!preview.canDelete}
            />
            Confirmo a exclusão definitiva deste cadastro sem vínculos
          </label>
          <button className="v2-danger" disabled={!preview.canDelete}>
            Excluir cadastro vazio
          </button>
        </form>
      )}
    </details>
  );
}
