"use client";

import { useEffect, useState } from "react";
import { setupAction } from "../actions";

const copy = {
  en: {
    names: [
      "Admin account",
      "Institution",
      "First course",
      "Period and cohort",
      "Optional details",
      "Review",
    ],
    back: "Back",
    next: "Continue",
    finish: "Complete setup",
    step: "Step",
    of: "of",
    missing: "Complete the required fields for this step.",
    password: "Use at least 12 characters for the password.",
    dates: "The end date must follow the start date.",
    semesters: "Choose 1 to 20 semesters.",
  },
  "pt-BR": {
    names: [
      "Conta Admin",
      "Instituição",
      "Curso inicial",
      "Período e turma",
      "Detalhes opcionais",
      "Revisão",
    ],
    back: "Voltar",
    next: "Continuar",
    finish: "Concluir setup",
    step: "Etapa",
    of: "de",
    missing: "Preencha os campos obrigatórios desta etapa.",
    password: "Use pelo menos 12 caracteres na senha.",
    dates: "A data final deve vir depois da inicial.",
    semesters: "Escolha entre 1 e 20 semestres.",
  },
} as const;
const requiredByStep = [
  ["login", "name", "password"],
  ["institution"],
  ["program", "code"],
  ["period", "startsOn", "endsOn", "shift", "cohort", "semesters"],
  [],
  [],
];
const initial = { semesters: "4", language: "en" };
const draftKey = "openstudyhub-v2-setup-draft";
const reviewFields = [
  ["language", "Language", "Idioma"],
  ["login", "Admin login", "Login do Admin"],
  ["name", "Admin name", "Nome do Admin"],
  ["institution", "Institution", "Instituição"],
  ["program", "Course", "Curso"],
  ["code", "Course short name", "Sigla do curso"],
  ["period", "Academic period", "Período letivo"],
  ["startsOn", "Starts", "Início"],
  ["endsOn", "Ends", "Fim"],
  ["shift", "Shift", "Turno"],
  ["cohort", "Cohort", "Turma"],
  ["semesters", "Semesters", "Semestres"],
  ["subject", "Subject", "Disciplina"],
  ["instructor", "Teacher", "Professor"],
  ["location", "Room", "Sala"],
] as const;

export function SetupWizard() {
  const [step, setStep] = useState(-1);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [problem, setProblem] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const language = values.language === "pt-BR" ? "pt-BR" : "en";
  const t = copy[language];
  const tr = (en: string, pt: string) => (language === "en" ? en : pt);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const draft = JSON.parse(
          sessionStorage.getItem(draftKey) ?? "null",
        ) as {
          step?: number;
          values?: Record<string, string>;
        } | null;
        if (!draft?.values) return;
        const { password: _discard, ...safe } = draft.values;
        void _discard;
        setValues({ ...initial, ...safe });
        setStep(-1); // A senha não é guardada; o Admin a informa novamente ao retomar.
      } catch {
        sessionStorage.removeItem(draftKey);
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const { password: _discard, ...safe } = values;
    void _discard;
    sessionStorage.setItem(draftKey, JSON.stringify({ step, values: safe }));
  }, [step, values, hydrated]);
  function field(
    key: string,
    label: string,
    options: { type?: string; required?: boolean; hint?: string } = {},
  ) {
    return (
      <label key={key}>
        {label}
        <input
          name={key}
          type={options.type ?? "text"}
          value={values[key] ?? ""}
          onChange={(event) =>
            setValues((current) => ({ ...current, [key]: event.target.value }))
          }
          required={options.required ?? true}
          autoComplete={key === "password" ? "new-password" : undefined}
        />
        {options.hint ? <small>{options.hint}</small> : null}
      </label>
    );
  }
  const groups = [
    <div key="admin" className="v2-fields">
      {field("login", tr("Admin login", "Login do Admin"))}
      {field("name", tr("Display name", "Nome de exibição"))}
      {field("password", tr("Initial password", "Senha inicial"), {
        type: "password",
        hint: tr(
          "At least 12 characters. The draft never saves your password.",
          "Mínimo de 12 caracteres. Não é salva no rascunho.",
        ),
      })}
    </div>,
    <div key="institution" className="v2-fields">
      {field("institution", tr("Institution name", "Nome da instituição"))}
    </div>,
    <div key="course" className="v2-fields">
      {field("program", tr("First course name", "Nome do primeiro curso"))}
      {field("code", tr("Institutional course code", "Código institucional"), {
        hint: tr(
          "Short name used by your institution.",
          "Abreviação usada pela instituição.",
        ),
      })}
      <p>
        {tr(
          "You can add more courses under Institutions after setup.",
          "Outros cursos podem ser adicionados em Instituições depois do setup.",
        )}
      </p>
    </div>,
    <div key="period-cohort" className="v2-fields">
      {field("period", tr("Academic period", "Período letivo"), {
        hint: tr("Example: 2030.1", "Exemplo: 2030.1"),
      })}
      {field("startsOn", tr("Start", "Início"), { type: "date" })}
      {field("endsOn", tr("End", "Fim"), { type: "date" })}
      <hr />
      {field("shift", tr("Shift", "Turno"), {
        hint: tr("Example: Evening", "Exemplo: Noite"),
      })}
      {field("cohort", tr("First cohort name", "Nome da primeira turma"))}
      {field(
        "semesters",
        tr(
          "Number of curriculum semesters",
          "Quantidade de semestres do currículo",
        ),
        {
          type: "number",
        },
      )}
    </div>,
    <div key="optional" className="v2-fields">
      {field("subject", tr("First subject", "Primeira disciplina"), {
        required: false,
      })}
      <p>
        {tr(
          "Optional. Add more subjects under the course later.",
          "Opcional. Cadastre as demais pelo curso após entrar.",
        )}
      </p>
      <hr />
      {field("instructor", tr("First teacher", "Primeiro professor"), {
        required: false,
      })}
      {field("location", tr("First room", "Primeira sala"), {
        required: false,
      })}
      <p>
        {tr(
          "You can add the rest of the team later.",
          "O restante da equipe pode ser cadastrado depois.",
        )}
      </p>
    </div>,
    <div key="review">
      <p>
        {tr(
          "Review the initial structure before creating it.",
          "Confira antes de criar a estrutura inicial.",
        )}
      </p>
      <dl className="admin-setup-review">
        {reviewFields
          .filter(([key]) => values[key])
          .map(([key, en, pt]) => (
            <div key={key}>
              <dt>{tr(en, pt)}</dt>
              <dd>
                {key === "language"
                  ? language === "en"
                    ? "English"
                    : "Português"
                  : values[key]}
              </dd>
            </div>
          ))}
      </dl>
      <p>
        {tr(
          "Your password is applied only when setup is completed.",
          "A senha será aplicada somente ao concluir.",
        )}
      </p>
    </div>,
  ];
  function next() {
    if (step === -1) {
      setProblem("");
      setStep(0);
      return;
    }
    const missing = requiredByStep[step].find((key) => !values[key]?.trim());
    if (missing) {
      setProblem(t.missing);
      return;
    }
    if (step === 0 && values.password.length < 12) {
      setProblem(t.password);
      return;
    }
    if (step === 3 && values.startsOn > values.endsOn) {
      setProblem(t.dates);
      return;
    }
    if (
      step === 3 &&
      (Number(values.semesters) < 1 || Number(values.semesters) > 20)
    ) {
      setProblem(t.semesters);
      return;
    }
    setProblem("");
    setStep(step + 1);
  }
  return (
    <div className="admin-setup-wizard">
      <ol
        className="admin-setup-progress"
        aria-label={tr("Setup steps", "Etapas do setup")}
      >
        <li aria-current={step === -1 ? "step" : undefined}>
          0. {tr("Language", "Idioma")}
        </li>
        {t.names.map((name, index) => (
          <li key={name} aria-current={index === step ? "step" : undefined}>
            {index + 1}. {name}
          </li>
        ))}
      </ol>
      <h2>
        {step === -1 ? "Choose language / Escolha o idioma" : t.names[step]}
      </h2>
      <p>
        {t.step} {step + 2} {t.of} {t.names.length + 1}
      </p>
      {step === -1 ? (
        <fieldset className="admin-setup-language">
          <legend>
            {tr(
              "Instance interface language",
              "Idioma da interface da instância",
            )}
          </legend>
          <label>
            <input
              type="radio"
              name="instance-language"
              value="en"
              checked={language === "en"}
              onChange={() =>
                setValues((current) => ({ ...current, language: "en" }))
              }
            />{" "}
            English
          </label>
          <label>
            <input
              type="radio"
              name="instance-language"
              value="pt-BR"
              checked={language === "pt-BR"}
              onChange={() =>
                setValues((current) => ({ ...current, language: "pt-BR" }))
              }
            />{" "}
            Português
          </label>
          <p>
            {tr(
              "This sets the default interface language for the App and Control Plane. Academic content keeps its original wording.",
              "Essa escolha define o idioma padrão da interface do App e do Control Plane. Conteúdo acadêmico mantém o texto original.",
            )}
          </p>
        </fieldset>
      ) : (
        groups[step]
      )}
      {problem ? (
        <p className="v2-message" data-type="error" role="alert">
          {problem}
        </p>
      ) : null}
      <div className="v2-actions">
        {step > -1 ? (
          <button
            type="button"
            onClick={() => {
              setProblem("");
              setStep(step - 1);
            }}
          >
            {t.back}
          </button>
        ) : null}
        {step < t.names.length - 1 ? (
          <button type="button" onClick={next}>
            {t.next}
          </button>
        ) : (
          <form action={setupAction}>
            {Object.entries(values).map(([key, value]) => (
              <input type="hidden" name={key} value={value} key={key} />
            ))}
            <button type="submit">{t.finish}</button>
          </form>
        )}
      </div>
    </div>
  );
}
