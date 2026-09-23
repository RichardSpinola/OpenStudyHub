"use client";
import { useState } from "react";
import { setupAction } from "../actions";
import { Help } from "../ui";
const names = [
  "Identidade",
  "Instituição e curso",
  "Turma e período",
  "Disciplinas e equipe",
  "Revisão",
];
const stepFields = [
  ["login", "name", "password"],
  ["institution", "program", "code"],
  ["shift", "cohort", "period", "startsOn", "endsOn", "semesters"],
  ["subject", "instructor", "location"],
  [],
];
export function SetupWizard() {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({
    semesters: "4",
  });
  const [problem, setProblem] = useState("");
  const field = (
    key: string,
    label: string,
    type = "text",
    hint?: string,
    required = true,
  ) => (
    <label key={key}>
      {label}
      <input
        name={key}
        type={type}
        value={values[key] ?? ""}
        onChange={(e) => setValues({ ...values, [key]: e.target.value })}
        required={required}
        aria-describedby={hint ? key + "-hint" : undefined}
      />
      {hint ? <small id={key + "-hint"}>{hint}</small> : null}
    </label>
  );
  const groups = [
    <div className="v2-fields" key="identity">
      {field("login", "Login do Admin")}
      {field("name", "Nome de exibição")}
      {field(
        "password",
        "Senha inicial",
        "Mínimo de 12 caracteres; não aparece na revisão.",
      )}
    </div>,
    <div className="v2-fields" key="org">
      {field("institution", "Instituição")}
      {field("program", "Curso")}
      {field("code", "Código do curso")}
    </div>,
    <div className="v2-fields" key="context">
      {field("shift", "Turno", "text", "Exemplo: Manhã ou Noite.")}
      {field(
        "cohort",
        "Turma",
        "text",
        "Grupo de estudantes de um curso e turno.",
      )}
      {field(
        "period",
        "Período letivo",
        "text",
        "Exemplo: 2030.1; é uma data, diferente do semestre curricular.",
      )}
      {field("startsOn", "Início", "date")}
      {field("endsOn", "Fim", "date")}
      {field("semesters", "Quantidade de semestres curriculares", "number")}
    </div>,
    <div key="review">
      <p>
        Revise a estrutura inicial. Professores, salas, disciplinas, alunos e
        matrículas podem ser adicionados em seguida na área acadêmica.
      </p>
      <dl>
        {Object.entries(values)
          .filter(([k]) => k !== "password")
          .map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>
      <p>Armazenamento local será configurado. Google é opcional.</p>
    </div>,
  ];
  function next() {
    const required = step < 3 ? stepFields[step] : [];
    const missing = required.find((k) => !values[k]?.trim());
    if (missing) {
      setProblem("Preencha todos os campos desta etapa.");
      return;
    }
    if (step === 0 && values.password.length < 12) {
      setProblem("A senha precisa ter pelo menos 12 caracteres.");
      return;
    }
    if (
      step === 2 &&
      (values.startsOn > values.endsOn ||
        Number(values.semesters) < 1 ||
        Number(values.semesters) > 20)
    ) {
      setProblem("Confira datas e quantidade de semestres.");
      return;
    }
    setProblem("");
    setStep(step + 1);
  }
  return (
    <form action={setupAction}>
      <div className="v2-steps" aria-label="Etapas do setup">
        {names.map((name, i) => (
          <span key={name} aria-current={step === i ? "step" : undefined}>
            {i + 1}. {name}
          </span>
        ))}
      </div>
      <h2>{names[step]}</h2>
      {groups[step]}
      {Object.entries(values)
        .filter(([key]) => !stepFields[step].includes(key))
        .map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
      <Help>
        Curso é a formação; turma reúne estudantes; semestre curricular indica a
        posição no currículo e período letivo indica quando as aulas acontecem.
        Você pode completar disciplinas e equipes depois.
      </Help>
      {problem ? (
        <div className="v2-message" data-type="error" role="alert">
          {problem}
        </div>
      ) : null}
      <div className="v2-actions">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => {
              setProblem("");
              setStep(step - 1);
            }}
          >
            Voltar
          </button>
        ) : null}
        {step < 4 ? (
          <button type="button" onClick={next}>
            Continuar
          </button>
        ) : (
          <button type="submit">Concluir setup</button>
        )}
      </div>
    </form>
  );
}
