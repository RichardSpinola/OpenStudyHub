"use client";
import { UiCopy } from "@/components/ui-language-provider";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  completeSetupAction,
  type SetupActionState,
} from "@/app/setup/actions";

const initialState: SetupActionState = { status: "idle" };

type SetupLabels = {
  setupStepAccount: string;
  setupStepInstance: string;
  setupStepFinish: string;
  setupHint: string;
  institution: string;
  displayName: string;
  login: string;
  password: string;
  confirmPassword: string;
  passwordHint: string;
  language: string;
  createAdmin: string;
  setupError: string;
};

function SetupSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "..." : label}
    </button>
  );
}

export function SetupForm({
  labels,
  defaultLanguage,
}: {
  labels: SetupLabels;
  defaultLanguage: "pt-BR" | "en";
}) {
  const [state, action] = useActionState(completeSetupAction, initialState);

  return (
    <form action={action} className="access-form">
      <fieldset>
        <legend>01 · {labels.setupStepInstance}</legend>
        <label>
          {labels.institution}
          <input name="institutionName" type="text" maxLength={160} />
        </label>
        <label>
          {labels.language}
          <select name="language" defaultValue={defaultLanguage}>
            <option value="pt-BR">Português (Brasil)</option>
            <option value="en">English</option>
          </select>
        </label>
      </fieldset>

      <fieldset>
        <legend>02 · {labels.setupStepAccount}</legend>
        <p className="access-hint">{labels.setupHint}</p>
        <label>
          {labels.displayName}
          <input
            name="displayName"
            type="text"
            minLength={2}
            maxLength={120}
            autoComplete="name"
            required
          />
        </label>
        <label>
          {labels.login}
          <input
            name="login"
            type="text"
            minLength={3}
            maxLength={120}
            autoComplete="username"
            spellCheck={false}
            required
          />
        </label>
        <label>
          {labels.password}
          <input
            name="password"
            type="password"
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            required
          />
        </label>
        <label>
          {labels.confirmPassword}
          <input
            name="confirmPassword"
            type="password"
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            required
          />
        </label>
        <small>{labels.passwordHint}</small>
      </fieldset>

      <fieldset>
        <legend>
          <UiCopy
            pt="03–06 · Estrutura acadêmica inicial"
            en="03–06 · Initial academic structure"
          />
        </legend>
        <label>
          <UiCopy pt="Programa" en="Program" />
          <input name="programName" type="text" maxLength={160} required />
        </label>
        <label>
          Sigla do programa (opcional)
          <input name="programShortName" type="text" maxLength={40} />
        </label>
        <label>
          Turma (opcional)
          <input name="cohortName" type="text" maxLength={160} />
        </label>
        <label>
          <UiCopy pt="Período atual" en="Current period" />
          <input name="periodLabel" type="text" maxLength={80} required />
        </label>
        <label>
          <UiCopy pt="Início do período" en="Period start" />
          <input name="periodStartsOn" type="date" required />
        </label>
        <label>
          <UiCopy pt="Fim do período" en="Period end" />
          <input name="periodEndsOn" type="date" required />
        </label>
        <label>
          Primeira disciplina
          <input name="subjectName" type="text" maxLength={160} required />
        </label>
        <label>
          Quantidade prevista de semestres (opcional)
          <input name="expectedPeriods" type="number" min={1} max={20} />
        </label>
      </fieldset>

      <fieldset>
        <legend>
          <UiCopy
            pt="07 · Organização de arquivos"
            en="07 · File organization"
          />
        </legend>
        <label className="checkbox-label">
          <input
            name="includeCohortInStorage"
            type="checkbox"
            value="true"
            defaultChecked
          />
          <UiCopy
            pt="Incluir turma no caminho quando disponível"
            en="Include cohort in path when available"
          />
        </label>
        <p className="access-hint">
          <UiCopy
            pt="Pastas serão criadas no Drive somente quando usadas."
            en="Folders will be created in Drive only when used."
          />
        </p>
      </fieldset>

      <fieldset>
        <legend>
          <UiCopy pt="08 · Google (opcional)" en="08 · Google (optional)" />
        </legend>
        <p className="access-hint">
          <UiCopy
            pt="Conecte sua própria conta com segurança em Configurações após concluir."
            en="Connect your own account securely in Settings after finishing."
          />
        </p>
      </fieldset>

      <div className="access-finish">
        <span>09 · {labels.setupStepFinish}</span>
        {state.status === "error" ? (
          <p className="form-error" role="alert">
            {labels.setupError}
          </p>
        ) : null}
        <SetupSubmit label={labels.createAdmin} />
      </div>
    </form>
  );
}
