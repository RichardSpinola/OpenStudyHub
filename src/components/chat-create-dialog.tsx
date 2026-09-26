"use client";
import { UiCopy, useUiText } from "@/components/ui-language-provider";

import { useRef, useState } from "react";
import {
  createAudienceChatAction,
  createDirectChatAction,
  createGroupAction,
} from "@/app/chat/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";

type Person = { id: number; displayName: string };
type Option = { id: number; name: string };

export function ChatCreateDialog({
  people,
  offerings,
  audience,
}: {
  people: Person[];
  offerings: Array<{ offeringId: number; subjectName: string }>;
  audience: null | {
    role: "admin" | "moderator" | "curator";
    programs: Option[];
    cohorts: Option[];
  };
}) {
  const tr = useUiText();
  const dialog = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<"direct" | "group" | "audience">("direct");
  function open(next: typeof kind) {
    setKind(next);
    dialog.current?.showModal();
  }
  return (
    <div className="chat-create-controls">
      <button type="button" onClick={() => open("direct")}>
        <UiCopy pt="+ Nova conversa" en="+ New conversation" />
      </button>
      <button type="button" onClick={() => open("group")}>
        <UiCopy pt="Novo grupo" en="New group" />
      </button>
      {audience ? (
        <button type="button" onClick={() => open("audience")}>
          <UiCopy pt="Nova audiência" en="New audience" />
        </button>
      ) : null}
      <dialog
        ref={dialog}
        className="chat-create-dialog"
        aria-label={tr("Criar conversa", "Create conversation")}
      >
        <div className="chat-create-dialog-heading">
          <h2>
            {kind === "direct"
              ? tr("Nova conversa", "New conversation")
              : kind === "group"
                ? tr("Novo grupo", "New group")
                : tr("Nova audiência", "New audience")}
          </h2>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label={tr("Fechar", "Close")}
          >
            ×
          </button>
        </div>
        {kind === "direct" ? (
          <form action={createDirectChatAction} className="chat-create-form">
            <label>
              <UiCopy pt="Pessoa" en="Person" />{" "}
              <select name="targetUserId" required defaultValue="">
                <option value="">
                  <UiCopy pt="Selecione uma pessoa" en="Select a person" />
                </option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.displayName}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">
              <UiCopy pt="Abrir conversa" en="Open conversation" />
            </button>
          </form>
        ) : null}
        {kind === "group" ? (
          <form action={createGroupAction} className="chat-create-form">
            <label>
              <UiCopy
                pt="Imagem do grupo (opcional)"
                en="Group image (optional)"
              />
              <input
                type="file"
                name="avatar"
                accept="image/png,image/jpeg,image/webp"
              />
              <small>
                <UiCopy
                  pt="PNG, JPEG ou WebP · até 5 MiB."
                  en="PNG, JPEG or WebP · up to 5 MiB."
                />
              </small>
            </label>
            <label>
              <UiCopy pt="Nome" en="Name" />
              <input name="name" maxLength={120} required />
            </label>
            <label>
              <UiCopy pt="Descrição (opcional)" en="Description (optional)" />{" "}
              <textarea name="description" maxLength={500} />
            </label>
            <label>
              <UiCopy pt="Disciplina (opcional)" en="Subject (optional)" />{" "}
              <select name="subjectOfferingId" defaultValue="">
                <option value="">
                  <UiCopy pt="Sem disciplina" en="No subject" />
                </option>
                {offerings.map((offering) => (
                  <option key={offering.offeringId} value={offering.offeringId}>
                    {offering.subjectName}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>
                <UiCopy pt="Membros" en="Members" />
              </legend>
              <div className="chat-create-people">
                {people.map((person) => (
                  <label key={person.id}>
                    <input
                      type="checkbox"
                      name="memberUserId"
                      value={person.id}
                    />{" "}
                    {person.displayName}
                  </label>
                ))}
              </div>
            </fieldset>
            <PendingSubmitButton
              pendingLabel={<UiCopy pt="Criando grupo…" en="Creating group…" />}
            >
              <UiCopy pt="Criar grupo" en="Create group" />
            </PendingSubmitButton>
          </form>
        ) : null}
        {kind === "audience" && audience ? (
          <form action={createAudienceChatAction} className="chat-create-form">
            <label>
              <UiCopy
                pt="Imagem da conversa (opcional)"
                en="Conversation image (optional)"
              />
              <input
                type="file"
                name="avatar"
                accept="image/png,image/jpeg,image/webp"
              />
              <small>
                <UiCopy
                  pt="PNG, JPEG ou WebP · até 5 MiB."
                  en="PNG, JPEG or WebP · up to 5 MiB."
                />
              </small>
            </label>
            <label>
              <UiCopy pt="Nome" en="Name" />
              <input name="name" maxLength={120} required />
            </label>
            <label>
              <UiCopy pt="Alcance" en="Scope" />{" "}
              <select name="audienceType" required>
                {audience.role === "admin" ? (
                  <option value="instance">
                    <UiCopy pt="Toda a instância" en="Entire instance" />
                  </option>
                ) : null}
                {audience.role !== "curator" ? (
                  <option value="program">
                    <UiCopy pt="Curso" en="Course" />
                  </option>
                ) : null}
                <option value="cohort">
                  <UiCopy pt="Turma" en="Cohort" />
                </option>
              </select>
            </label>
            <label>
              <UiCopy pt="Curso" en="Program" />{" "}
              <select name="programId" defaultValue="">
                <option value="">
                  <UiCopy pt="Selecione se necessário" en="Select if needed" />
                </option>
                {audience.programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <UiCopy pt="Turma" en="Cohort" />{" "}
              <select name="cohortId" defaultValue="">
                <option value="">
                  <UiCopy pt="Selecione se necessário" en="Select if needed" />
                </option>
                {audience.cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.name}
                  </option>
                ))}
              </select>
            </label>
            <PendingSubmitButton
              pendingLabel={
                <UiCopy pt="Criando conversa…" en="Creating conversation…" />
              }
            >
              <UiCopy pt="Criar audiência" en="Create audience" />
            </PendingSubmitButton>
          </form>
        ) : null}
      </dialog>
    </div>
  );
}
