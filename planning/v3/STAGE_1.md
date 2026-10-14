# Etapa 1 — Home e organização visual

**Estado:** implementação local concluída; QA visual disponível. Sem implantação em produção ou publicação. A versão de runtime continua 2.0.1 durante a preparação V3.

## O que foi aplicado

- Acabamento Material da V2 preservado: tokens, cores, ícones, componentes, barra superior e controles. Legacy/TUI mantém sua identidade. As prévias orientam a organização; não substituem os componentes reais por uma página de demonstração.
- Shell calcula uma linha própria para o aviso Google; conteúdo, relógio e lápis não usam posições que desconsiderem essa linha ou a navegação clássica.
- Home pronta para digitar no desktop, seleção do texto ao retornar e atalho `/`; não abrir o teclado automaticamente no celular nem roubar foco de formulários/janelas.
- Lápis e lateral conservam fundo, presets, imagens pessoais, atalhos, Ocultar/Mostrar, relógio/posição, Hoje e buscador. Fonte ASCII pessoal com as nove fontes existentes; texto da marca continua exclusivo do Admin. Enquadramento com posição horizontal/vertical e preencher/mostrar imagem inteira.
- Atalhos com drag no modo de edição, controle para toque, setas preservadas e `⋯` próximo para editar, ocultar ou remover com confirmação. Ordenação usa a validação de posse já existente.
- Avatar redondo/quadrado/padrão como preferência deste navegador, sem mudar a identidade da conta.
- Botões de onboarding/setup em colunas estáveis: Voltar à esquerda, Continuar/finalização à direita.
- Biblioteca na navegação principal, com Documentos e Projetos separados. Organização aprovada: ações distintas de criar/importar, lateral Todos/Meus conteúdos/Compartilhados, filtros por nome e disciplina, lista/grade e modelos. Cartões de folha/capa/tecnologias e ações de compartilhamento existentes preservados. Dados carregados pelas funções atuais de posse/compartilhamento; nenhum acesso novo concedido pela interface.
- Projetos: entradas explícitas para começar vazio ou importar. O registro ainda é criado antes da seleção da pasta/ZIP, conforme o fluxo atual; não é um novo pipeline de upload. URLs antigas conservam as duas escolhas.
- Hoje: mesmos dados e destaques, navegação entre seções, painéis organizados em duas colunas no desktop e uma no celular. Grade sem a hora artificial extra de cada lado; limites arredondados à hora que contém as aulas. Sem uma grade vazia de dez horas quando não há aulas. Rótulos e cartões seguem a mesma escala, com margem nos extremos para evitar corte e desalinhamento com zoom.
- Instrumentation: módulos nativos de banco isolados na entrada Node para permitir o QA Next/webpack. O registro das automações Google conserva o comportamento anterior.

## Autocomplete real, opcional

Usa o endpoint oficial [Brave Autosuggest](https://api-dashboard.search.brave.com/documentation/services/suggest), desativado por padrão. Configure `HOME_AUTOCOMPLETE_BRAVE_API_KEY` somente no ambiente do App e do Admin; habilite no Control Plane → Sistema. O mecanismo final da busca continua Google/Scholar/DuckDuckGo/Startpage/Ecosia, conforme a escolha pessoal.

A lista sobrepõe o conteúdo, com setas, Enter, Esc e fechamento fora. Texto digitado vai ao provedor apenas se o serviço estiver configurado e habilitado. Sem chave/serviço, a busca continua normal, sem sugestões locais substitutas. Não há histórico de pesquisas persistido. Endpoint exige sessão e mesma origem, orçamento de requisições/corpo e resposta limitada; falhas não expõem chave ou conteúdo.

## Validação realizada

- 34 testes dirigidos passaram na conferência final: migração/preferências pessoais, serviço e autorização do autocomplete, provedores de busca, ordenação/posse de atalhos, Biblioteca/filtros/acesso, escolhas de criar/importar projeto, escala da grade/destaques e permissão de documentos locais. O teste existente de ASCII passou anteriormente nesta mesma implementação; seu componente não foi reescrito.
- Typecheck: PASS. Lint dos arquivos TypeScript alterados: PASS. Formatação e verificação de diff: PASS.
- Smoke no App real com dados fictícios: salvar/recarregar fonte/enquadramento, reordenar por seta, editar atalho, avatar, Biblioteca Documentos/Projetos, compartilhados e lista, onboarding e controles Admin do autocomplete.
- Material superior e Legacy clássico observados; Home/lateral/Hoje/Biblioteca sem vazamento horizontal em largura CSS de 390 px. Rótulos da grade medidos com zoom: centro do horário coincide com o ponto da escala; cartão começa na mesma coordenada.
- Sem full suite, build completo, Google real ou alteração da instalação ZimaOS.

## Acesso para conferir

- App: `http://127.0.0.1:3090/`
- Biblioteca: `http://127.0.0.1:3090/library`
- Hoje: `http://127.0.0.1:3090/today`
- Admin: `http://127.0.0.1:3091/control`
- Contas fictícias: `student.a.fake`, `student.b.fake`, `admin.fake`; senha `QA-V3-Somente-2026`.
- Credenciais e bancos privados: diretório de runtime irmão do checkout, `runtime/stage1-qa/`. Não entram no Git.

Bancos existentes preservados. Foram acrescentados três TXT fictícios para conferir cartões/filtros; um compartilhado de B para A. A conta B tem um incidente Google **sintético, sem token**, para verificar o encaixe do aviso. Não corresponde a uma autorização Google real. Serviços locais estão ativos durante esta sessão; não foram habilitados para iniciar com o computador.

## QA humano curto e limites

1. Home: começar a digitar, retornar à aba, abrir o lápis, salvar aparência e arrastar um atalho; conferir também zoom/tela da faculdade.
2. Biblioteca: alternar tipo, filtros, Meus/Compartilhados e lista/grade; abrir modelos e conferir que criar/importar são escolhas distintas.
3. Hoje: conferir a grade, horários e painéis nos dois temas e no zoom usado normalmente.

Autocomplete vivo depende da chave do provedor; testes usam respostas controladas, sem exibi-las como sugestões reais. Arrastar com mouse/toque permanece conferência humana; gravação por seta e autorização foram verificadas. O corte preto original em Configurações não foi reproduzido no navegador do usuário após a correção do shell; mantém acompanhamento A20. Setup inicial será conferido no checkpoint de instalação, sem refazer credenciais apenas para avaliar CSS.

O editor de Notas, Admin contextual, consolidação acadêmica V2/legado, Drive e novos compartilhamentos de Projects permanecem nas etapas próprias. Projetos ainda só listam conteúdos do dono; a seleção Compartilhados não inventa suporte inexistente. Nenhuma etapa seguinte foi iniciada.
