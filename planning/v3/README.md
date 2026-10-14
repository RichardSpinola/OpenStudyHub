# OpenStudyHub V3 — acompanhamento

## Objetivo

Consolidar as correções pós-V2 no mesmo projeto público, melhorar os fluxos e oferecer uma base estável para novas funcionalidades. Este diretório acompanha o desenvolvimento; não faz parte da navegação pública do MkDocs.

## Decisões confirmadas

- Material e Legacy/TUI com os mesmos recursos; navegação superior e clássica preservadas. Reaproveitar o layout e os componentes originais onde já funcionam bem; as quatro prévias exploram organização, não são uma substituição obrigatória de toda a interface.
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

| Etapa | Entrega                                                                                 | Estado                                             |
| ----- | --------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 0     | Base consolidada, revisão do produto, cobertura dos pedidos e prévias de direção visual | Preparação concluída; proposta visual em avaliação |
| 1     | Estrutura visual, Home, responsividade, atalhos, busca, wallpaper e setup               | Planejada                                          |
| 2     | Modelo acadêmico consistente, importador, Classroom, fuso e horários                    | Planejada                                          |
| 3     | Admin, usuários/gestores, remoção segura, eventos e modo de prova                       | Planejada                                          |
| 4     | Drive, bibliotecas, modelos, Documentos e Projects recuperáveis/local                   | Planejada                                          |
| 5     | Notas: workspace, colaboração e bases simples                                           | Planejada                                          |
| 6     | Chat, Quadro e cinco jogos                                                              | Planejada                                          |
| 7     | Backup, recuperação, desempenho, diagnóstico, configurações e idioma                    | Planejada                                          |
| 8     | Checkpoint integrado, documentação, extensão e pacote distribuível                      | Planejada                                          |

## Trabalho e validação

Testes dirigidos e verificações proporcionais ao risco. Evitar full suite/build repetidos sem necessidade. Gate integrado nos checkpoints relevantes. QA humano em passos curtos, principalmente visual. Revisão de privacidade antes de cada commit. Implementação no código primeiro; atualização estável da instalação após backup e recuperação preparados.

## Etapa zero

- [BASELINE.md](BASELINE.md): origem do código e validações.
- [SCREENS.md](SCREENS.md): inventário completo das rotas de página e análise por família.
- [BACKLOG.md](BACKLOG.md): achados técnicos A01–A34 e pedidos de produto U01–U20, sem perder itens nos resumos.
- [Prévia interativa](preview/index.html): quatro telas fictícias, nos dois temas. É uma proposta de interface, não uma funcionalidade instalada.

Publicação, tag e atualização pública não foram realizadas nesta etapa. A versão de runtime continua 2.0.1 até uma entrega apropriada de versionamento; a branch V3 é uma preparação, não uma release pronta.
