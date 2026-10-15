# OpenStudyHub V3 — acompanhamento

## Objetivo

Consolidar as correções pós-V2 no mesmo projeto público, melhorar os fluxos e oferecer uma base estável para novas funcionalidades. Este diretório acompanha o desenvolvimento; não faz parte da navegação pública do MkDocs.

## Decisões confirmadas

- Material e Legacy/TUI com os mesmos recursos; navegação superior e clássica preservadas. Reaproveitar o layout e os componentes originais onde já funcionam bem; as prévias exploram organização, não são uma substituição obrigatória de toda a interface.
- **Material original preservado:** manter a identidade neutra e os componentes aprovados da V2; corrigir alinhamento, adaptação de largura e fluxos indicados. A recoloração verde e as formas novas da prévia foram rejeitadas. Legacy/TUI conserva os ajustes de terminal/monospace/bordas aprovados.
- Home conserva o lápis móvel/ocultável e a **barra lateral** original, com fundo, atalhos, relógio, resumo Hoje e buscador. Sugestões sobrepõem o conteúdo abaixo da busca, sem empurrar os widgets. Texto do título ASCII é exclusivo do Admin; estilo pessoal continua permitido. A visão geral da disciplina mantém Mural/Timeline selecionáveis e suas seis abas, realinhadas.
- Biblioteca substitui somente as entradas principais Documentos/Projetos, com duas abas e opções lista/grade. Criar/importar documento e projeto têm ações distintas; rotas existentes, dados, versões, modelos e permissões permanecem compatíveis.
- Capas de disciplinas: enviar, enquadrar e remover são ações exclusivas de Admin. O backend precisará negar também gestores com grants acadêmicos; não basta ocultar o botão.
- Acadêmico começa num portal de instituições: cartão da instituição → visão geral da instituição → curso → painel contextual de períodos/turmas, disciplinas/ofertas e horários/eventos. Pessoas/permissões, Integrações e Sistema continuam seções globais.
- Admin mostra resumos de pessoas/permissões, integrações e saúde/versão na própria página; controles secundários recolhíveis. Links/notificações do App não são copiados para o Admin. Capa fica nas configurações da disciplina.
- Home e Hoje usam os mesmos destaques; preservar o conteúdo/acabamento de Hoje, realinhando destaques e painéis e ajustando a grade pelo intervalo real. Fontes ASCII mantêm as nove opções do projeto; notas seguem associáveis à disciplina.
- Prévia gráfica de nota, folha de documento e capa de projeto conserva a identidade da V2; biblioteca permite grade/lista sem trocar os fluxos ou confundir os tipos.
- Configuração administrativa de Extras tem entrada própria no menu do Admin. Extras continua na navegação principal do App e mantém suas feature flags.
- **Produção pausada:** por instrução mais recente, manter mudanças locais e prévias. Não aplicar nada no servidor até nova instrução do usuário.
- Workspace de Notas com páginas, blocos, colaboração, bases tabela/Kanban e campos simples. Sem fórmulas/relacionamentos nesta entrega. Base proposta: BlockNote core + Yjs, com licença e créditos conservados; compatibilidade será verificada antes da adoção.
- Moderação do chat global e grupos institucionais. Conversas diretas privadas, com denúncia voluntária.
- Drive acadêmico compartilhado e área Pessoais separada sob demanda. Destino e acesso explícitos; nenhuma abertura automática de todos os arquivos aos matriculados.
- Admin escolhe acesso pelo App ou compartilhamento direto no Drive. Cada conta conecta o próprio Google para Classroom.
- Backup completo dos dados geridos pelo Hub, criptografado, com chave de recuperação. Arquivos externos sem acesso continuam como referências, declaradas no manifesto.
- Remover curso do catálogo preservando trabalhos/histórico; exclusão definitiva apenas após resolver vínculos.
- Provas por turma/curso bloqueiam Chat, Notas, Documentos, Projetos e Extras no servidor. Busca e atalhos da Home permanecem disponíveis.
- Autocomplete real por API configurável no Admin, inicialmente Brave; opcional, mantendo o buscador final escolhido. Sem retorno disfarçado de sugestões locais.
- Confete breve e som opcional nas vitórias; som desligado por padrão, respeitando redução de movimento.
- GitHub no final. Commits locais por etapa concluída. A V3 pode receber novas entregas depois do checkpoint estrutural.

## Etapas

| Etapa | Entrega                                                                                    | Estado                                                     |
| ----- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| 0     | Base consolidada, revisão do produto, cobertura dos pedidos e prévias de direção visual    | Preparação concluída; revisão final disponível             |
| 1     | Estrutura visual, Home, Biblioteca/Hoje, responsividade, atalhos, busca, wallpaper e setup | Correções validadas localmente; revisão visual do usuário  |
| 2     | Modelo acadêmico consistente, importador, Classroom, fuso e horários                       | Concluída localmente; revisão visual                       |
| 3     | Admin, usuários/gestores, remoção segura, eventos e modo de prova                          | Revisada na etapa 4; teste local concluído                 |
| 4     | Drive, bibliotecas, modelos, Documentos e Projects recuperáveis/local                      | Implementada; 400 testes; limites da revisão em STAGE_4.md |
| 5     | Notas: workspace, colaboração e bases simples                                              | Planejada                                                  |
| 6     | Chat, Quadro e cinco jogos                                                                 | Planejada                                                  |
| 7     | Backup, recuperação, desempenho, diagnóstico, configurações e idioma                       | Planejada                                                  |
| 8     | Checkpoint integrado, documentação, extensão e pacote distribuível                         | Planejada                                                  |

## Trabalho e validação

Testes dirigidos e verificações proporcionais ao risco. Evitar full suite/build repetidos sem necessidade. Gate integrado nos checkpoints relevantes. QA humano em passos curtos, principalmente visual. Revisão de privacidade antes de cada commit. Implementação no código primeiro. Atualização da instalação está suspensa pela instrução mais recente; quando retomada, exige backup e recuperação preparados.

## Etapa 1

- [STAGE_1.md](STAGE_1.md): mudanças reais, validações e roteiro curto de QA.
- A correção solicitada durante a implementação aplica a organização da prévia a Biblioteca/Hoje, usando os componentes V2. Não apenas colocar duas páginas antigas sob novas abas.

## Etapa zero

- [BASELINE.md](BASELINE.md): origem do código e validações.
- [SCREENS.md](SCREENS.md): inventário completo das rotas de página e análise por família.
- [BACKLOG.md](BACKLOG.md): achados técnicos A01–A34 e pedidos de produto U01–U29, sem perder itens nos resumos.
- [Revisão final UX](FINAL_UX_REVIEW.md): elementos protegidos, cobertura real e percurso curto de avaliação.
- [Prévia interativa](preview/index.html): oito entradas fictícias e subfluxos do Admin, nos dois temas. Inclui mapa de todas as famílias; não simula todos os estados das 48 rotas e não é uma funcionalidade instalada.

Publicação, tag e atualização pública não foram realizadas nesta etapa. A versão de runtime continua 2.0.1 até uma entrega apropriada de versionamento; a branch V3 é uma preparação, não uma release pronta.

## Etapa 2

- [STAGE_2.md](STAGE_2.md): modelo acadêmico, importação, Classroom, calendário e teste de cadastro.
- [REVIEW_FIXES_2026_10_14.md](REVIEW_FIXES_2026_10_14.md): ajustes adicionais da revisão, incluindo ícones, materiais, compartilhamento de projetos e chat.

## Etapa 3

- [STAGE_3.md](STAGE_3.md): Admin, gestão, preservação do histórico, eventos, modo de prova e revisão dos ícones. Implementação e teste de uso local concluídos; relatório distingue o teste técnico inicial aprovado do reteste final bloqueado pela revisão automática e da conferência Google real futura.

## Etapa 4 e revisão adicional do Admin

- [STAGE_4.md](STAGE_4.md): projetos locais, uploads recuperáveis, documentos/modelos e revisão de todos os menus administrativos, incluindo primeiro acesso.
- A revisão da etapa 3 foi ampliada a pedido do usuário. Extras tem acesso próprio, capas têm ação visível, os cadastros básicos são agrupados e o setup inicial foi reorganizado.
- A prévia local ficou pausada em 15/10/2026 para liberar memória após o relato de travamento do notebook. Não reiniciar builds/testes pesados junto do navegador. Há três ajustes pequenos e o ciclo de arquivamento/restauração a retestar visualmente; a compilação e os testes automáticos passaram.
