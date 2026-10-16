export const PRODUCT_TOUR_EDITION = 1;
export type TourMode = "full" | "news";
export type TourStatus = "active" | "paused" | "dismissed" | "completed";
export type TourStep = {
  id: string;
  path: string;
  target: string;
  title: string;
  titleEn: string;
  body: string;
  bodyEn: string;
  news?: boolean;
  feature?:
    "projects" | "extras" | "whiteboard" | "games" | "focus" | "flashcards";
};
export const tourSteps: TourStep[] = [
  {
    id: "home",
    path: "/",
    target: "home",
    title: "Seu ponto de partida",
    titleEn: "Your starting point",
    body: "A Home reúne sua busca, seus atalhos e um resumo do dia. Você pode voltar aqui pelo menu principal.",
    bodyEn:
      "Home brings together search, shortcuts and your daily overview. Return here from the main navigation.",
  },
  {
    id: "search",
    path: "/",
    target: "home-search",
    title: "Pesquise na web",
    titleEn: "Search the web",
    body: "Digite o que procura e pressione Enter. O provedor escolhido abre os resultados na web; esta busca não procura dentro dos seus arquivos do Hub.",
    bodyEn:
      "Type a query and press Enter. Your selected provider opens web results; this does not search your Hub files.",
  },
  {
    id: "shortcuts",
    path: "/",
    target: "home-shortcuts",
    title: "Seus links por perto",
    titleEn: "Keep useful links close",
    body: "Abra seus sites favoritos pelos atalhos. Fora do tour, use os três pontos para editar e arraste para reorganizar quando essa opção estiver ativada.",
    bodyEn:
      "Open your useful sites from shortcuts. Outside the tour, use the three dots to edit and drag to reorder when enabled.",
  },
  {
    id: "today",
    path: "/today",
    target: "today-schedule",
    title: "Veja sua semana",
    titleEn: "See your week",
    body: "Os horários vêm das suas disciplinas. Aqui você também acompanha eventos, avisos e prazos. Se ainda não houver aulas, elas aparecerão depois que sua matrícula e os horários forem configurados.",
    bodyEn:
      "Class times come from your subjects. You can also follow events, notices and deadlines. If there are no classes yet, they appear after enrollment and schedules are configured.",
    news: true,
  },
  {
    id: "tasks",
    path: "/today",
    target: "personal-tasks",
    title: "Planeje seus próximos passos",
    titleEn: "Plan your next steps",
    body: "Em Minhas tarefas, anote o que quer estudar e marque quando concluir. Prazo e disciplina são opcionais. Sua lista é privada e não envia nem conclui atividades do Classroom.",
    bodyEn:
      "Use My tasks to plan what to study and mark it complete. Deadline and subject are optional. This list is private and does not submit or complete Classroom assignments.",
    news: true,
  },
  {
    id: "calendar",
    path: "/today",
    target: "calendar-export",
    title: "Leve sua agenda com você",
    titleEn: "Take your schedule with you",
    body: "Exportar agenda baixa um arquivo para importar no seu calendário. Escolha o período e os conteúdos. Quando algo mudar, será preciso exportar novamente.",
    bodyEn:
      "Export calendar downloads a file to import into your calendar. Choose dates and categories. Export again when the schedule changes.",
    news: true,
  },
  {
    id: "subjects",
    path: "/subjects",
    target: "subjects",
    title: "Encontre suas disciplinas",
    titleEn: "Find your subjects",
    body: "Suas disciplinas ficam organizadas por período. Ao abrir uma delas, você encontra o mural, atividades, materiais e os conteúdos associados. Períodos anteriores continuam acessíveis quando disponíveis.",
    bodyEn:
      "Subjects are organized by term. Open one to find its feed, assignments, materials and linked content. Previous terms remain accessible when available.",
  },
  {
    id: "subject",
    path: "/subjects",
    target: "subject-workspace",
    title: "Tudo no contexto da disciplina",
    titleEn: "Everything in the subject context",
    body: "As abas mudam o conteúdo principal sem perder o contexto. Consulte materiais e atividades, ou veja as notas, documentos e projetos ligados a esta disciplina.",
    bodyEn:
      "Tabs change the main content while keeping the subject context. Browse materials and assignments, or see linked notes, documents and projects.",
  },
  {
    id: "notes",
    path: "/notes",
    target: "notes",
    title: "Um espaço para suas ideias",
    titleEn: "A place for your ideas",
    body: "Crie páginas e subpáginas, escreva por blocos, adicione imagens e organize bases em tabela ou quadro. Notas começam privadas; você escolhe com quem compartilhar e se a pessoa pode editar.",
    bodyEn:
      "Create pages and subpages, write in blocks, add images and organize databases as tables or boards. Notes start private; choose who can access or edit them.",
    news: true,
  },
  {
    id: "documents",
    path: "/library?type=documents",
    target: "library",
    title: "Documentos em uma biblioteca",
    titleEn: "Documents in one library",
    body: "Aqui você cria documentos, importa arquivos e usa modelos. Os filtros separam seus conteúdos dos compartilhados. Arquivos locais funcionam sem Google; recursos do Drive dependem da conexão da instância.",
    bodyEn:
      "Create documents, import files and use templates here. Filters separate your content from shared items. Local files work without Google; Drive features depend on the instance connection.",
    news: true,
  },
  {
    id: "projects",
    path: "/library?type=projects",
    target: "library",
    title: "Organize trabalhos e versões",
    titleEn: "Organize projects and versions",
    body: "Projetos guardam arquivos e versões dos seus trabalhos. Você pode criar um projeto pessoal ou associá-lo a uma disciplina, conferir mudanças e escolher com quem compartilhar.",
    bodyEn:
      "Projects keep your work files and versions together. Create a personal project or link it to a subject, review changes and choose who to share with.",
    news: true,
    feature: "projects",
  },
  {
    id: "chat",
    path: "/chat",
    target: "chat",
    title: "Converse com sua comunidade",
    titleEn: "Talk with your community",
    body: "Use as conversas disponíveis ou inicie uma conversa. Você pode responder, mencionar pessoas e anexar imagens ou arquivos. Enter envia; Shift+Enter quebra a linha. Ao subir no histórico, a seta volta às últimas mensagens.",
    bodyEn:
      "Use available conversations or start one. Reply, mention people and attach images or files. Enter sends; Shift+Enter adds a line. When browsing history, the arrow returns to the latest messages.",
    news: true,
  },
  {
    id: "extras",
    path: "/extras",
    target: "extras",
    title: "Ferramentas para sua rotina",
    titleEn: "Tools for your routine",
    body: "Extras reúne as ferramentas habilitadas pelo administrador. Cada cartão abre seu espaço de trabalho. Se um recurso não estiver disponível, ele não aparece neste percurso.",
    bodyEn:
      "Extras brings together tools enabled by your administrator. Each card opens its workspace. Unavailable features do not appear in this tour.",
    feature: "extras",
  },
  {
    id: "whiteboard",
    path: "/extras",
    target: "extra-whiteboard",
    title: "Pense junto no quadro",
    titleEn: "Think together on the board",
    body: "O Quadro Branco oferece um espaço compartilhado para desenhar e organizar ideias. Abra o cartão quando quiser experimentar; o tour não altera o quadro.",
    bodyEn:
      "The whiteboard is a shared space for sketching and organizing ideas. Open its card to try it later; this tour does not change the board.",
    feature: "whiteboard",
  },
  {
    id: "focus",
    path: "/extras",
    target: "extra-focus",
    title: "Estude no seu ritmo",
    titleEn: "Study at your own pace",
    body: "Use Pomodoro ou cronômetro para separar estudo e pausa. O botão de foco na navegação ajuda a acompanhar a sessão enquanto você usa outras áreas.",
    bodyEn:
      "Use Pomodoro or a stopwatch to separate study and breaks. The focus button in navigation keeps your session accessible in other areas.",
    news: true,
    feature: "focus",
  },
  {
    id: "flashcards",
    path: "/extras",
    target: "extra-flashcards",
    title: "Revise com cartões",
    titleEn: "Review with cards",
    body: "Crie conjuntos de perguntas e respostas, revise os cartões e compartilhe conjuntos quando quiser. Seus estudos não dependem da integração Google.",
    bodyEn:
      "Create question-and-answer decks, review cards and share decks when you choose. Your study does not depend on Google integration.",
    news: true,
    feature: "flashcards",
  },
  {
    id: "games",
    path: "/extras",
    target: "extra-games",
    title: "Faça uma pausa",
    titleEn: "Take a break",
    body: "Abra os jogos habilitados para uma pausa. O som de vitória é opcional em Aparência; as preferências de movimento também valem aqui.",
    bodyEn:
      "Open enabled games for a break. Victory sound is optional in Appearance; motion preferences apply here too.",
    feature: "games",
  },
  {
    id: "settings",
    path: "/settings",
    target: "settings",
    title: "Deixe o espaço do seu jeito",
    titleEn: "Make the space yours",
    body: "Os cartões agrupam perfil, aparência, Home, notificações, integrações e acessibilidade. Entre em uma área para ajustar suas preferências; opções simples mostram quando foram salvas.",
    bodyEn:
      "Cards group profile, appearance, Home, notifications, integrations and accessibility. Open a section to adjust preferences; simple options show when they have saved.",
    news: true,
  },
  {
    id: "appearance",
    path: "/settings?section=personalization",
    target: "appearance-controls",
    title: "Escolha como prefere ver",
    titleEn: "Choose your look",
    body: "Escolha tema, cores e navegação. Se quiser, use sua imagem da Home com desfoque nas áreas compatíveis. Você pode desligar os efeitos e reduzir movimento a qualquer momento.",
    bodyEn:
      "Choose theme, colors and navigation. Optionally use your Home image blurred in compatible areas. Turn effects off or reduce motion at any time.",
    news: true,
  },
  {
    id: "profile",
    path: "/settings?section=profile",
    target: "settings-section",
    title: "Cuide do seu perfil",
    titleEn: "Manage your profile",
    body: "Atualize nome, apresentação e imagens do perfil. Confira as opções de acesso e privacidade com calma; o tour não muda nenhuma delas.",
    bodyEn:
      "Update your name, introduction and profile images. Review access and privacy options at your own pace; this tour changes none of them.",
  },
  {
    id: "home-settings",
    path: "/settings?section=home",
    target: "settings-section",
    title: "Personalize sua Home",
    titleEn: "Customize your Home",
    body: "Escolha e enquadre seu fundo, organize os atalhos e ajuste relógio e buscador. O lápis da Home abre os controles de personalização; você pode movê-lo ou ocultá-lo.",
    bodyEn:
      "Choose and frame your background, organize shortcuts and set clock and search preferences. The Home pencil opens customization; move or hide it as you prefer.",
  },
  {
    id: "notifications",
    path: "/settings?section=notifications",
    target: "settings-section",
    title: "Escolha os avisos que quer receber",
    titleEn: "Choose the alerts you want",
    body: "Defina os avisos e preferências de conversas. A permissão deste dispositivo é uma escolha separada do navegador. Você não precisa ativá-la para continuar usando o Hub.",
    bodyEn:
      "Set alerts and conversation preferences. This device’s permission is a separate browser choice. You do not need to enable it to keep using Hub.",
  },
  {
    id: "google",
    path: "/settings?section=google",
    target: "settings-section",
    title: "Conecte serviços quando precisar",
    titleEn: "Connect services when needed",
    body: "Cada pessoa conecta o próprio Google para Classroom. O armazenamento central no Drive é configurado pelo administrador. As ferramentas locais continuam disponíveis sem essas conexões.",
    bodyEn:
      "Each person connects their own Google account for Classroom. Central Drive storage is configured by the administrator. Local tools remain available without those connections.",
  },
  {
    id: "accessibility",
    path: "/settings?section=accessibility",
    target: "settings-section",
    title: "Ajuste seu conforto de leitura",
    titleEn: "Set your reading comfort",
    body: "Escolha idioma, contraste e redução de movimento. Seus ajustes também são respeitados no tour e podem ser alterados depois.",
    bodyEn:
      "Choose language, contrast and reduced motion. Your choices also apply to the tour and can be changed later.",
  },
  {
    id: "credits",
    path: "/settings?section=about",
    target: "settings-section",
    title: "Saiba mais sobre o projeto",
    titleEn: "Learn about the project",
    body: "Veja a versão da instância, licença e créditos dos componentes que fazem parte do Hub.",
    bodyEn:
      "See the instance version, license and credits for the components used by Hub.",
  },
  {
    id: "help",
    path: "/settings?section=help",
    target: "tour-launcher",
    title: "Você pode voltar quando quiser",
    titleEn: "Come back whenever you like",
    body: "Conheça o Hub permite repetir este tour, continuar de onde parou ou conhecer apenas as novidades. Os outros guias da Ajuda também ficam disponíveis aqui.",
    bodyEn:
      "Discover Hub lets you repeat this tour, resume it or explore only the highlights. Other help guides remain available here too.",
  },
];
