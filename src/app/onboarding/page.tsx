import { redirect } from "next/navigation";
import Link from "next/link";

import {
  completeOnboardingAction,
  connectGoogleDuringOnboardingAction,
} from "@/app/onboarding/actions";
import { OnboardingNotificationPermission } from "@/components/onboarding-notification-permission";
import { ThemeSelect } from "@/components/theme-select";
import { ProfileMediaSettings } from "@/components/profile-media-settings";
import { getAcademicMembership } from "@/lib/academic-membership";
import { listUserSubjectOfferings } from "@/lib/academic";
import { getCurrentSession } from "@/lib/authorization";
import { getGoogleConnection } from "@/lib/google/connections";
import { getGoogleIntegrationAvailability } from "@/lib/google/config";
import { getUserProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const v2Mode = process.env.OPENSTUDYHUB_V2_ENABLED === "1";
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const profile = getUserProfile(session.user.id);
  if (profile.onboardingVersion >= 1) redirect("/");

  const membership = v2Mode ? null : getAcademicMembership(session.user.id);
  const offerings = v2Mode ? [] : listUserSubjectOfferings(session.user.id);
  const googleAvailability = v2Mode ? null : getGoogleIntegrationAvailability();
  const googleConnection = v2Mode ? null : getGoogleConnection(session.user.id);

  return (
    <div className="access-shell onboarding-shell">
      <section className="access-panel onboarding-panel">
        <span className="eyebrow">PRIMEIRO ACESSO</span>
        <h1>CONFIGURAR SUA CONTA</h1>
        <p className="panel-help">
          Seu curso, turma e matrículas são definidos pela administração. Aqui
          você configura somente seu perfil e preferências pessoais.
        </p>
        <nav
          className="onboarding-progress"
          aria-label="Etapas do primeiro acesso"
        >
          <a href="#onboarding-profile">01 Perfil</a>
          <a href="#onboarding-academic">02 Acadêmico</a>
          <a href="#onboarding-google">03 Google</a>
          <a href="#onboarding-notifications">04 Notificações</a>
          <a href="#onboarding-preferences">05 Preferências</a>
          <a href="#onboarding-finish">06 Concluir</a>
        </nav>

        <form id="onboarding-complete-form" action={completeOnboardingAction} />

        <section
          className="onboarding-step onboarding-form-step"
          id="onboarding-profile"
        >
          <div className="onboarding-step-heading wide-field">
            <strong>01 / PERFIL</strong>
            <p>Escolha como seu nome aparece no Hub.</p>
          </div>
          <label>
            Nome de exibição
            <input
              form="onboarding-complete-form"
              name="displayName"
              minLength={2}
              maxLength={120}
              defaultValue={profile.displayName}
              required
            />
          </label>
          <label>
            Usuário de login
            <input value={session.user.login} readOnly aria-readonly="true" />
            <small>Definido pela administração.</small>
          </label>
          <label>
            Idioma
            <select
              form="onboarding-complete-form"
              name="locale"
              defaultValue={profile.locale}
            >
              <option value="pt-BR">Português (Brasil)</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="wide-field">
            Bio <small>opcional</small>
            <textarea
              form="onboarding-complete-form"
              name="bio"
              maxLength={500}
              rows={3}
              defaultValue={profile.bio}
            />
          </label>
          <div className="wide-field onboarding-profile-media">
            <ProfileMediaSettings
              userId={session.user.id}
              hasAvatar={Boolean(profile.avatarStorageName)}
              hasBanner={Boolean(profile.bannerStorageName)}
            />
            <small>
              Avatar e banner são opcionais e podem ser alterados depois em
              Configurações.
            </small>
          </div>
        </section>

        <section className="onboarding-step" id="onboarding-academic">
          <strong>02 / CONTEXTO ACADÊMICO</strong>
          {v2Mode ? (
            <p>
              Sua turma e disciplinas são definidas na estrutura acadêmica da
              V2. Você pode concluir seu perfil agora.
            </p>
          ) : membership ? (
            <div className="onboarding-summary">
              <span>{membership.programName}</span>
              <span>{membership.cohortName ?? "Sem turma específica"}</span>
              <span>{offerings.length} disciplina(s) disponível(is)</span>
            </div>
          ) : (
            <p>
              A administração ainda não atribuiu programa/turma a esta conta.
              Você pode concluir o onboarding mesmo assim.
            </p>
          )}
          <small>
            Este contexto é definido pela administração e não concede permissões
            por escolha do usuário.
          </small>
        </section>

        <section className="onboarding-step" id="onboarding-google">
          <strong>03 / GOOGLE</strong>
          {v2Mode ? (
            <p>
              Google é opcional.{" "}
              <Link href="/google">Configurar minha conta Google</Link> para
              descobrir e associar seus Classrooms, ou continue sem conectar.
            </p>
          ) : googleConnection?.status === "connected" ? (
            <p>
              Conta conectada
              {googleConnection.accountEmail
                ? ` · ${googleConnection.accountEmail}`
                : ""}
              .
            </p>
          ) : googleAvailability?.configured ? (
            <form action={connectGoogleDuringOnboardingAction}>
              <p>
                Opcional. Sua Conta Google pessoal é usada para Classroom e
                recursos autorizados; o Drive central da instância é separado.
              </p>
              <button type="submit">Conectar Conta Google</button>
            </form>
          ) : (
            <p>
              Google ainda não foi configurado nesta instância. Você pode
              continuar.
            </p>
          )}
        </section>

        <section className="onboarding-step" id="onboarding-notifications">
          <strong>04 / NOTIFICAÇÕES</strong>
          <OnboardingNotificationPermission />
          <label className="checkbox-label">
            <input
              form="onboarding-complete-form"
              name="desktopEnabled"
              type="checkbox"
              value="true"
              defaultChecked={false}
            />
            Ativar notificações do sistema enquanto o Hub estiver aberto
          </label>
        </section>

        <section
          className="onboarding-step onboarding-form-step"
          id="onboarding-preferences"
        >
          <div className="onboarding-step-heading wide-field">
            <strong>05 / PREFERÊNCIAS</strong>
            <p>Você pode alterar tudo isso depois em Configurações.</p>
          </div>
          <label>
            Tema
            <ThemeSelect
              form="onboarding-complete-form"
              defaultValue={profile.theme}
            />
          </label>
          <label className="checkbox-label">
            <input
              form="onboarding-complete-form"
              name="includeDefaultShortcuts"
              type="checkbox"
              value="true"
              defaultChecked
            />
            Usar atalhos iniciais da instância
          </label>
        </section>

        <section
          className="onboarding-step onboarding-finish"
          id="onboarding-finish"
        >
          <strong>06 / CONCLUIR</strong>
          <p>
            Confira os dados acima. Depois disso você entra no Hub e pode
            completar o restante em Configurações.
          </p>
          <button type="submit" form="onboarding-complete-form">
            Concluir e entrar
          </button>
        </section>
      </section>
    </div>
  );
}
