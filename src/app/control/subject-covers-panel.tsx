/* eslint-disable @next/next/no-img-element -- Covers are private, authenticated endpoint responses. */
import Link from "next/link";
import type { V2Database } from "@/lib/v2/database";
import { ImageUploadPreview } from "@/components/image-upload-preview";
import { UiCopy } from "@/components/ui-language-provider";
import { controlAction } from "./actions";
import { HiddenContext } from "./hidden-context";
import { AdminActionPanel } from "./admin-action-panel";

/** Resolve records while the calling request still owns its database connection. */
export function SubjectCoversPanel({
  db,
  institutionId,
  programId,
  returnTo,
}: {
  db: V2Database;
  institutionId: number;
  programId?: number;
  returnTo: string;
}) {
  const offerings = db
    .prepare(
      `SELECT o.id,s.name,s.code,p.name course,ap.label period,o.class_group classGroup,c.storage_name cover
    FROM offerings o JOIN subjects s ON s.id=o.subject_id JOIN programs p ON p.id=o.program_id JOIN academic_periods ap ON ap.id=o.period_id
    LEFT JOIN offering_covers c ON c.offering_id=o.id WHERE p.institution_id=? AND (? IS NULL OR p.id=?) AND o.archived_at IS NULL AND p.archived_at IS NULL
    ORDER BY ap.starts_on DESC,p.name,s.name,o.id`,
    )
    .all(institutionId, programId ?? null, programId ?? null) as Array<{
    id: number;
    name: string;
    code: string;
    course: string;
    period: string;
    classGroup: string | null;
    cover: string | null;
  }>;
  return (
    <section className="admin-subject-covers">
      <div className="admin-section-header">
        <div>
          <h2>
            <UiCopy pt="Disciplinas e capas" en="Subjects and covers" />
          </h2>
          <p>
            <UiCopy
              pt="Escolha a disciplina do período para personalizar a imagem exibida aos estudantes."
              en="Choose a subject offering to customize the image shown to students."
            />
          </p>
        </div>
      </div>
      {offerings.length ? (
        <div className="admin-cover-grid">
          {offerings.map((o) => (
            <article key={o.id} className="admin-cover-card">
              <div className="admin-cover-image">
                {o.cover ? (
                  <img
                    src={`/control/offering-cover/${o.id}`}
                    alt={`Capa de ${o.name}`}
                  />
                ) : (
                  <span aria-hidden="true">{o.code}</span>
                )}
              </div>
              <div className="admin-cover-card-body">
                <h3>{o.name}</h3>
                <p>
                  {o.course} · {o.period}
                  {o.classGroup ? ` · ${o.classGroup}` : ""}
                </p>
                <AdminActionPanel
                  title={`Editar capa de ${o.name} · ${o.period}${o.classGroup ? ` · Turma ${o.classGroup}` : ""}`}
                >
                  <form action={controlAction} className="v2-fields">
                    <HiddenContext
                      returnTo={returnTo}
                      intent="offeringCover"
                      offeringId={o.id}
                    />
                    <p>
                      <UiCopy
                        pt="Essa imagem aparece no cartão e no cabeçalho da disciplina. Escolha a imagem, confira a prévia e salve."
                        en="This image appears in the subject card and header. Choose an image, check its preview and save."
                      />
                    </p>
                    <ImageUploadPreview
                      name="cover"
                      label="Imagem PNG, JPEG ou WebP · até 5 MiB"
                      alt={`Capa de ${o.name}`}
                      currentSrc={
                        o.cover ? `/control/offering-cover/${o.id}` : undefined
                      }
                    />
                    <button>
                      <UiCopy pt="Salvar capa" en="Save cover" />
                    </button>
                  </form>
                  {o.cover && (
                    <form action={controlAction}>
                      <HiddenContext
                        returnTo={returnTo}
                        intent="offeringCoverRemove"
                        offeringId={o.id}
                      />
                      <button className="v2-danger">
                        <UiCopy
                          pt="Restaurar capa padrão"
                          en="Restore default cover"
                        />
                      </button>
                    </form>
                  )}
                </AdminActionPanel>
                {programId && (
                  <Link
                    href={`/control/institutions/${institutionId}/courses/${programId}?section=offerings`}
                  >
                    <UiCopy pt="Dados da disciplina →" en="Subject details →" />
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="useful-empty">
          <strong>
            <UiCopy
              pt="Ainda não há disciplinas em um período"
              en="No subjects in an academic period yet"
            />
          </strong>
          <p>
            <UiCopy
              pt="Abra o curso, cadastre as disciplinas e adicione cada uma ao período letivo. Depois as capas aparecerão aqui."
              en="Open the course, add subjects and assign each to an academic period. Their covers will then appear here."
            />
          </p>
          <Link href={`/control/institutions/${institutionId}?area=courses`}>
            Abrir cursos →
          </Link>
        </div>
      )}
    </section>
  );
}
