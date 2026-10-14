# Ajustes da revisão — 14/10/2026

Complementos solicitados durante a Etapa 2. São ajustes selecionados nas famílias das etapas 1, 4, 6 e 7; não significam que essas etapas inteiras estão concluídas.

## Implementado

- Catálogo de atalhos com 25 ícones. Decodificação de ICO com frames PNG/DIB comuns, limites de dimensões e fallback. Imagem com referência de cache por arquivo; uma falha antiga não impede carregar o ícone substituído.
- Grade com marcas a cada 30 minutos, limite final correspondente à aula, controles separados para dias com aulas/semana completa e detalhes acessíveis no celular. Rodapé mantém navegação à esquerda e utilidades à direita.
- Histórico de disciplinas com seta compacta, nome acessível e estado selecionado. A seção usa “Outros períodos” para não classificar períodos futuros como passados.
- Documentos locais próprios/compartilhados entram na coleção da disciplina. Projetos associados usam os vínculos explícitos do modelo acadêmico.
- Mural filtra avisos, atividades e materiais. Descrição e links dos anexos aparecem no App; nenhuma permissão do Drive é ampliada ao mostrar uma referência.
- Projetos podem ser compartilhados para leitura no App, sem depender de compartilhamento no Drive. Proprietário controla destinatários e revoga acesso. Backend nega escrita, upload e arquivamento pelo destinatário; conta desativada perde acesso. Página do projeto reorganizada e criação de documento com sequência visual curta.
- Configurações com navegação lateral em telas largas e navegação adaptada em telas menores, conservando as seções e ações.
- Edição de mensagem dentro da conversa, texto atual preenchido, cancelar/salvar, vazio bloqueado, indicação de edição e recuperação de erro. Envio próprio força rolagem para a mensagem enviada.

## Evidência no navegador

- Ícone do Drive: salvar “Ícone do site” produziu imagem carregada; recarregar a página manteve a imagem.
- Documento TXT e projeto fictícios associados apareceram na disciplina. Conteúdo pessoal sem associação permaneceu na Biblioteca.
- Material e anexos sintéticos apareceram no mural; filtro “Materiais” funcionou.
- Compartilhar com Estudante B mostrou exatamente um projeto em “Compartilhados comigo”. Tela foi somente de leitura; após revogar, acesso direto retornou 404.
- Mensagem editada dentro do chat, edição vazia bloqueada, badge “editada” presente. Após rolar ao topo e enviar mensagem própria, distância final do fim da lista: zero.
- Sem overflow horizontal da página em 1280, 800 e 390 pixels. Navegação compacta em 800; seletor mobile e diálogo de aula acessíveis em 390.
- Configurações → Personalização/Ajuda e Biblioteca → Criar documento permaneceram acessíveis e com conteúdo correto.

Drive/OAuth e criação de Google Docs reais não foram executados: a prévia não contém credenciais Google. O teste do favicon usa somente recurso público do site, não uma conexão Google autenticada. A referência de materiais é sintética e não representa uma aula real.
