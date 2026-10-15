"use client";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { setupAction } from "../actions";
import { validateSetupStep } from "@/lib/v2/setup-validation";
const draftKey = "openstudyhub-v3-setup-draft";
const initial = {
  semesters: "4",
  language: "pt-BR",
  timeZone: "America/Sao_Paulo",
};
const titles = [
  "Sua instituição",
  "Conta do administrador",
  "Primeiro curso e turma",
  "Conferir e concluir",
];
function Finish() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending}>
      {pending ? "Criando sua instalação…" : "Criar instalação"}
    </button>
  );
}
export function SetupWizard() {
  const [step, setStep] = useState(0),
    [values, setValues] = useState<Record<string, string>>(initial),
    [problem, setProblem] = useState(""),
    [ready, setReady] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = JSON.parse(sessionStorage.getItem(draftKey) ?? "null");
        if (saved?.values) {
          const safe = { ...saved.values };
          delete safe.password;
          delete safe.confirmPassword;
          setValues({ ...initial, ...safe });
        }
      } catch {}
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const safe = { ...values };
    delete safe.password;
    delete safe.confirmPassword;
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({ values: safe }));
    } catch {}
  }, [values, ready]);
  function changeStep(n: number) {
    setStep(n);
    setProblem("");
    requestAnimationFrame(() => title.current?.focus());
  }
  function field(
    key: string,
    label: string,
    hint = "",
    type = "text",
    required = true,
  ) {
    return (
      <label>
        {label}
        <input
          name={key}
          type={type}
          value={values[key] ?? ""}
          required={required}
          onChange={(e) => setValues({ ...values, [key]: e.target.value })}
          autoComplete={type === "password" ? "new-password" : undefined}
          min={type === "number" ? 1 : undefined}
          max={type === "number" ? 20 : undefined}
        />
        {hint && <small>{hint}</small>}
      </label>
    );
  }
  function next() {
    const error = validateSetupStep(step, values);
    if (error) {
      setProblem(error);
      return;
    }
    changeStep(step + 1);
  }
  const review = [
    {
      title: "Instituição",
      step: 0,
      fields: [
        ["institution", "Nome"],
        ["language", "Idioma"],
        ["timeZone", "Fuso horário"],
      ],
    },
    {
      title: "Administrador",
      step: 1,
      fields: [
        ["name", "Nome"],
        ["login", "Login"],
      ],
    },
    {
      title: "Curso e turma",
      step: 2,
      fields: [
        ["program", "Curso"],
        ["code", "Sigla"],
        ["shift", "Turno"],
        ["cohort", "Turma"],
        ["semesters", "Semestres"],
        ["period", "Período letivo"],
        ["startsOn", "Começa em"],
        ["endsOn", "Termina em"],
      ],
    },
  ];
  return (
    <div className="admin-setup-wizard admin-first-install">
      <aside className="setup-outline">
        <h2>Primeira configuração</h2>
        <p>
          Organize o espaço de estudos e crie a conta que vai administrá-lo.
        </p>
        <ol>
          {titles.map((t, i) => (
            <li key={t} aria-current={i === step ? "step" : undefined}>
              <span>{i < step ? "✓" : i + 1}</span>
              {t}
            </li>
          ))}
        </ol>
        <p>
          A conta Admin administra a instalação. Os estudantes entram pelo App
          com suas próprias contas.
        </p>
      </aside>
      <div className="setup-main">
        <header>
          <span>PASSO {step + 1} DE 4</span>
          <h2 ref={title} tabIndex={-1}>
            {titles[step]}
          </h2>
        </header>
        {step === 0 && (
          <div className="v2-fields">
            {field(
              "institution",
              "Nome da instituição",
              "Exemplo: Universidade Aurora ou Grupo de Estudos",
            )}
            <label>
              Idioma da interface
              <select
                name="language"
                value={values.language}
                onChange={(e) =>
                  setValues({ ...values, language: e.target.value })
                }
              >
                <option value="pt-BR">Português</option>
                <option value="en">English</option>
              </select>
              <small>Você poderá mudar depois, em Sistema → Idioma.</small>
            </label>
            <label>
              Fuso das aulas
              <select
                name="timeZone"
                value={values.timeZone}
                onChange={(e) =>
                  setValues({ ...values, timeZone: e.target.value })
                }
              >
                {[
                  "America/Sao_Paulo",
                  "America/Bahia",
                  "America/Manaus",
                  "America/Rio_Branco",
                  "Europe/Lisbon",
                  "UTC",
                ].map((z) => (
                  <option key={z} value={z}>
                    {
                      (
                        {
                          "America/Sao_Paulo": "Brasília / São Paulo — Brasil",
                          "America/Bahia": "Salvador — Brasil",
                          "America/Manaus": "Manaus — Brasil",
                          "America/Rio_Branco": "Rio Branco — Brasil",
                          "Europe/Lisbon": "Lisboa — Portugal",
                          UTC: "UTC — horário universal",
                        } as Record<string, string>
                      )[z]
                    }
                  </option>
                ))}
              </select>
              <small>Os horários das aulas e provas seguem esse fuso.</small>
            </label>
          </div>
        )}
        {step === 1 && (
          <div className="v2-fields">
            {field(
              "login",
              "Login do administrador",
              "Use um nome sem espaços; exemplo: admin.aurora",
            )}
            {field("name", "Seu nome")}
            {field(
              "password",
              "Senha",
              "Pelo menos 12 caracteres. Ela não é salva no rascunho.",
              "password",
            )}
            {field("confirmPassword", "Repetir senha", "", "password")}
          </div>
        )}
        {step === 2 && (
          <>
            <div className="setup-field-group">
              <h3>Curso</h3>
              <div className="v2-fields">
                {field(
                  "program",
                  "Nome do curso",
                  "Exemplo: Análise e Desenvolvimento de Sistemas",
                )}
                {field("code", "Sigla do curso", "Exemplo: ADS")}
                {field(
                  "semesters",
                  "Duração em semestres",
                  "Exemplo: 4 semestres = 2 anos.",
                  "number",
                )}
              </div>
            </div>
            <div className="setup-field-group">
              <h3>Turma de estudantes</h3>
              <p>O grupo de pessoas que estuda junto nesse curso.</p>
              <div className="v2-fields">
                {field(
                  "cohort",
                  "Nome da turma",
                  "Exemplo: ADS — manhã — ingresso 2026",
                )}
                {field("shift", "Turno", "Exemplo: Manhã, Tarde ou Noite")}
              </div>
            </div>
            <div className="setup-field-group">
              <h3>Período letivo</h3>
              <p>O intervalo do calendário em que essa turma terá aulas.</p>
              <div className="v2-fields">
                {field("period", "Nome do período", "Exemplo: 2026.2")}
                {field("startsOn", "Data de início", "", "date")}
                {field("endsOn", "Data de fim", "", "date")}
              </div>
            </div>
            <details>
              <summary>
                Adicionar a primeira disciplina agora (opcional)
              </summary>
              <div className="v2-fields">
                {field("subject", "Disciplina", "", "text", false)}
                {field("instructor", "Professor", "", "text", false)}
                {field("location", "Sala", "", "text", false)}
              </div>
            </details>
          </>
        )}
        {step === 3 && (
          <>
            <p>
              Confira os dados. Você poderá cadastrar outras instituições,
              cursos e disciplinas depois.
            </p>
            {review.map((g) => (
              <section className="setup-review-group" key={g.title}>
                <header>
                  <h3>{g.title}</h3>
                  <button type="button" onClick={() => changeStep(g.step)}>
                    Editar
                  </button>
                </header>
                <dl>
                  {g.fields.map(([key, label]) => (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd>
                        {key === "language"
                          ? values[key] === "en"
                            ? "English"
                            : "Português"
                          : values[key]}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
            <p>Senha confirmada. Ela não é exibida nem gravada no rascunho.</p>
          </>
        )}
        {problem && (
          <p role="alert" className="v2-message" data-type="error">
            {problem}
          </p>
        )}
        <footer className="setup-actions">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => changeStep(step - 1)}
          >
            ← Voltar
          </button>
          {step < 3 ? (
            <button type="button" onClick={next}>
              Continuar →
            </button>
          ) : (
            <form action={setupAction}>
              {Object.entries(values).map(([key, value]) => (
                <input key={key} type="hidden" name={key} value={value} />
              ))}
              <Finish />
            </form>
          )}
        </footer>
      </div>
    </div>
  );
}
