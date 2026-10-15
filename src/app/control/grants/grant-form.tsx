"use client";
import { useState } from "react";
import { controlAction } from "../actions";
import { HiddenContext } from "../hidden-context";
type Choice = { id: number; name: string };
export function GrantForm({
  users,
  institutions,
  programs,
  cohorts,
  offerings,
}: {
  users: Choice[];
  institutions: Choice[];
  programs: Choice[];
  cohorts: Choice[];
  offerings: Choice[];
}) {
  const [kind, setKind] = useState("program");
  const groups = {
    institution: {
      label: "Instituição inteira",
      items: institutions,
      caps: [
        "manage_academics",
        "manage_cohort",
        "manage_schedule",
        "manage_enrollments",
      ],
    },
    program: {
      label: "Um curso",
      items: programs,
      caps: [
        "manage_academics",
        "manage_cohort",
        "manage_schedule",
        "manage_enrollments",
      ],
    },
    cohort: {
      label: "Uma turma de estudantes",
      items: cohorts,
      caps: ["manage_cohort", "manage_enrollments"],
    },
    offering: {
      label: "Uma disciplina do período",
      items: offerings,
      caps: ["manage_academics", "manage_schedule", "manage_enrollments"],
    },
  };
  const group = groups[kind as keyof typeof groups],
    labels: Record<string, string> = {
      manage_academics: "Editar estrutura acadêmica",
      manage_cohort: "Organizar turmas e períodos",
      manage_schedule: "Editar horários e eventos",
      manage_enrollments: "Matricular e retirar estudantes",
    };
  return (
    <form action={controlAction} className="v2-fields">
      <HiddenContext
        returnTo="/control/grants"
        intent="grant"
        scopeKind={kind}
      />
      <p>
        Um gestor pode executar somente a responsabilidade que você escolher, na
        área indicada. Ele não recebe acesso de administrador.
      </p>
      <label>
        Pessoa
        <select name="userId" required>
          <option value="">Escolha uma conta ativa</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Onde poderá atuar
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          {Object.entries(groups).map(([id, g]) => (
            <option key={id} value={id}>
              {g.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Área escolhida
        <select name="scopeId" key={kind} required defaultValue="">
          <option value="">Selecione</option>
          {group.items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        O que poderá fazer
        <select name="capability" key={kind + "cap"}>
          {group.caps.map((cap) => (
            <option key={cap} value={cap}>
              {labels[cap]}
            </option>
          ))}
        </select>
      </label>
      {!group.items.length && (
        <p role="status">
          Cadastre essa área em Instituições antes de delegar uma
          responsabilidade.
        </p>
      )}
      <button disabled={!group.items.length || !users.length}>
        Adicionar gestor
      </button>
    </form>
  );
}
