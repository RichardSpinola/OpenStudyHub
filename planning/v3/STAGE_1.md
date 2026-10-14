# Etapa 1 — Home, organização e revisão dos fluxos

**Estado:** correções implementadas e validadas localmente; aguardando a conferência visual do usuário. A etapa foi reaberta após o primeiro commit `1ab8e22`. A Etapa 2 não começou. Runtime ainda identificado como versão 2.0.1; este checkout prepara a V3.

## O que foi preservado

Identidade Material da V2, tokens, cores, ícones, sombras, botões de ação e navegação superior/clássica. Legacy conserva bordas e tipografia de terminal. Marca **OpenStudyHub / instituição**, com título ASCII definido pelo Admin e fonte pessoal. Home mantém sua lateral, relógio, resumo Hoje, atalhos, wallpapers e buscadores.

A revisão altera a organização das telas reais. As prévias da Etapa 0 continuam apenas como referências de direção visual.

## Correções desta rodada

### Home

- Busca com foco no desktop, seleção ao retornar à aba e atalho `/`; sem abrir teclado automaticamente no celular nem roubar foco de formulários.
- Lápis arrastável dentro da área da Home, posição pessoal salva proporcionalmente à janela. Também aceita Alt + setas. Posição inicial evita o relógio inferior direito; pode ser ocultado/restaurado em Configurações → Personalização.
- Catálogo de 15 ícones no editor/criação rápida. Links conhecidos recebem o ícone correspondente; opção de favicon usa o pipeline seguro existente, com sigla como fallback.
- Arrasta e solta disponível sem abrir modo de edição, incluindo o próprio link. Setas e controle de toque preservados. `⋯` abre o editor sobreposto sem ficar atrás do ícone.
- Preset Grade corrigido. Enquadramento de imagens com prévia arrastável, guias e zoom, usando a geometria já existente do recorte de perfil. Preferências de imagem/fonte salvas automaticamente; removidos sliders X/Y e botão redundante de salvar aparência.
- Avatar redondo/quadrado/padrão continua preferência do navegador. Colunas de Voltar/Continuar do onboarding/setup preservadas.

### Hoje e disciplina

- Grade reimplementada com a mesma escala de cinco minutos para eixo, aulas e durações. Intervalo derivado das aulas, incluindo noite/domingo e sobreposição em colunas separadas. Poucas horas não são esticadas por toda a tela.
- Clique na aula abre diálogo na camada superior, com horário, professor, local e link para a disciplina; sem popover cortado pelo calendário.
- Removida a barra redundante Semana/Atividades/Mural/Eventos. Destaque ao lado da grade em telas largas; painéis alinhados, com superfícies consistentes e rolagem conforme o espaço/conteúdo. Telas pequenas usam seleção de dia.
- Seis abas da disciplina usam uma lateral comum de Ações e Aulas. Mural/Timeline continuam selecionáveis. Notas/Documentos/Projetos são coleções com contagem, sem repetir os botões de criação da lateral.
- Navegação direta no desktop, compacta em larguras intermediárias; menu Áreas reservado ao celular. Notificações sem vazamento horizontal, com botões que se adaptam à largura.

### Biblioteca e Projects

- Biblioteca em largura útil completa: Documentos/Projetos separados, lateral de acesso, filtros, lista/grade e prévias gráficas.
- Criar documento, importar arquivo, Modelos e editor de modelo ficam na mesma Biblioteca. Rotas antigas redirecionam para ela, conservando os parâmetros. Formulários, ações Google, mapeamento de campos e autorização existentes são reutilizados.
- Escolha de disciplina/modelo atualiza o contexto no mesmo fluxo. Criação/importação de modelos pessoais fica exposta diretamente. Estimativa “1–3 minutos” e link duplicado de Modelos removidos.
- `⋯` abre metadados, compartilhamento e remoção em diálogo. Expandir opções não muda a altura de nenhum cartão. Posse e permissões continuam verificadas no servidor.
- Projeto pessoal pode ser criado sem disciplina; associação acadêmica é opcional. Projetos acadêmicos continuam exigindo matrícula. Criação vazia e importação têm entradas diferentes.
- Migração incremental torna `projects.offering_id` opcional sem reconstruir a tabela nem apagar versões/arquivos. Sincronização pessoal usa `Pessoais / Pessoa-ID / Projetos` sob a raiz institucional. Isso não concede novas permissões nem compartilha projetos automaticamente.
- Opções/labels portáveis de Projects separados do código Node de validação/hash, corrigindo a importação indevida no navegador encontrada na compilação.

## Prévia e memória

A prévia anterior executava dois servidores Next de desenvolvimento. App chegou a consumir aproximadamente **2,4 GiB** e havia cerca de **800 MiB** disponíveis no notebook, com pressão de swap. Pausar os servidores liberou aproximadamente **3,8 GiB** disponíveis naquele momento.

A prévia atual usa uma construção otimizada e processos `next start`, sem compilação de cada rota durante a navegação. Construção com um worker, heap de 1536 MiB e teto de 3 GiB. App/Admin têm limites de memória próprios. Na amostra final, App consumia cerca de 80 MiB, Admin 55 MiB e realtime 34 MiB (aproximadamente 169 MiB no conjunto); havia cerca de 4 GiB disponíveis no notebook. App teve pico de aproximadamente 120 MiB na passagem anterior por diversas telas. São configurações da prévia local; não representam benchmark de produção nem resolvem toda a otimização planejada para a Etapa 7.

## Validação

**42 testes dirigidos: PASS. Typecheck: PASS. Lint dos arquivos alterados: PASS. Compilação otimizada: PASS.**

Testes dirigidos cobrem migração/preferências, grade/colisões, ícones, ordenação/posse, Biblioteca/autorização, criação pessoal, arquivos e versões de Projects, permissões dos documentos locais e escolha dos modos de entrada. Typecheck, lint dos arquivos alterados, compilação da prévia e revisão do diff fazem parte desta rodada; nenhuma full suite/gate 10.2.

Migração de Projects usa o suporte oficial de SQLite para [ALTER COLUMN DROP NOT NULL](https://www.sqlite.org/lang_altertable.html), presente no SQLite 3.53.4 fornecido pela dependência fixada deste checkout. Bancos fictícios foram copiados antes da migração; `integrity_check: ok` e `foreign_key_check: []` nos dois bancos.

### Evidência visual

- App real: projeto pessoal criado sem disciplina; Biblioteca, criar documento e Modelos permanecem no mesmo shell; estimativa removida; cartões de documentos medidos com a mesma altura (370 px), opções sem overflow.
- Arraste com mouse confirmado pela área do cartão, texto e ícone do link, com gravação da ordem. Lápis movido com mouse e Alt + setas, posição recarregada e ocultação/restauração pelas configurações verificadas.
- Enquadramento com imagem fictícia, zoom e movimento, salvamento automático e leitura após recarregar. Nenhuma imagem/credencial real importada.
- Escala: primeiro cartão e 08:00 começam na mesma coordenada; marcas 08:00/09:00/10:00 separadas exatamente por 96 px. Clique na aula abre detalhes na camada superior.
- Cabeçalhos dos quatro painéis com 56 px e linhas de cartões alinhadas. Sem rolagem da página Hoje no exemplo de 1280×720; conteúdos maiores usam a rolagem da área disponível.
- Material superior e Legacy clássico conferidos. Em 800/960 px, Áreas oculto e destinos diretos, sem overflow no conteúdo/footer. Em 390 px, menu móvel, seleção de dia, notificações e Modelos sem vazamento horizontal; footer móvel reduzido de aproximadamente 104 para 55 px.
- Aba de notas da disciplina sem botão de criação duplicado; Ações e Aulas permanecem.
- Prévia otimizada teve pico de App de aproximadamente 120 MiB na primeira passagem por Home/Hoje/Biblioteca/Projects/Configurações, versus 2,4 GiB em desenvolvimento. Os valores são uma amostra local, sem Google real.

## Conferência curta do usuário

1. Home: digitar, mover o lápis, abrir a lateral, arrastar um atalho pelo ícone, conferir `⋯` e enquadramento de imagem.
2. Hoje: grade, detalhes da aula, painéis e navegação no tamanho/zoom usado normalmente.
3. Biblioteca: criar/importar/modelos no mesmo ambiente; abrir `⋯`; criar um projeto pessoal sem disciplina.
4. Disciplina: trocar as seis abas e conferir que Ações/Aulas permanecem.

App: `http://127.0.0.1:3090/` · Admin: `http://127.0.0.1:3091/control`.
Contas fictícias: `student.a.fake`, `student.b.fake`, `admin.fake`. Senha: `QA-V3-Somente-2026`.

Runtime, bancos, credenciais e cópias ficam fora do Git, em `runtime/stage1-qa/`, ao lado do checkout. Instituição fictícia identificada como IFA. Projeto pessoal e TXT de exemplo são dados locais de QA. A conta B tem um incidente Google sintético, sem token, para conferir o aviso. Serviços não foram habilitados para iniciar com o computador.

Telas desta revisão foram salvas nos artefatos locais `V3_ETAPA1_REVISAO_HOJE.png` e `V3_ETAPA1_REVISAO_BIBLIOTECA.png`, em `outputs/` da conversa. Não são assets do produto.

## Limites e próximas etapas

Autocomplete real opcional usa [Brave Autosuggest](https://api-dashboard.search.brave.com/documentation/services/suggest), desativado por padrão. Sem chave, busca normal continua funcionando; não são exibidas sugestões simuladas como reais. Endpoint conserva sessão, mesma origem e limites de requisição/resposta. Ativação fica no Control Plane → Sistema.

Google/Drive real não foi reautorizado nem testado nesta prévia. Testes de uploads usam respostas controladas. O editor de Notas, consolidação acadêmica V2/legado, Admin contextual, compartilhamento ampliado de Projects, backup e revisão completa de configurações/idioma continuam nas etapas próprias. O corte preto original em Configurações continua acompanhado no backlog A20; não foi reproduzido nesta rodada.

Nenhuma alteração no ZimaOS, push, tag ou publicação nesta etapa.
