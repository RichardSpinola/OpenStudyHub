<div class="osh-landing" data-landing-lang="pt">
  <header class="osh-landing-bar">
    <span><span class="osh-prompt">&gt;</span> OPENSTUDYHUB <small>/ V2</small></span>
    <div class="osh-language" role="group" aria-label="Language / Idioma">
      <button type="button" data-lang="pt" aria-pressed="true">PT</button>
      <button type="button" data-lang="en" aria-pressed="false">EN</button>
    </div>
  </header>

  <section class="osh-landing-hero" aria-labelledby="osh-title">
    <div class="osh-hero-copy">
      <p class="osh-overline" data-copy="pt">[ SUA VIDA ACADÊMICA, EM UM LUGAR ]</p>
      <p class="osh-overline" data-copy="en">[ YOUR ACADEMIC SPACE, IN ONE PLACE ]</p>
      <pre class="osh-title-ascii osh-title-ascii--desktop" aria-hidden="true">   ___                   ____  _             _       _   _       _
  / _ \ _ __   ___ _ __ / ___|| |_ _   _  __| |_   _| | | |_   _| |__
 | | | | '_ \ / _ \ '_ \\___ \| __| | | |/ _` | | | | |_| | | | | '_ \
 | |_| | |_) |  __/ | | |___) | |_| |_| | (_| | |_| |  _  | |_| | |_) |
  \___/| .__/ \___|_| |_|____/ \__|\__,_|\__,_|\__, |_| |_|\__,_|_.__/
       |_|                                     |___/</pre>
      <pre class="osh-title-ascii osh-title-ascii--mobile" aria-hidden="true">   ___  ____  _   _
  / _ \/ ___|| | | |
 | | | \___ \| |_| |
 | |_| |___) |  _  |
  \___/|____/|_| |_|</pre>
      <span class="osh-mobile-name" aria-hidden="true">OPENSTUDYHUB / V2</span>
      <h1 id="osh-title" class="osh-visually-hidden">OpenStudyHub</h1>
      <p class="osh-hero-lead" data-copy="pt">Abra o dia e encontre suas aulas, atividades e arquivos sem procurar em vários lugares.</p>
      <p class="osh-hero-lead" data-copy="en">Open your day and find classes, coursework and files without hunting through different places.</p>
      <p class="osh-hero-detail" data-copy="pt">O OpenStudyHub roda na sua própria instalação. Você decide se quer conectar Google Classroom e Drive; o espaço de estudo e a colaboração continuam disponíveis sem eles.</p>
      <p class="osh-hero-detail" data-copy="en">OpenStudyHub runs on your own installation. Connect Google Classroom and Drive if you want; the study space and collaboration work without them.</p>
      <div class="osh-landing-actions" data-copy="pt"><a class="osh-action-primary" href="instalacao-do-zero/">Começar instalação <span aria-hidden="true">↗</span></a><a href="deployment/">Ver arquitetura</a><a href="https://github.com/RichardSpinola/OpenStudyHub">Código no GitHub</a></div>
      <div class="osh-landing-actions" data-copy="en"><a class="osh-action-primary" href="en/">Read the English guide <span aria-hidden="true">↗</span></a><a href="https://github.com/RichardSpinola/OpenStudyHub">Source on GitHub</a></div>
    </div>
    <div class="osh-hero-graphic" aria-hidden="true"><div class="osh-graphic-header"><span>OSH://WORKSPACE</span><span>● ● ●</span></div><div class="osh-graphic-content"><div class="osh-graphic-title">OPEN<br>STUDY<br>HUB</div><div class="osh-graphic-rule"></div><div class="osh-graphic-row"><span>01</span> ACADEMIC CONTEXT <b>READY</b></div><div class="osh-graphic-row"><span>02</span> YOUR MATERIALS <b>LOCAL</b></div><div class="osh-graphic-row"><span>03</span> COLLABORATION <b>LIVE</b></div></div><div class="osh-graphic-footer">INSTANCE CONTROLLED BY YOU ▪ AGPL-3.0</div></div>
  </section>

  <div class="osh-landing-strip"><span>APP + CONTROL PLANE</span><span>CLASSROOM READ ONLY</span><span>OPTIONAL DRIVE</span><span>OPEN SOURCE</span></div>

  <section class="osh-landing-section" aria-labelledby="osh-academic-title"><div class="osh-section-index">01 / ACADEMIC</div><div><h2 id="osh-academic-title" data-copy="pt">O contexto vem primeiro.</h2><h2 data-copy="en">Academic context comes first.</h2><p data-copy="pt">Instituição, curso, turma e período organizam as disciplinas. Cada pessoa vê suas matrículas e pode associar seus próprios Classrooms antes de sincronizar atividades.</p><p data-copy="en">Institution, course, cohort and term organize subjects. Each person sees their own enrollments and can map their own Classrooms before syncing coursework.</p><div class="osh-feature-list"><span>DISCIPLINAS / SUBJECTS</span><span>CLASSROOM</span><span>ATIVIDADES / COURSEWORK</span><span>HOJE / TODAY</span></div></div></section>

  <section class="osh-landing-section" aria-labelledby="osh-work-title"><div class="osh-section-index">02 / WORKSPACE</div><div><h2 id="osh-work-title" data-copy="pt">Trabalhe junto. Guarde o que importa.</h2><h2 data-copy="en">Work together. Keep what matters.</h2><p data-copy="pt">Notes, Documents, Projects e Chat conectam o trabalho diário. Drive e Google Docs são opcionais; o Quadro Global e os minigames ficam em Extras, sob controle do Admin.</p><p data-copy="en">Notes, Documents, Projects and Chat connect daily work. Drive and Google Docs are optional; the Global Whiteboard and minigames live in Extras, controlled by the Admin.</p><div class="osh-feature-list"><span>NOTES</span><span>DOCUMENTS</span><span>PROJECTS</span><span>CHAT</span><span>EXTRAS</span><span>WHITEBOARD</span></div></div></section>

  <figure class="osh-landing-shot"><img src="assets/app-home.png" alt="OpenStudyHub V2 Home with fictional shortcuts" loading="lazy"><figcaption data-copy="pt">Home da V2 com atalhos padrão e busca.</figcaption><figcaption data-copy="en">V2 Home with default shortcuts and search.</figcaption></figure>

  <section class="osh-landing-section" aria-labelledby="osh-control-title"><div class="osh-section-index">03 / CONTROL</div><div><h2 id="osh-control-title" data-copy="pt">Uma instalação. Duas superfícies.</h2><h2 data-copy="en">One installation. Two surfaces.</h2><p data-copy="pt">O App atende a comunidade. O Control Plane administra instituição, contas, permissões, integrações e backups. Em Docker, o Admin fica local ou na LAN por padrão. Personalize aparência e atalhos sem perder a identidade do espaço.</p><p data-copy="en">The App serves your community. The Control Plane manages the institution, accounts, permissions, integrations and backups. With Docker, Admin stays local or on the LAN by default. Customize appearance and shortcuts without losing the workspace identity.</p><div class="osh-landing-actions" data-copy="pt"><a href="deployment/">Instalar com Docker →</a><a href="google/">Configurar Google →</a><a href="extension/">Nova Aba →</a></div><div class="osh-landing-actions" data-copy="en"><a href="en/">Installation and operations →</a><a href="extension/">New Tab extension →</a></div></div></section>

  <figure class="osh-landing-shot"><img src="assets/admin-overview.png" alt="OpenStudyHub V2 Control Plane with fictional institution" loading="lazy"><figcaption data-copy="pt">Control Plane em uma instalação fictícia.</figcaption><figcaption data-copy="en">Control Plane in a fictional installation.</figcaption></figure>

  <footer class="osh-landing-footer"><span>OPENSTUDYHUB / V2</span><span data-copy="pt">Código aberto sob <a href="LICENSING/">AGPL-3.0</a>. Integrações Google opcionais.</span><span data-copy="en">Open source under <a href="LICENSING/">AGPL-3.0</a>. Google integrations are optional.</span><a href="https://github.com/RichardSpinola/OpenStudyHub">GITHUB ↗</a></footer>
</div>
