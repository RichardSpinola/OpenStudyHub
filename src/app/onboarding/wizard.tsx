"use client";
import { UiCopy, UiLanguageProvider } from "@/components/ui-language-provider";

import { useState } from "react";
import {
  completeOnboardingAction,
  saveOnboardingProgressAction,
} from "./actions";
import { ProfileMediaSettings } from "@/components/profile-media-settings";
import type { Appearance } from "@/lib/appearance";
import { uiText } from "@/lib/translations";

const steps = ["Perfil", "Contexto acadêmico", "Google", "Pronto"] as const;
const stepsEn = ["Profile", "Academic context", "Google", "Ready"] as const;

const stepDescriptions = [
  "Mostre seu nome e sua imagem do jeito que prefere.",
  "Veja onde suas disciplinas vão aparecer.",
  "Entenda o que a conexão Google pode trazer para seus estudos.",
  "Tudo pronto para começar.",
] as const;
const stepDescriptionsEn = [
  "Show your name and picture as you prefer.",
  "See where your subjects will appear.",
  "Learn what connecting Google can bring to your studies.",
  "You're ready to get started.",
] as const;

export function OnboardingWizard({
  replay,
  initialStep,
  userId,
  login,
  profile,
  academic,
  googleConnected,
  appearance,
}: {
  replay: boolean;
  initialStep: number;
  userId: number;
  login: string;
  profile: {
    displayName: string;
    bio: string;
    locale: "pt-BR" | "en";
    hasAvatar: boolean;
    hasBanner: boolean;
  };
  academic: {
    course: string;
    cohort: string;
    period: string;
    semester: number;
  } | null;
  googleConnected: boolean;
  appearance: {
    theme: "material" | "legacy";
    mode: "dark" | "light" | "system";
    accent: Appearance["accent"];
    customAccent: string;
  };
}) {
  const [step, setStep] = useState(
    Math.min(Math.max(initialStep, 0), steps.length - 1),
  );
  const [name, setName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [locale, setLocale] = useState(profile.locale);
  const tr = (pt: string, en: string) => uiText(locale, pt, en);
  const theme = appearance.theme;
  const mode = appearance.mode;
  const accent = appearance.accent;
  const customAccent = appearance.customAccent;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function move(next: number) {
    if (next > step && step === 0 && name.trim().length < 2) {
      setError(
        tr(
          "Digite um nome com pelo menos dois caracteres.",
          "Enter a name with at least two characters.",
        ),
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (!replay) {
        const data = new FormData();
        data.set("step", String(next));
        data.set("displayName", name);
        data.set("bio", bio);
        data.set("locale", locale);
        data.set("designTheme", theme);
        data.set("appearanceMode", mode);
        data.set("accent", accent);
        data.set("customAccent", customAccent);
        await saveOnboardingProgressAction(data);
      }
      setStep(next);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : tr(
              "Não foi possível salvar o progresso.",
              "Could not save progress.",
            ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <UiLanguageProvider language={locale}>
      <main className="onboarding-wizard">
        <header className="onboarding-wizard-header">
          <span className="page-kicker">
            OPENSTUDYHUB ·{" "}
            {replay
              ? tr("REVER PRIMEIROS PASSOS", "REVIEW FIRST STEPS")
              : tr("PRIMEIRO ACESSO", "FIRST SIGN-IN")}
          </span>
          <h1>{tr(steps[step], stepsEn[step])}</h1>
          <p>{tr(stepDescriptions[step], stepDescriptionsEn[step])}</p>
          <small>
            {tr("Etapa", "Step")} {step + 1} {tr("de", "of")} {steps.length}
          </small>
        </header>
        <ol
          className="onboarding-wizard-progress"
          aria-label={tr("Progresso", "Progress")}
        >
          {steps.map((label, index) => (
            <li
              key={label}
              aria-current={index === step ? "step" : undefined}
              data-complete={index < step}
            >
              {index + 1}
              <span className="sr-only"> {tr(label, stepsEn[index])}</span>
            </li>
          ))}
        </ol>
        <div className="onboarding-wizard-body">
          {step === 0 ? (
            <section aria-label={tr("Seu perfil", "Your profile")}>
              <p>
                <UiCopy
                  pt="Escolha como você aparece no OpenStudyHub. Imagens são opcionais."
                  en="Choose how you appear in OpenStudyHub. Images are optional."
                />
              </p>
              <ProfileMediaSettings
                userId={userId}
                hasAvatar={profile.hasAvatar}
                hasBanner={profile.hasBanner}
              />
              <div className="onboarding-wizard-fields">
                <label>
                  <UiCopy pt="Nome de exibição" en="Display name" />
                  <input
                    value={name}
                    maxLength={120}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Bio{" "}
                  <small>
                    <UiCopy pt="opcional" en="optional" />
                  </small>
                  <textarea
                    value={bio}
                    maxLength={500}
                    onChange={(event) => setBio(event.target.value)}
                    rows={3}
                  />
                </label>
                <label>
                  {tr("Idioma", "Language")}
                  <select
                    value={locale}
                    onChange={(event) =>
                      setLocale(event.target.value as "pt-BR" | "en")
                    }
                  >
                    <option value="pt-BR">Português (Brasil)</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <p className="v2-muted">
                  {tr("Login:", "Username:")} {login}
                </p>
              </div>
            </section>
          ) : null}
          {step === 1 ? (
            <section>
              <p>
                <UiCopy
                  pt="Essas informações são administradas pela instituição."
                  en="Your institution manages this information."
                />
              </p>
              {academic ? (
                <dl className="onboarding-academic-summary">
                  <div>
                    <dt>
                      <UiCopy pt="Curso" en="Course" />
                    </dt>
                    <dd>{academic.course}</dd>
                  </div>
                  <div>
                    <dt>
                      <UiCopy pt="Turma" en="Cohort" />
                    </dt>
                    <dd>{academic.cohort}</dd>
                  </div>
                  <div>
                    <dt>
                      <UiCopy pt="Período" en="Period" />
                    </dt>
                    <dd>{academic.period}</dd>
                  </div>
                  <div>
                    <dt>
                      <UiCopy pt="Semestre" en="Semester" />
                    </dt>
                    <dd>
                      {academic.semester
                        ? tr(
                            `${academic.semester}º`,
                            `Semester ${academic.semester}`,
                          )
                        : tr("A definir", "Not set")}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p>
                  <UiCopy
                    pt="Seu contexto acadêmico ainda não foi atribuído. Você pode seguir."
                    en="Your academic context has not been assigned yet. You can continue."
                  />
                </p>
              )}
            </section>
          ) : null}
          {step === 2 ? (
            <section className="onboarding-google-info">
              <span className="page-kicker">{tr("OPCIONAL", "OPTIONAL")}</span>
              <h2>
                <UiCopy
                  pt="Suas turmas podem aparecer aqui"
                  en="Your cohorts can appear here"
                />
              </h2>
              <p>
                <UiCopy
                  pt="O OpenStudyHub pode conectar sua conta Google para trazer turmas do Classroom, atividades e materiais."
                  en="OpenStudyHub can connect your Google account to bring in Classroom courses, activities and materials."
                />
              </p>
              <p className="onboarding-route-hint">
                {googleConnected
                  ? tr(
                      "Sua conta já está conectada. ",
                      "Your account is already connected. ",
                    )
                  : tr(
                      "Você pode configurar depois em ",
                      "You can set this up later under ",
                    )}
                <strong>
                  {tr(
                    "Configurações → Integrações → Google",
                    "Settings → Integrations → Google",
                  )}
                </strong>
                .
              </p>
            </section>
          ) : null}
          {step === 3 ? (
            <section>
              <p>
                <UiCopy
                  pt="Seu perfil está pronto. Google, notificações e aparência (Material ou Legacy, claro ou escuro) podem ser ajustados quando quiser em Configurações."
                  en="Your profile is ready. Google, notifications and appearance (Material or Legacy, light or dark) can be adjusted any time in Settings."
                />
              </p>
              <dl className="onboarding-academic-summary">
                <div>
                  <dt>
                    <UiCopy pt="Nome" en="Name" />
                  </dt>
                  <dd>{name}</dd>
                </div>
                <div>
                  <dt>
                    <UiCopy pt="Curso" en="Course" />
                  </dt>
                  <dd>{academic?.course ?? tr("A definir", "Not set")}</dd>
                </div>
                <div>
                  <dt>Google</dt>
                  <dd>
                    {googleConnected
                      ? tr("Conectado", "Connected")
                      : tr("Opcional", "Optional")}
                  </dd>
                </div>
              </dl>
              <form
                id="onboarding-complete-form"
                action={completeOnboardingAction}
              >
                <input type="hidden" name="replay" value={String(replay)} />
                <input type="hidden" name="displayName" value={name} />
                <input type="hidden" name="bio" value={bio} />
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="designTheme" value={theme} />
                <input type="hidden" name="appearanceMode" value={mode} />
                <input type="hidden" name="accent" value={accent} />
                <input type="hidden" name="customAccent" value={customAccent} />
                <input
                  type="hidden"
                  name="theme"
                  value={mode === "light" ? "light" : "dark"}
                />
                <input type="hidden" name="desktopEnabled" value="false" />
                <input
                  type="hidden"
                  name="includeDefaultShortcuts"
                  value="true"
                />
                <button type="submit">
                  <UiCopy
                    pt="Entrar no OpenStudyHub"
                    en="Sign in to OpenStudyHub"
                  />
                </button>
              </form>
            </section>
          ) : null}
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <nav
          className="onboarding-wizard-actions"
          aria-label={tr("Etapas", "Steps")}
        >
          {step > 0 ? (
            <button
              type="button"
              disabled={busy}
              className="wizard-back"
              onClick={() => void move(step - 1)}
            >
              {tr("Voltar", "Back")}
            </button>
          ) : null}
          {step < steps.length - 1 ? (
            <button
              type="button"
              disabled={busy}
              className="wizard-next"
              onClick={() => void move(step + 1)}
            >
              {busy
                ? tr("Salvando…", "Saving…")
                : step === 2 && !googleConnected
                  ? tr("Agora não", "Not now")
                  : tr("Continuar", "Continue")}
            </button>
          ) : null}
        </nav>
      </main>
    </UiLanguageProvider>
  );
}
