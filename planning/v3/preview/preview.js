/* global document, window */
const screenSelect = document.getElementById("screen");
const themeSelect = document.getElementById("theme");
const widthSelect = document.getElementById("width");
const viewport = document.getElementById("viewport");
const content = document.getElementById("content");
const dialog = document.getElementById("demo-dialog");
let toastTimer;
let libraryKind = "documents";
let libraryScope = "all";
let libraryView = "grid";
let overviewView = "wall";
const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const logo =
  " ██████╗ ██████╗ ███████╗███╗   ██╗███████╗████████╗██╗   ██╗██████╗ ██╗   ██╗██╗  ██╗██╗   ██╗██████╗ \n██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝╚══██╔══╝██║   ██║██╔══██╗╚██╗ ██╔╝██║  ██║██║   ██║██╔══██╗\n██║   ██║██████╔╝█████╗  ██╔██╗ ██║███████╗   ██║   ██║   ██║██║  ██║ ╚████╔╝ ███████║██║   ██║██████╔╝\n██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║╚════██║   ██║   ██║   ██║██║  ██║  ╚██╔╝  ██╔══██║██║   ██║██╔══██╗\n╚██████╔╝██║     ███████╗██║ ╚████║███████║   ██║   ╚██████╔╝██████╔╝   ██║   ██║  ██║╚██████╔╝██████╔╝\n ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝╚══════╝   ╚═╝    ╚═════╝ ╚═════╝    ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═════╝ \n                                                                                                       ";
const shortLogo =
  "   ___  ___ _  _ \n  / _ \\/ __| || |\n | (_) \\__ \\ __ |\n  \\___/|___/_||_|\n                 ";
const badge = (text) => `<span class="badge">${text}</span>`;
const rows = [
  {
    title: "Relatório de laboratório",
    subject: "Fundamentos de Computação",
    kind: "documents",
    access: "Privado",
    storage: "Pessoal",
    updated: "Hoje, 10:42",
    icon: "DOC",
  },
  {
    title: "Trabalho em equipe — unidade 1",
    subject: "Programação Web",
    kind: "documents",
    access: "Grupo de estudo",
    storage: "Compartilhado",
    updated: "Ontem, 16:20",
    icon: "DOC",
  },
  {
    title: "Anotações da aula 04",
    subject: "Fundamentos de Computação",
    kind: "documents",
    access: "Privado",
    storage: "Pessoal",
    updated: "12 out., 09:10",
    icon: "TXT",
  },
  {
    title: "Portal da turma",
    subject: "Programação Web · HTML / CSS / JS",
    kind: "projects",
    access: "Grupo de estudo",
    storage: "Compartilhado",
    updated: "Hoje, 11:05",
    icon: "{ }",
  },
  {
    title: "Prática de algoritmos",
    subject: "Algoritmos · Python",
    kind: "projects",
    access: "Privado",
    storage: "Pessoal",
    updated: "Ontem, 14:20",
    icon: "{ }",
  },
];
function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el.hidden = true;
  }, 6500);
}
function home() {
  return `<section class="home" aria-label="Home"><div class="home-clock"><strong>10:42</strong><small>TERÇA, 13 DE OUTUBRO</small></div><div class="home-center"><h1 class="home-wordmark" aria-label="OpenStudyHub"><span aria-hidden="true"><pre class="ascii ascii-large">${escapeHtml(logo)}</pre><pre class="ascii ascii-small">${escapeHtml(shortLogo)}</pre></span></h1><form id="search-form" role="search"><div class="search-anchor"><div class="search-field"><span class="eyebrow">Busca</span><input id="search-input" type="search" autocomplete="off" placeholder="O que você quer pesquisar?" aria-label="Pesquisar na web" aria-controls="search-suggestions" aria-expanded="false" /><button aria-label="Pesquisar">⌕</button></div><ul id="search-suggestions" class="suggestions" hidden aria-label="Sugestões demonstrativas"></ul></div><div class="search-hint"><span>/ para focar · Enter para pesquisar</span><span id="search-provider-label">Busca na web · ${document.getElementById("demo-search-provider").value}</span></div></form><div class="shortcuts" aria-label="Atalhos">${[
    ["G", "Google Drive"],
    ["▤", "Classroom"],
    ["M", "Gmail"],
    ["⌘", "GitHub"],
  ]
    .map(
      ([icon, label]) =>
        `<div class="shortcut"><button data-feedback="Na interface final, abre ${label}." aria-label="Abrir ${label}">${icon}</button><button class="shortcut-edit" data-feedback="Editar, reordenar e remover ${label} ficam acessíveis aqui, sem sair da Home." aria-label="Opções de ${label}">⋯</button><span>${label}</span></div>`,
    )
    .join(
      "",
    )}<div class="shortcut"><button data-feedback="A ação abre o cadastro rápido de um atalho." aria-label="Adicionar atalho">+</button><span>Adicionar</span></div></div><section class="home-today panel"><div class="date-block"><span>OUT</span><strong>13</strong></div><div><span class="eyebrow">Hoje</span><h3>Programação Web</h3><p class="muted">11:00–12:15 · Sala A204</p><a href="#subject" class="text-link">Ver aula e atividade →</a></div></section></div><button class="home-customize" type="button" data-home-customize aria-label="Personalizar Home" title="Personalizar Home"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m4 16 11-11 4 4-11 11H4zM13 7l4 4"/></svg></button></section>`;
}
function library() {
  return `<section class="workspace"><header class="page-heading"><div><p class="eyebrow">Biblioteca</p><h1>Biblioteca</h1><p class="muted">Arquivos pessoais e conteúdos compartilhados, com acesso explícito.</p></div><div class="heading-actions"><button data-feedback="${libraryKind === "documents" ? "Importar arquivo preserva escolha de disciplina, destino e acesso." : "Importar pasta ou ZIP abre a prévia de conteúdo antes de sincronizar."}">${libraryKind === "documents" ? "Importar arquivo" : "Importar pasta / ZIP"}</button><button class="primary" data-feedback="${libraryKind === "documents" ? "Criar documento mantém modelos, participantes, mapeamento e geração no Drive." : "Novo projeto permite começar vazio; importar permanece uma ação separada."}">${libraryKind === "documents" ? "+ Criar documento" : "+ Novo projeto"}</button></div></header><div class="tabs" role="tablist" aria-label="Tipo de conteúdo"><button role="tab" data-library-kind="documents" aria-selected="${libraryKind === "documents"}">Documentos</button><button role="tab" data-library-kind="projects" aria-selected="${libraryKind === "projects"}">Projetos</button></div><div class="library-layout"><aside class="library-sidebar" aria-label="Filtrar biblioteca">${[
    ["all", "Todos"],
    ["mine", "Meus conteúdos"],
    ["shared", "Compartilhados comigo"],
  ]
    .map(
      ([key, label]) =>
        `<button data-scope="${key}" aria-pressed="${key === libraryScope}">${label}</button>`,
    )
    .join(
      "",
    )}</aside><div><div class="library-tools"><input id="library-search" type="search" aria-label="Filtrar pelo nome" placeholder="Filtrar pelo nome…" /><select id="subject-filter" aria-label="Filtrar disciplina"><option value="all">Todas as disciplinas</option><option>Programação Web</option><option>Fundamentos de Computação</option><option>Algoritmos</option></select><div class="segmented" role="group" aria-label="Visualização da biblioteca"><button data-library-view="list" aria-pressed="${libraryView === "list"}">Lista</button><button data-library-view="grid" aria-pressed="${libraryView === "grid"}">Grade</button></div></div><div class="table-wrap" ${libraryView === "grid" ? "hidden" : ""}><table class="library-table"><thead><tr><th>Nome / contexto</th><th class="column-access">Acesso</th><th class="column-storage">Destino</th><th class="column-updated">Atualizado</th><th><span class="muted">Ações</span></th></tr></thead><tbody id="library-rows"></tbody></table><p id="library-empty" class="library-empty" hidden>Nenhum item corresponde a esses filtros.</p></div><div id="library-grid" class="library-grid" ${libraryView === "list" ? "hidden" : ""}></div><div class="library-summary"><span id="library-count"></span><span>Universidade Exemplo - OSH · destino verificável</span></div></div></div></section>`;
}
function cardArtwork(row) {
  if (row.kind === "projects")
    return `<div class="content-art project-preview" aria-hidden="true"><span class="project-braces">{ }</span><small>PROJETO</small><strong>${row.title}</strong></div>`;
  const note = row.kind === "notes";
  return `<div class="content-art" aria-hidden="true"><div class="paper-preview ${note ? "note-preview" : ""}"><small>${note ? "NOTA · ✦" : "DOCUMENTO"}</small><strong>${row.title}</strong><span>${row.subject}</span>${note ? '<span class="note-text">Estrutura de uma página<br>• Conteúdo e organização<br>• Navegação acessível</span>' : ""}<div class="paper-lines"><i></i><i></i><i></i></div></div></div>`;
}
function renderRows() {
  const query = document
    .getElementById("library-search")
    .value.toLocaleLowerCase("pt-BR");
  const subject = document.getElementById("subject-filter").value;
  const filtered = rows.filter(
    (row) =>
      row.kind === libraryKind &&
      (libraryScope === "all" ||
        (libraryScope === "mine"
          ? row.access === "Privado"
          : row.access !== "Privado")) &&
      row.title.toLocaleLowerCase("pt-BR").includes(query) &&
      (subject === "all" || row.subject.startsWith(subject)),
  );
  document.getElementById("library-rows").innerHTML = filtered
    .map(
      (row) =>
        `<tr><td><div class="file-info"><span class="file-icon" aria-hidden="true">${row.icon}</span><div><button class="file-open" data-feedback="Prévia: abrir ${row.title}. A implementação preservará contexto, conteúdo e permissões."><strong>${row.title}</strong></button><small>${row.subject}</small><small class="mobile-access">${row.access} · ${row.storage}</small></div></div></td><td class="column-access">${badge(row.access)}</td><td class="column-storage">${row.storage}</td><td class="column-updated muted">${row.updated}</td><td><button class="icon-button" data-feedback="Abrir, compartilhar, renomear e remover ficam neste menu, com impacto explicado." aria-label="Opções de ${row.title}">⋯</button></td></tr>`,
    )
    .join("");
  document.getElementById("library-grid").innerHTML = filtered.length
    ? filtered
        .map(
          (row) =>
            `<article class="library-item panel">${cardArtwork(row)}<div class="library-card-body"><h3>${row.title}</h3><p class="muted">${row.subject}</p><span class="badge">${row.access}</span><small class="muted">${row.storage} · ${row.updated}</small><button data-feedback="Abre o conteúdo sem mudar sua disciplina ou permissões.">Abrir →</button></div></article>`,
        )
        .join("")
    : '<p class="library-empty">Nenhum item corresponde a esses filtros.</p>';
  document.getElementById("library-empty").hidden = filtered.length > 0;
  document.getElementById("library-count").textContent =
    `${filtered.length} ${filtered.length === 1 ? "item" : "itens"} · prévia fictícia`;
}
function feed() {
  return `<article class="feed-entry"><header><span>AVISO · Prof. Ana</span><time>Hoje, 09:15</time></header><h3>Materiais da próxima aula</h3><p>O roteiro de prática já está disponível. Na próxima aula vamos revisar estrutura, acessibilidade e navegação.</p><button class="text-link file-open" data-feedback="Na interface final, abre o material autorizado.">Abrir material →</button></article><article class="feed-entry"><header><span>ATIVIDADE</span><time>Entrega em 20 de outubro</time></header><h3>Protótipo de uma página acadêmica</h3><p>Organize a navegação, documente suas decisões e prepare uma demonstração para o grupo.</p><span class="badge">A fazer</span></article>`;
}
function overviewSwitch() {
  return `<div id="overview-switch" class="segmented" role="group" aria-label="Visualização da visão geral"><button type="button" data-overview-view="wall" aria-pressed="${overviewView === "wall"}">Mural</button><button type="button" data-overview-view="timeline" aria-pressed="${overviewView === "timeline"}">Timeline</button></div>`;
}
function timeline() {
  return `<ol class="subject-timeline"><li><span class="timeline-point" aria-hidden="true"></span><div><small class="muted">Hoje, 10:15 · documento</small><h3>Roteiro de prática compartilhado</h3><p class="muted">Disponível para o grupo de estudo.</p></div></li><li><span class="timeline-point" aria-hidden="true"></span><div><small class="muted">Ontem, 16:20 · projeto</small><h3>Portal da turma — versão 2</h3><p class="muted">Uma nova versão foi sincronizada.</p></div></li><li><span class="timeline-point" aria-hidden="true"></span><div><small class="muted">12 out., 09:10 · nota</small><h3>Anotações da aula 04</h3><p class="muted">Conteúdo associado a esta disciplina.</p></div></li></ol>`;
}
function updateOverview() {
  document.getElementById("subject-section-title").textContent =
    overviewView === "wall" ? "Mural recente" : "Timeline";
  document.getElementById("subject-feed").innerHTML =
    overviewView === "wall" ? feed() : timeline();
  document
    .querySelectorAll("[data-overview-view]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.overviewView === overviewView),
      ),
    );
}
function subject() {
  return `<section class="workspace"><div class="subject-banner"><span class="eyebrow">WEB101 / 2026.2</span></div><header class="page-heading"><div><p class="eyebrow">Disciplinas / semestre atual</p><h1>Programação Web</h1><div class="subject-meta"><span>ES · Engenharia de Software</span><span>Prof. Ana</span><span>Turma manhã</span></div></div><span class="badge"><span class="dot"></span>Classroom atualizado</span></header><div class="tabs" role="tablist" aria-label="Seções da disciplina">${["Visão geral", "Mural", "Atividades", "Notas", "Documentos", "Projetos"].map((label, i) => `<button role="tab" data-subject-tab="${label}" aria-selected="${i === 0}">${label}</button>`).join("")}</div><div class="subject-columns"><div><section class="panel"><div class="panel-heading"><h2 id="subject-section-title">Mural recente</h2>${overviewSwitch()}</div><div id="subject-feed">${feed()}</div></section><section class="panel" style="margin-top:16px"><div class="inline-event"><div><span class="eyebrow">Próximo evento</span><h3>Aula prática excepcional</h3><p>Sábado, 17 out. · 09:00–10:30 · Laboratório 2</p></div><span class="badge">Evento pontual</span></div></section></div><aside class="subject-aside"><section class="panel"><div class="panel-heading"><h2>Ações</h2></div><div class="action-stack"><button data-feedback="A nova nota já abre com a disciplina associada.">+ Nova nota</button><button data-feedback="Selecione modelo, destino e participantes antes de gerar.">Gerar documento</button><button data-feedback="Criar vazio e importar projeto serão caminhos distintos.">Novo projeto</button><button data-feedback="A conexão e o progresso ficam visíveis; o mural não desaparece.">Sincronizar Classroom</button></div></section><section class="panel"><div class="panel-heading"><h2>Aulas</h2><span class="muted">2 / semana</span></div><div class="schedule-row"><strong>TER<br>11:00</strong><div><strong>até 12:15</strong><span>Sala A204</span></div></div><div class="schedule-row"><strong>QUI<br>11:00</strong><div><strong>até 12:15</strong><span>Sala A204</span></div></div></section></aside></div></section>`;
}
function adminDashboard() {
  return `<header class="page-heading"><div><p class="eyebrow">Control Plane / Universidade Exemplo</p><h1>Visão geral</h1><p class="muted">Estrutura, acesso e operação da sua instituição.</p></div><button class="primary" data-admin-section="Acadêmico">Ver instituições →</button></header><div class="admin-stats"><div class="stat"><strong>2</strong><span>Cursos ativos</span></div><div class="stat"><strong>32</strong><span>Pessoas</span></div><div class="stat"><strong>12</strong><span>Disciplinas no período</span></div><div class="stat"><strong>3</strong><span>Gestores</span></div></div><div class="admin-columns"><section class="panel"><div class="panel-heading"><h2>Próximas ações</h2><span class="badge">2 pendências fictícias</span></div><div class="task"><div><h3>Conferir as matrículas</h3><p>Dois cadastros ainda não têm contexto acadêmico.</p></div><button data-admin-section="Pessoas e permissões">Conferir →</button></div><div class="task"><div><h3>Preparar a recuperação</h3><p>Escolha a agenda e guarde a chave do backup.</p></div><button data-admin-section="Sistema">Configurar →</button></div><div class="task"><div><h3>Adicionar um evento acadêmico</h3><p>Aula excepcional, prova ou aviso com data e público definidos.</p></div><button data-admin-section="Acadêmico">Adicionar →</button></div></section><section class="panel"><div class="panel-heading"><h2>Operação</h2><button class="icon-button" data-feedback="Diagnóstico tem evidências e ações claras, sem expor segredos." aria-label="Opções da operação">⋯</button></div><div class="service"><strong>App / Admin / realtime</strong><span>Disponíveis</span></div><div class="service"><strong>Drive</strong><span>Última verificação: 10:30</span></div><div class="service"><strong>Classroom</strong><span>Sincronização automática</span></div><div class="service"><strong>Backup</strong><span>Agenda não definida</span></div></section></div><p class="admin-note">Esta tela mostra exemplos. Os indicadores não representam o estado da instalação real.</p>`;
}
function admin() {
  return `<div class="admin-layout"><aside class="admin-sidebar" aria-label="Seções do Admin"><p class="eyebrow">Administração</p>${["Visão geral", "Acadêmico", "Pessoas e permissões", "Integrações", "Sistema"].map((name, i) => `<button data-admin-section="${name}" ${i === 0 ? 'aria-current="page"' : ""}>${name}</button>`).join("")}</aside><section class="admin-content" id="admin-content">${adminDashboard()}</section></div>`;
}
const adminDetails = {
  Acadêmico: [
    "Instituições e cursos",
    "Períodos e turmas",
    "Disciplinas e ofertas",
    "Horários e eventos",
    "Capas das disciplinas — somente Admin",
  ],
  "Pessoas e permissões": [
    "Usuários e contexto acadêmico",
    "Matrículas",
    "Gestores por escopo",
    "Grupos e espaços institucionais",
  ],
  Integrações: [
    "Conexões Google e incidentes",
    "Drive: destino e acesso",
    "Classroom por pessoa",
  ],
  Sistema: [
    "Saúde e versão instalada",
    "Identidade e texto do título ASCII — somente Admin",
    "Extras e minigames",
    "Backup e recuperação",
    "Notificações em segundo plano",
    "Auditoria administrativa",
  ],
};
const institutions = [
  {
    id: "university",
    name: "Universidade Exemplo",
    shortName: "UE",
    courses: "2 cursos · 12 disciplinas",
    description: "Ensino superior · período 2026.2",
  },
  {
    id: "institute",
    name: "Instituto de Tecnologia",
    shortName: "IT",
    courses: "1 curso · 6 disciplinas",
    description: "Ensino técnico · período 2026.2",
  },
];
function academicPortal() {
  return `<header class="page-heading"><div><p class="eyebrow">Control Plane / Acadêmico</p><h1>Instituições</h1><p class="muted">Escolha uma instituição para administrar sua estrutura acadêmica.</p></div><button data-feedback="Cadastrar instituição inclui nome, sigla e contexto; este é um exemplo de navegação.">+ Criar instituição</button></header><div class="institution-grid">${institutions.map((item) => `<article class="panel institution-card"><span class="institution-mark" aria-hidden="true">${item.shortName}</span><h2>${item.name}</h2><p class="muted">${item.description}</p><span>${item.courses}</span><button class="primary" data-institution="${item.id}">Administrar instituição →</button></article>`).join("")}</div>`;
}
function institutionPortal(id) {
  const item = institutions.find((entry) => entry.id === id);
  if (!item) return;
  document.getElementById("admin-content").innerHTML =
    `<div class="institution-context"><button class="text-link" data-admin-section="Acadêmico">← Instituições</button><span class="muted">/ ${item.shortName}</span></div><header class="page-heading"><div><p class="eyebrow">Acadêmico / ${item.shortName}</p><h1>${item.name}</h1><p class="muted">${item.description} · ${item.courses}</p></div><button data-feedback="Editar nome e sigla mantém os dados vinculados a esta instituição.">Editar instituição</button></header><div class="portal-grid">${[
      ["Cursos", "Cursos, siglas e remoção com análise dos vínculos."],
      ["Períodos e turmas", "Organização do semestre e grupos de alunos."],
      ["Disciplinas e ofertas", "Catálogo, professores, matrículas e capas."],
      ["Horários e eventos", "Grade regular, provas e aulas excepcionais."],
    ]
      .map(
        ([title, description]) =>
          `<section class="panel portal-card"><h2>${title}</h2><p class="muted">${description}</p><button ${title === "Cursos" ? `data-create-course data-course-context="${item.shortName}"` : `data-feedback="Abre ${title.toLowerCase()} somente no contexto de ${item.name}."`}>${title === "Cursos" ? "+ Criar curso" : "Abrir →"}</button>${title === "Disciplinas e ofertas" ? '<button data-feedback="Somente Admin poderá alterar a capa; a implementação também precisa autorizar no servidor.">Ajustar capa</button>' : ""}</section>`,
      )
      .join("")}</div>`;
}
function showAdminSection(name) {
  document.querySelectorAll(".admin-sidebar button").forEach((button) => {
    if (button.dataset.adminSection === name)
      button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  const target = document.getElementById("admin-content");
  if (name === "Visão geral") {
    target.innerHTML = adminDashboard();
    return;
  }
  if (name === "Acadêmico") {
    target.innerHTML = academicPortal();
    return;
  }
  target.innerHTML = `<header class="page-heading"><div><p class="eyebrow">Control Plane</p><h1>${name}</h1><p class="muted">Uma entrada clara para cada tarefa, com contexto e próximo passo.</p></div>${name === "Acadêmico" ? '<button class="primary" data-create-course>+ Criar curso</button>' : ""}</header><section class="panel">${adminDetails[name].map((label) => `<div class="task"><div><h3>${label}</h3><p>Proposta de agrupamento da navegação. A implementação será feita na etapa responsável.</p></div>${label.startsWith("Capas das disciplinas") ? '<button data-feedback="Somente Admin poderá enviar, enquadrar e remover a capa, com autorização no servidor.">Ajustar capa</button>' : '<button data-feedback="Este fluxo terá revisão, autorização e feedback de conclusão.">Abrir →</button>'}</div>`).join("")}</section>`;
}
function render() {
  document.getElementById("home-customize-dialog").close();
  const screen = ["home", "library", "subject", "admin"].includes(
    window.location.hash.slice(1),
  )
    ? window.location.hash.slice(1)
    : "home";
  screenSelect.value = screen;
  document.querySelector(".identity-name").textContent =
    screen === "admin" ? "Admin local" : "Alex Lima";
  document.querySelector(".avatar").textContent =
    screen === "admin" ? "AD" : "AL";
  content.innerHTML = { home, library, subject, admin }[screen]();
  document.querySelectorAll("[data-nav]").forEach((link) => {
    if (link.dataset.nav === screen) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.getElementById("primary-nav").hidden = screen === "admin";
  if (screen === "library") renderRows();
  if (screen === "subject") updateOverview();
  if (screen === "home" && viewport.clientWidth > 780)
    window.requestAnimationFrame(() =>
      document.getElementById("search-input").focus({ preventScroll: true }),
    );
}
screenSelect.addEventListener("change", () => {
  window.location.hash = screenSelect.value;
});
themeSelect.addEventListener("change", () => {
  document.documentElement.dataset.theme = themeSelect.value;
});
widthSelect.addEventListener("change", () => {
  viewport.style.width =
    widthSelect.value === "auto" ? "100%" : `${widthSelect.value}px`;
});
window.addEventListener("hashchange", render);
content.addEventListener("input", (event) => {
  if (event.target.id === "library-search") {
    renderRows();
    return;
  }
  if (event.target.id !== "search-input") return;
  const list = document.getElementById("search-suggestions");
  const query = event.target.value.trim();
  list.hidden = !query;
  event.target.setAttribute("aria-expanded", String(Boolean(query)));
  list.innerHTML = query
    ? [`${query} exemplos`, `${query} tutorial`, `${query} conceitos`]
        .map(
          (text) =>
            `<li><button type="button" data-suggestion="${escapeHtml(text)}">⌕ &nbsp; ${escapeHtml(text)}</button></li>`,
        )
        .join("")
    : "";
});
content.addEventListener("change", (event) => {
  if (event.target.id === "subject-filter") renderRows();
});
content.addEventListener("submit", (event) => {
  if (event.target.id !== "search-form") return;
  event.preventDefault();
  document.getElementById("search-suggestions").hidden = true;
  document
    .getElementById("search-input")
    .setAttribute("aria-expanded", "false");
  toast(
    `Demonstração: a busca final abriria ${document.getElementById("demo-search-provider").value}. Sugestões aqui são exemplos, sem consulta externa.`,
  );
});
document.addEventListener("click", (event) => {
  const previewLink = event.target.closest("[data-preview-only]");
  if (previewLink) {
    event.preventDefault();
    toast(
      `${previewLink.dataset.previewOnly} continua uma área própria. Esta simulação contém apenas quatro telas.`,
    );
  }
  const control = event.target.closest("button");
  if (control?.hasAttribute("data-home-customize"))
    document.getElementById("home-customize-dialog").showModal();
  if (control?.dataset.overviewView) {
    overviewView = control.dataset.overviewView;
    updateOverview();
  }
  if (control?.dataset.libraryView) {
    libraryView = control.dataset.libraryView;
    content.innerHTML = library();
    renderRows();
  }

  const target = event.target.closest("button");
  if (target?.dataset.feedback) toast(target.dataset.feedback);
  if (target?.hasAttribute("data-create-course")) {
    document.getElementById("dialog-title").textContent = target.dataset
      .courseContext
      ? `Criar curso — ${target.dataset.courseContext}`
      : "Criar curso";
    dialog.showModal();
  }
  if (target?.dataset.libraryKind) {
    libraryKind = target.dataset.libraryKind;
    content.innerHTML = library();
    renderRows();
  }
  if (target?.dataset.institution)
    institutionPortal(target.dataset.institution);
  if (target?.dataset.scope) {
    libraryScope = target.dataset.scope;
    content.innerHTML = library();
    renderRows();
  }
  if (target?.dataset.adminSection)
    showAdminSection(target.dataset.adminSection);
  if (target?.dataset.subjectTab) {
    document
      .querySelectorAll("[data-subject-tab]")
      .forEach((button) =>
        button.setAttribute("aria-selected", String(button === target)),
      );
    const tab = target.dataset.subjectTab;
    document.getElementById("overview-switch").hidden = tab !== "Visão geral";
    document.getElementById("subject-section-title").textContent =
      tab === "Visão geral" ? "Mural recente" : tab;
    document.getElementById("subject-feed").innerHTML = [
      "Visão geral",
      "Mural",
    ].includes(tab)
      ? feed()
      : tab === "Notas"
        ? `<div class="panel-body"><div class="library-grid"><article class="library-item panel">${cardArtwork({ title: "Anotações da aula 04", subject: "Programação Web", kind: "notes", icon: "TXT" })}<div class="library-card-body"><h3>Anotações da aula 04</h3><small class="muted">Programação Web · nota pessoal</small><button data-feedback="A nota mantém sua prévia gráfica e o contexto acadêmico.">Abrir nota →</button></div></article></div></div>`
        : `<div class="panel-body"><h3>${tab} desta disciplina</h3><p class="muted" style="margin-top:8px">A mesma hierarquia de biblioteca, com filtros e contexto preservados.</p><button style="margin-top:16px" data-feedback="Cada seção terá sua ação específica, respeitando as permissões.">Abrir ${tab.toLowerCase()} →</button></div>`;
  }
  if (target?.dataset.subjectTab === "Visão geral") updateOverview();
  if (target?.dataset.suggestion) {
    document.getElementById("search-input").value = target.dataset.suggestion;
    document.getElementById("search-suggestions").hidden = true;
    document
      .getElementById("search-input")
      .setAttribute("aria-expanded", "false");
    document.getElementById("search-input").focus();
  }
  if (!event.target.closest("#search-form")) {
    const list = document.getElementById("search-suggestions");
    if (list) {
      list.hidden = true;
      document
        .getElementById("search-input")
        .setAttribute("aria-expanded", "false");
    }
  }
});
document.addEventListener("keydown", (event) => {
  const input = document.getElementById("search-input");
  const list = document.getElementById("search-suggestions");
  if (
    event.key === "/" &&
    input &&
    !event.target.closest("input,textarea,select,[contenteditable]")
  ) {
    event.preventDefault();
    input.focus();
  }
  if (event.key === "Escape" && list) {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
  }
  if (!list || list.hidden || !event.target.closest("#search-form")) return;
  if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
  event.preventDefault();
  const buttons = [...list.querySelectorAll("button")];
  const current = buttons.indexOf(document.activeElement);
  const next =
    event.key === "ArrowDown"
      ? (current + 1) % buttons.length
      : current < 0
        ? buttons.length - 1
        : (current - 1 + buttons.length) % buttons.length;
  buttons[next]?.focus();
});
document
  .getElementById("cancel-dialog")
  .addEventListener("click", () => dialog.close());
document.getElementById("demo-form").addEventListener("submit", (event) => {
  event.preventDefault();
  dialog.close();
  toast("Cadastro demonstrativo conferido. Nenhum curso foi salvo.");
});
document.getElementById("nav-more").addEventListener("click", (event) => {
  const nav = document.getElementById("primary-nav");
  const expanded = nav.classList.toggle("is-expanded");
  event.target.setAttribute("aria-expanded", String(expanded));
  event.target.textContent = expanded ? "Menos ⋯" : "Mais ⋯";
});
render();

const homeDrawer = document.getElementById("home-customize-dialog");
homeDrawer.addEventListener("click", (event) => {
  if (event.target !== homeDrawer) return;
  const bounds = homeDrawer.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right)
    homeDrawer.close();
});
homeDrawer.addEventListener("close", () => {
  document
    .querySelector("[data-home-customize]")
    ?.focus({ preventScroll: true });
});
document
  .getElementById("demo-search-provider")
  .addEventListener("change", (event) => {
    const label = document.getElementById("search-provider-label");
    if (label) label.textContent = `Busca na web · ${event.target.value}`;
  });

document
  .getElementById("demo-ascii-style")
  .addEventListener("change", (event) => {
    document
      .querySelector(".home-wordmark")
      ?.classList.toggle("prefer-compact", event.target.value === "Compacto");
  });
