/* global document, window, ResizeObserver */
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
  return `<section class="home" aria-label="Home"><div class="home-clock"><strong>10:42</strong><small>TERÇA, 13 DE OUTUBRO</small></div><div class="home-center"><h1 class="home-wordmark" aria-label="OpenStudyHub"><span aria-hidden="true"><pre class="ascii ascii-large">${escapeHtml(logo)}</pre><pre class="ascii ascii-small">${escapeHtml(shortLogo)}</pre></span></h1><form id="search-form" role="search"><div class="search-anchor"><div class="search-field"><span class="eyebrow">Busca</span><input id="search-input" type="search" autocomplete="off" placeholder="O que você quer pesquisar?" aria-label="Pesquisar na web" aria-controls="search-suggestions" aria-expanded="false" /><button aria-label="Pesquisar">${referenceIcon("IconSearch")}</button></div><ul id="search-suggestions" class="suggestions" hidden aria-label="Sugestões demonstrativas"></ul></div><div class="search-hint"><span>/ para focar · Enter para pesquisar</span><span id="search-provider-label">Busca na web · ${document.getElementById("demo-search-provider").value}</span></div></form><div class="shortcuts" aria-label="Atalhos">${[
    ["IconBrandGoogleDrive", "Google Drive"],
    ["IconChalkboardTeacher", "Classroom"],
    ["IconBrandGmail", "Gmail"],
    ["IconBrandGithub", "GitHub"],
  ]
    .map(
      ([icon, label]) =>
        `<div class="shortcut"><button data-feedback="Na interface final, abre ${label}." aria-label="Abrir ${label}">${referenceIcon(icon)}</button><button class="shortcut-edit" data-feedback="Editar, reordenar e remover ${label} ficam acessíveis aqui, sem sair da Home." aria-label="Opções de ${label}">⋯</button><span>${label}</span></div>`,
    )
    .join(
      "",
    )}<div class="shortcut"><button data-feedback="A ação abre o cadastro rápido de um atalho." aria-label="Adicionar atalho">${referenceIcon("IconPlus")}</button><span>Adicionar</span></div></div><section class="home-today panel"><a href="#today" class="home-today-copy">${todaySummary()}<span class="home-today-open">Abrir Hoje →</span></a><button type="button" data-hide-today aria-label="Ocultar resumo Hoje">×</button></section></div><button class="home-customize" type="button" data-home-customize aria-label="Personalizar Home" title="Personalizar Home">${referenceIcon("IconPencil")}</button></section>`;
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
            `<article class="library-item panel">${cardArtwork(row)}<div class="library-card-body"><h3>${row.title}</h3><p class="muted">${row.subject}</p>${row.kind === "projects" ? `<div class="technology-preview">${projectStack(row)}</div>` : ""}<span class="badge">${row.access}</span><small class="muted">${row.storage} · ${row.updated}</small><button data-feedback="Abre o conteúdo sem mudar sua disciplina ou permissões.">Abrir →</button></div></article>`,
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
  const sample = demoSubjects[currentSubjectIndex];
  const markup = `<section class="workspace"><div class="subject-banner"><span class="eyebrow">WEB101 / 2026.2</span></div><header class="page-heading"><div><p class="eyebrow">Disciplinas / semestre atual</p><h1>Programação Web</h1><div class="subject-meta"><span>ES · Engenharia de Software</span><span>Prof. Ana</span><span>Turma manhã</span></div></div><span class="badge"><span class="dot"></span>Classroom atualizado</span></header><div class="tabs" role="tablist" aria-label="Seções da disciplina">${["Visão geral", "Mural", "Atividades", "Notas", "Documentos", "Projetos"].map((label, i) => `<button role="tab" data-subject-tab="${label}" aria-selected="${i === 0}">${label}</button>`).join("")}</div><div class="subject-columns"><div><section class="panel"><div class="panel-heading"><h2 id="subject-section-title">Mural recente</h2>${overviewSwitch()}</div><div id="subject-feed">${feed()}</div></section><section class="panel" style="margin-top:16px"><div class="inline-event"><div><span class="eyebrow">Próximo evento</span><h3>Aula prática excepcional</h3><p>Sábado, 17 out. · 09:00–10:30 · Laboratório 2</p></div><span class="badge">Evento pontual</span></div></section></div><aside class="subject-aside"><section class="panel"><div class="panel-heading"><h2>Ações</h2></div><div class="action-stack"><button data-feedback="A nova nota já abre com a disciplina associada.">+ Nova nota</button><button data-feedback="Selecione modelo, destino e participantes antes de gerar.">Gerar documento</button><button data-feedback="Criar vazio e importar projeto serão caminhos distintos.">Novo projeto</button><button data-feedback="A conexão e o progresso ficam visíveis; o mural não desaparece.">Sincronizar Classroom</button></div></section><section class="panel"><div class="panel-heading"><h2>Aulas</h2><span class="muted">2 / semana</span></div><div class="schedule-row"><strong>TER<br>11:00</strong><div><strong>até 12:15</strong><span>Sala A204</span></div></div><div class="schedule-row"><strong>QUI<br>11:00</strong><div><strong>até 12:15</strong><span>Sala A204</span></div></div></section></aside></div></section>`;
  const [days, times] = sample.when.split(" · ");
  const [startsAt, endsAt] = times.split("–");
  const lessonDays = days.split(" / ");
  const rowsStart = markup.indexOf('<div class="schedule-row">');
  const rowsEnd = markup.indexOf("</section></aside>", rowsStart);
  const lessons = lessonDays
    .map(
      (day) =>
        `<div class="schedule-row"><strong>${day.toUpperCase()}<br>${startsAt}</strong><div><strong>até ${endsAt}</strong><span>Sala A204</span></div></div>`,
    )
    .join("");
  const contextualMarkup =
    markup.slice(0, rowsStart) + lessons + markup.slice(rowsEnd);
  return contextualMarkup
    .replace("2 / semana", `${lessonDays.length} / semana`)
    .replaceAll("Programação Web", sample.name)
    .replaceAll("WEB101", sample.code)
    .replaceAll("Prof. Ana", sample.teacher);
}
function adminDashboard() {
  return `<header class="page-heading"><div><p class="eyebrow">Control Plane / Universidade Exemplo</p><h1>Visão geral</h1><p class="muted">Estrutura, acesso e operação da sua instituição.</p></div><button class="primary" data-admin-section="Acadêmico">Ver instituições →</button></header><div class="admin-stats"><div class="stat"><strong>2</strong><span>Cursos ativos</span></div><div class="stat"><strong>32</strong><span>Pessoas</span></div><div class="stat"><strong>12</strong><span>Disciplinas no período</span></div><div class="stat"><strong>3</strong><span>Gestores</span></div></div><div class="admin-columns"><section class="panel"><div class="panel-heading"><h2>Próximas ações</h2><span class="badge">2 pendências fictícias</span></div><div class="task"><div><h3>Conferir as matrículas</h3><p>Dois cadastros ainda não têm contexto acadêmico.</p></div><button data-admin-section="Pessoas e permissões">Conferir →</button></div><div class="task"><div><h3>Preparar a recuperação</h3><p>Escolha a agenda e guarde a chave do backup.</p></div><button data-admin-section="Sistema">Configurar →</button></div><div class="task"><div><h3>Adicionar um evento acadêmico</h3><p>Aula excepcional, prova ou aviso com data e público definidos.</p></div><button data-admin-section="Acadêmico">Adicionar →</button></div></section><section class="panel"><div class="panel-heading"><h2>Operação</h2><button class="icon-button" data-feedback="Diagnóstico tem evidências e ações claras, sem expor segredos." aria-label="Opções da operação">⋯</button></div><div class="service"><strong>App / Admin / realtime</strong><span>Disponíveis</span></div><div class="service"><strong>Drive</strong><span>Última verificação: 10:30</span></div><div class="service"><strong>Classroom</strong><span>Sincronização automática</span></div><div class="service"><strong>Backup</strong><span>Agenda não definida</span></div></section></div><p class="admin-note">Esta tela mostra exemplos. Os indicadores não representam o estado da instalação real.</p>`;
}
function admin() {
  return `<div class="admin-layout"><aside class="admin-sidebar" aria-label="Seções do Admin"><p class="eyebrow">Administração</p>${["Visão geral", "Acadêmico", "Pessoas e permissões", "Integrações", "Sistema"].map((name, i) => `<button data-admin-section="${name}" ${i === 0 ? 'aria-current="page"' : ""}>${name}</button>`).join("")}</aside><section class="admin-content" id="admin-content">${adminDashboard()}</section></div>`;
}
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
  target.innerHTML = adminSectionOverview(name);
}
const referenceIcon = (name) => window.previewReferences.icons[name] ?? "";
const demoSubjects = [
  {
    code: "WEB101",
    name: "Programação Web",
    course: "ES",
    teacher: "Prof. Ana",
    when: "Ter / Qui · 11:00–12:15",
  },
  {
    code: "ALG102",
    name: "Algoritmos",
    course: "ES",
    teacher: "Prof. Bruno",
    when: "Qua · 09:00–10:30",
  },
  {
    code: "COM103",
    name: "Fundamentos de Computação",
    course: "ES",
    teacher: "Prof. Carla",
    when: "Sex · 09:00–10:30",
  },
];
function todaySummary() {
  return `<span class="eyebrow">Hoje</span><strong>Próxima aula: Programação Web</strong><small>ter., 13 out. · 11:00–12:15 · Sala A204</small><span><strong>Prazo:</strong> Protótipo de uma página acadêmica · 20 out.</span><span class="muted">Mural atualizado: o roteiro de prática já está disponível.</span>`;
}
let currentSubjectIndex = 0;
function subjectCards() {
  return `<section class="workspace"><header class="page-heading"><div><p class="eyebrow">Disciplinas / 2026.2</p><h1>Disciplinas</h1><p class="muted">Manter cartões, capas e contexto acadêmico já aprovados.</p></div></header><div class="institution-grid">${demoSubjects.map((entry) => `<article class="panel subject-catalog-card"><div class="subject-banner"><span>${entry.code}</span></div><div class="library-card-body"><small>${entry.code} / 2026.2</small><h2>${entry.name}</h2><p class="muted">${entry.course} · turma manhã</p><p class="muted">${entry.teacher}</p><button class="text-link" data-open-subject="${demoSubjects.indexOf(entry)}">Abrir disciplina →</button></div></article>`).join("")}</div><details class="history-preview panel"><summary>Semestres anteriores</summary><p class="muted">Manter o histórico atual, com acesso aos conteúdos anteriores.</p></details></section>`;
}
function today() {
  const days = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
  return `<section class="workspace"><header class="page-heading"><div><p class="eyebrow">Agenda / 2026.2</p><h1>Hoje</h1><p class="muted">Conteúdo e organização atuais preservados; ajuste pontual da grade.</p></div><span class="muted">terça-feira, 13 de outubro</span></header><section class="panel"><div class="today-example-summary">${todaySummary()}<a class="text-link" href="#subject">Ver disciplina →</a></div></section><section class="panel weekly-preview"><div class="panel-heading"><h2>Grade da semana</h2><small class="muted">09:00–12:15 · intervalo das aulas fictícias</small></div><div class="week-preview-grid">${days.map((day, i) => `<section><h3>${day}</h3>${i === 1 || i === 3 ? '<div class="week-lesson"><strong>Programação Web</strong><small>11:00–12:15 · Sala A204</small></div>' : i === 2 || i === 4 ? `<div class="week-lesson"><strong>${i === 2 ? "Algoritmos" : "Fundamentos de Computação"}</strong><small>09:00–10:30 · Sala A202</small></div>` : '<small class="muted">Sem aulas</small>'}</section>`).join("")}</div><p class="panel-body muted">A implementação conserva a grade temporal: limites calculados pelos horários reais, sem horas artificiais nem duplicação da sala. Esta é uma amostra resumida.</p></section><section class="panel"><div class="panel-heading"><h2>Próximos eventos</h2></div><div class="panel-body"><strong>Aula prática excepcional</strong><p class="muted">Sábado, 17 out. · 09:00–10:30 · Laboratório 2</p></div></section></section>`;
}
function projectStack(row) {
  return row.title.includes("algoritmos") || row.subject.includes("Python")
    ? `${referenceIcon("IconBrandPython")}<small>Python</small>`
    : `${referenceIcon("IconBrandHtml5")}${referenceIcon("IconBrandCss3")}${referenceIcon("IconBrandJavascript")}<small>HTML · CSS · JavaScript</small>`;
}
function resourceCards(items) {
  return `<div class="library-grid">${items.map((row) => `<article class="library-item panel">${cardArtwork(row)}<div class="library-card-body"><h3>${row.title}</h3><p class="muted">${row.subject}</p><small class="muted">${row.updated ?? "Hoje"} · ${row.access ?? "Privado"}</small>${row.kind === "projects" ? `<div class="technology-preview">${projectStack(row)}</div>` : ""}<button data-feedback="Demonstração: o fluxo real preservará contexto, conteúdo e permissões.">Abrir ${row.kind === "notes" ? "nota" : row.kind === "projects" ? "projeto" : "documento"} →</button></div></article>`).join("")}</div>`;
}
const subjectNotes = [
  {
    title: "Anotações da aula 04",
    subject: "Programação Web",
    kind: "notes",
    icon: "TXT",
  },
  {
    title: "Estrutura e navegação",
    subject: "Programação Web",
    kind: "notes",
    icon: "TXT",
  },
  {
    title: "Revisão de acessibilidade",
    subject: "Programação Web",
    kind: "notes",
    icon: "TXT",
  },
];
function subjectResources(tab) {
  const subject = demoSubjects[currentSubjectIndex].name;
  if (tab === "Notas")
    return `<div class="panel-body"><p class="muted" style="margin-bottom:16px">Páginas do workspace associadas a esta disciplina. A associação será preservada.</p>${resourceCards(subjectNotes.map((row) => ({ ...row, subject })))}</div>`;
  const kind = tab === "Projetos" ? "projects" : "documents";
  const examples = rows
    .filter((row) => row.kind === kind)
    .slice(0, 2)
    .map((row) => ({ ...row, subject }));
  return `<div class="panel-body">${resourceCards(examples)}</div>`;
}
function notes() {
  return `<section class="workspace"><header class="page-heading"><div><p class="eyebrow">Notas / direção funcional planejada</p><h1>Notas</h1><p class="muted">Workspace de páginas e blocos, com associação opcional à disciplina.</p></div><button data-feedback="A criação e colaboração serão implementadas na etapa 5.">+ Nova página</button></header><div class="notes-proposal"><aside class="panel note-page-list"><h2>Páginas</h2>${subjectNotes.map((entry, i) => `<button data-note-page="${i}">${referenceIcon("IconNotes")} ${entry.title}</button>`).join("")}<small class="muted">Bases tabela/Kanban previstas, sem fórmulas ou relações avançadas.</small></aside><article class="panel note-proposal-editor"><small class="muted">Simulação visual · não salva nem colabora</small><label>Disciplina<select id="note-context"><option>Programação Web</option><option>Sem disciplina</option><option>Algoritmos</option></select></label><h2 id="note-preview-title">Anotações da aula 04</h2><p>Organizar o conteúdo de uma página ajuda na leitura e na navegação.</p><h3>Para a próxima prática</h3><ul><li>Separar estrutura, estilo e comportamento.</li><li>Conferir títulos e navegação por teclado.</li><li>Compartilhar somente com as pessoas escolhidas.</li></ul><p class="muted">Notas continua na navegação e na disciplina. A evolução para workspace não exige remover essas associações.</p></article></div></section>`;
}
const courses = [
  {
    id: "es",
    name: "Engenharia de Software",
    shortName: "ES",
    subjects: "3 disciplinas",
    students: "24 matrículas",
  },
  {
    id: "si",
    name: "Sistemas de Informação",
    shortName: "SI",
    subjects: "9 disciplinas",
    students: "8 matrículas",
  },
];
function institutionPortal(id) {
  const item = institutions.find((entry) => entry.id === id);
  if (!item) return;
  document.getElementById("admin-content").innerHTML =
    `<div class="institution-context"><button class="text-link" data-admin-section="Acadêmico">← Instituições</button><span class="muted">/ ${item.shortName}</span></div><header class="page-heading"><div><p class="eyebrow">Acadêmico / ${item.shortName}</p><h1>${item.name}</h1><p class="muted">Visão geral da instituição e seus cursos.</p></div><button data-feedback="Editar nome e sigla preserva os vínculos existentes.">Editar instituição</button></header><div class="admin-stats"><div class="stat"><strong>2026.2</strong><span>Período atual</span></div><div class="stat"><strong>${id === "university" ? 2 : 1}</strong><span>Cursos ativos</span></div><div class="stat"><strong>32</strong><span>Pessoas · exemplo</span></div><div class="stat"><strong>0</strong><span>Pendências · exemplo</span></div></div><section class="panel"><div class="panel-heading"><h2>Cursos da instituição</h2><button data-create-course data-course-context="${item.shortName}">+ Criar curso</button></div><div class="course-entry-grid">${courses
      .slice(0, id === "university" ? 2 : 1)
      .map(
        (course) =>
          `<article class="portal-card"><span class="eyebrow">${course.shortName}</span><h3>${course.name}</h3><p class="muted">${course.subjects} · ${course.students}</p><button data-course="${course.id}" data-institution-context="${id}">Administrar curso →</button></article>`,
      )
      .join(
        "",
      )}</div></section><section class="panel" style="margin-top:16px"><div class="panel-heading"><h2>Eventos da instituição</h2><button data-feedback="Evento institucional tem data, público e duração definidos.">+ Adicionar evento</button></div><div class="panel-body"><p class="muted">Nenhum evento institucional nesta amostra. Eventos de curso ficam no painel do curso.</p></div></section>`;
}
function coursePortal(institutionId, courseId) {
  const institution = institutions.find((entry) => entry.id === institutionId),
    course = courses.find((entry) => entry.id === courseId);
  if (!institution || !course) return;
  document.getElementById("admin-content").innerHTML =
    `<div class="institution-context"><button class="text-link" data-institution="${institutionId}">← ${institution.shortName}</button><span class="muted">/ ${course.shortName}</span></div><header class="page-heading"><div><p class="eyebrow">Acadêmico / ${institution.shortName} / ${course.shortName}</p><h1>${course.name}</h1><p class="muted">Período, disciplinas e horários no contexto do curso.</p></div><button data-feedback="Edição mantém nome e sigla e mostra o impacto nos vínculos.">Editar curso</button></header><div class="admin-stats"><div class="stat"><strong>2026.2</strong><span>Período atual</span></div><div class="stat"><strong>3</strong><span>Disciplinas · exemplo</span></div><div class="stat"><strong>24</strong><span>Matrículas · exemplo</span></div><div class="stat"><strong>1</strong><span>Evento · exemplo</span></div></div><div class="portal-grid"><section class="panel"><div class="panel-heading"><h2>Períodos e turmas</h2></div><div class="panel-body"><strong>2026.2 · turma manhã</strong><p class="muted">Período ativo, com histórico preservado.</p><button data-feedback="Gerenciar períodos e turmas mantém o contexto deste curso.">Gerenciar</button></div></section><section class="panel"><div class="panel-heading"><h2>Horários e eventos</h2></div><div class="panel-body"><p>Programação Web · ter/qui, 11:00–12:15</p><p class="muted">Aula excepcional · sábado, 17 out.</p><button data-feedback="Editar a grade e eventos sem trocar de curso.">Gerenciar</button></div></section></div><section class="panel" style="margin-top:16px"><div class="panel-heading"><h2>Disciplinas e ofertas</h2><button data-feedback="Cadastro segue o modelo acadêmico canônico.">+ Adicionar disciplina</button></div>${demoSubjects.map((entry) => `<details class="academic-detail"><summary><strong>${entry.code} · ${entry.name}</strong><small class="muted">${entry.teacher}</small></summary><div class="panel-body"><p>${entry.when} · Sala A204</p><p class="muted">A capa fica nas configurações da disciplina, junto ao nome e contexto.</p><button data-feedback="Configuração da disciplina: nome, oferta e capa; envio e remoção de capa apenas Admin.">Editar disciplina e capa</button></div></details>`).join("")}</section>`;
}
function adminSectionOverview(name) {
  const intro = {
    "Pessoas e permissões":
      "Contas, vínculos e concessões visíveis, com contexto e ações próximas.",
    Integrações: "Situação dos serviços e ações necessárias na própria página.",
    Sistema:
      "Saúde, versão e configuração da instância sem navegar por cartões vazios.",
  };
  let body = "";
  if (name === "Pessoas e permissões")
    body = `<div class="admin-stats"><div class="stat"><strong>32</strong><span>Usuários · exemplo</span></div><div class="stat"><strong>3</strong><span>Gestores · exemplo</span></div><div class="stat"><strong>2</strong><span>Sem contexto · exemplo</span></div></div><section class="panel"><div class="panel-heading"><h2>Usuários e contexto</h2><button data-feedback="Criar usuário não exige Google; depois associar instituição/curso e matrícula.">+ Criar usuário</button></div><div class="task"><div><h3>Alex Lima</h3><p>UE / ES / 2026.2 · estudante</p></div><button data-feedback="Editar contexto, matrículas ou suspender com impacto explicado.">Gerenciar</button></div><div class="task"><div><h3>Beatriz Costa</h3><p>UE / ES · gestora acadêmica</p></div><button data-feedback="Concessões explícitas por instituição/curso, sem acesso a conteúdo privado.">Permissões</button></div></section><details class="panel secondary-config"><summary>Gestores, grupos e matrículas</summary><div class="panel-body"><p class="muted">Manter grants e matrículas, com escopo visível e revisão do impacto.</p></div></details>`;
  if (name === "Integrações")
    body = `<div class="portal-grid"><section class="panel"><div class="panel-heading"><h2>Google / Classroom</h2><span class="badge">Exemplo conectado</span></div><div class="panel-body"><p>Última verificação: hoje, 10:30</p><p class="muted">Conexão pessoal por usuário; falha temporária não significa revogação.</p><button data-feedback="Conferir conexões, incidents e mappings sem reconectar automaticamente.">Revisar conexões</button></div></section><section class="panel"><div class="panel-heading"><h2>Drive da instância</h2><span class="badge">Exemplo disponível</span></div><div class="panel-body"><p>Universidade Exemplo - OSH / ES / 2026.2</p><p class="muted">Projetos dentro da instituição; destino e permissões explícitos.</p><button data-feedback="Diagnóstico verifica a raiz antes de reparar; não cria outra silenciosamente.">Verificar pastas</button></div></section></div><details class="panel secondary-config"><summary>Sincronização e política de acesso</summary><div class="panel-body"><p class="muted">Agenda, storage owner e acesso pelo App ou Drive direto ficam num bloco de configuração, com impacto explicado.</p></div></details>`;
  if (name === "Sistema")
    body = `<section class="panel"><div class="panel-heading"><h2>Saúde e versão</h2><span class="badge">Dados fictícios</span></div><div class="service"><strong>App / Admin / realtime</strong><span>Disponíveis · exemplo</span></div><div class="service"><strong>Versão instalada</strong><span>2.0.1 · referência</span></div><div class="service"><strong>Backup</strong><span>Agenda não definida · exemplo</span></div></section><section class="panel secondary-config"><div class="panel-heading"><h2>Extras</h2></div><div class="panel-body feature-demo-flags">${["Exibir Extras", "Quadro Branco", "Joguinhos", "Snake", "2048", "Campo Minado", "Paciência", "Dominó"].map((label) => `<label><input type="checkbox" checked />${label}</label>`).join("")}<small class="muted">Só demonstração. A configuração final bloqueará também rotas/APIs.</small></div></section>${["Backup e recuperação", "Notificações em segundo plano", "Identidade e título ASCII — apenas Admin", "Auditoria administrativa"].map((label) => `<details class="panel secondary-config"><summary>${label}</summary><div class="panel-body"><p class="muted">Controles específicos permanecem na mesma página. O backend e as permissões serão preservados.</p></div></details>`).join("")}`;
  return `<header class="page-heading"><div><p class="eyebrow">Control Plane</p><h1>${name}</h1><p class="muted">${intro[name]}</p></div></header>${body}`;
}
const reviewAreas = [
  [
    "Home",
    1,
    "ASCII, ícones, barra, lápis e personalização atuais",
    "Foco, sugestões sobrepostas, atalhos e enquadramento",
    "Prévia ajustada",
    "home",
  ],
  [
    "Hoje e horários",
    2,
    "Conteúdo atual e resumo compartilhado com a Home",
    "Grade no intervalo real, sala sem duplicação e fuso",
    "Amostra visual",
    "today",
  ],
  [
    "Disciplinas e atividades",
    2,
    "Cartões, capas, seis abas e botões atuais",
    "Abas coesas, lateral independente e atividades corretas",
    "Prévia parcial",
    "subjects",
  ],
  [
    "Notas",
    5,
    "Identidade das folhas e associação opcional à disciplina",
    "Workspace de blocos/páginas, grupos e colaboração",
    "Proposta visual",
    "notes",
  ],
  [
    "Documentos",
    4,
    "Folhas, modelos, participantes e ações aprovadas",
    "Destino e mapeamento, criação/importação claros",
    "Biblioteca demonstrada",
    "library",
  ],
  [
    "Projetos",
    4,
    "Capas, tecnologias, prévia e versões",
    "Criar/importar distintos, retomada e pastas corretas",
    "Biblioteca demonstrada",
    "library",
  ],
  [
    "Chat",
    6,
    "Conversas e compositor existentes",
    "Anexos, busca, edição entre clientes e compartilhamento",
    "Revisão de código; sem nova tela",
    null,
  ],
  [
    "Extras",
    6,
    "Quadro Excalidraw e cinco jogos",
    "Encaixe, controles, presença/salvamento e vitória",
    "Revisão de código; sem nova tela",
    null,
  ],
  [
    "Configurações e perfil",
    1,
    "Conta, foto e opções de aparência atuais",
    "Alinhamento, avatar e diagnóstico de notificações",
    "Revisão de código; sem nova tela",
    null,
  ],
  [
    "Google pessoal",
    7,
    "OAuth, mappings e conexão individual",
    "Estados claros, incidentes, destino e última verificação",
    "Revisão de código; sem nova tela",
    null,
  ],
  [
    "Admin acadêmico",
    3,
    "Dados e permissões existentes",
    "Instituição → curso → períodos/ofertas/horários",
    "Fluxo demonstrado",
    "admin",
  ],
  [
    "Pessoas e gestão",
    3,
    "Sessões e grants separados; privacidade",
    "Escopo, contexto, matrículas e remoção com impacto",
    "Resumo no Admin",
    "admin",
  ],
  [
    "Sistema, Drive e backup",
    7,
    "Controles da instância e acesso explícito",
    "Saúde na página, backup recuperável e operação após boot",
    "Resumo no Admin",
    "admin",
  ],
  [
    "Login, setup e onboarding",
    1,
    "Autenticação e etapas já existentes",
    "Botões estáveis, revisão de dados, erros junto aos campos",
    "Revisão de código; sem nova tela",
    null,
  ],
  [
    "Rotas legadas e extensão",
    8,
    "Links existentes e extensão de nova aba",
    "Compatibilidade e validação apenas após mudança relevante",
    "Revisão de código; sem nova tela",
    null,
  ],
];
function review() {
  return `<section class="workspace"><header class="page-heading"><div><p class="eyebrow">Revisão final da etapa zero</p><h1>O que fica e o que será ajustado</h1><p class="muted">Todas as famílias do inventário estão abaixo. Prévia visual não equivale a funcionalidade implementada.</p></div></header><section class="panel"><div class="panel-body"><strong>Referência de design: V2 aprovada</strong><p class="muted">Mesmos ícones, modelos de botão e organização das barras. Apenas Documentos/Projetos viram Biblioteca. Os demais ajustes seguem os pedidos registrados.</p></div></section><div class="review-area-grid">${reviewAreas.map(([name, stage, keep, change, status, route]) => `<article class="panel review-area"><div><small class="eyebrow">Etapa ${stage}</small><h2>${name}</h2></div><p><strong>Preservar:</strong> ${keep}.</p><p><strong>Ajustar:</strong> ${change}.</p><small class="muted">${status}</small>${route ? `<a class="text-link" href="#${route}">Conferir amostra →</a>` : "<small>Conferência visual do fluxo real na etapa responsável.</small>"}</article>`).join("")}</div><p class="admin-note">48 rotas inventariadas em código, agrupadas por família. Não foram 48 percursos completos em navegador. Nenhuma mudança foi aplicada no servidor.</p></section>`;
}
function renderAsciiStyle() {
  const wordmark = document.querySelector(".home-wordmark");
  if (!wordmark) return;
  const font = document.getElementById("demo-ascii-style").value;
  const logo = window.previewReferences.logos[font];
  if (!logo) return;
  const full = wordmark.querySelector(".ascii-large"),
    compact = wordmark.querySelector(".ascii-small");
  full.textContent = logo.full;
  compact.textContent = logo.compact;
  const columns = Math.max(...logo.full.split("\n").map((line) => line.length));
  const size = Math.min(
    14,
    Math.floor((wordmark.clientWidth - 8) / (columns * 0.61)),
  );
  full.style.display = size >= 10 ? "inline-block" : "none";
  compact.style.display = size >= 10 ? "none" : "inline-block";
  full.style.fontSize = `${Math.max(10, size)}px`;
  const compactColumns = Math.max(
    ...logo.compact.split("\n").map((line) => line.length),
  );
  compact.style.fontSize = `${Math.min(18, Math.max(10, Math.floor((wordmark.clientWidth - 8) / (compactColumns * 0.61))))}px`;
}

function render() {
  document.getElementById("home-customize-dialog").close();
  const screen = [
    "home",
    "today",
    "subjects",
    "subject",
    "notes",
    "library",
    "admin",
    "review",
  ].includes(window.location.hash.slice(1))
    ? window.location.hash.slice(1)
    : "home";
  screenSelect.value = screen;
  document.querySelector(".identity-name").textContent =
    screen === "admin" ? "Admin local" : "Alex Lima";
  document.querySelector(".avatar").textContent =
    screen === "admin" ? "AD" : "AL";
  content.innerHTML = {
    home,
    today,
    subjects: subjectCards,
    subject,
    notes,
    library,
    admin,
    review,
  }[screen]();
  document.querySelectorAll("[data-nav]").forEach((link) => {
    if (
      link.dataset.nav === screen ||
      (screen === "subject" && link.dataset.nav === "subjects")
    )
      link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.getElementById("primary-nav").hidden = screen === "admin";
  document.querySelectorAll(".identity button").forEach((button) => {
    button.hidden = screen === "admin";
  });
  if (screen === "home") renderAsciiStyle();
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
      `${previewLink.dataset.previewOnly} continua uma área própria. Veja o mapa da revisão completa para o escopo desta área; não houve remoção de funcionalidade.`,
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
  if (target?.hasAttribute("data-open-subject")) {
    currentSubjectIndex = Number(target.dataset.openSubject);
    window.location.hash = "subject";
  }
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
  if (target?.dataset.course)
    coursePortal(target.dataset.institutionContext, target.dataset.course);
  if (target?.dataset.notePage)
    document.getElementById("note-preview-title").textContent =
      subjectNotes[Number(target.dataset.notePage)].title;
  if (target?.hasAttribute("data-toggle-shortcut")) {
    target.textContent =
      target.textContent === "Ocultar" ? "Mostrar" : "Ocultar";
  }
  if (target?.hasAttribute("data-hide-today"))
    target.closest(".home-today").hidden = true;
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
      : ["Notas", "Documentos", "Projetos"].includes(tab)
        ? subjectResources(tab)
        : `<div class="panel-body"><h3>Atividades desta disciplina</h3><p class="muted">Manter Classroom e atividade manual, com estados e prazos corretos.</p><div class="task"><div><h3>Protótipo de uma página acadêmica</h3><p>Entrega: 20 out. · a fazer</p></div><button data-feedback="Abre a atividade autorizada sem perder contexto.">Ver atividade →</button></div></div>`;
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
  .addEventListener("change", renderAsciiStyle);
document.querySelectorAll("[data-icon]").forEach((element) => {
  element.innerHTML = referenceIcon(element.dataset.icon);
});
new ResizeObserver(renderAsciiStyle).observe(viewport);
