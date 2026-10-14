# Etapa 2 — consistência acadêmica

Implementação e validação local concluídas. Revisão visual do usuário continua aberta. Publicação e servidor não fazem parte desta entrega.

## Código

- O modelo acadêmico canônico projeta metadados, ofertas, horários e matrículas para as ferramentas compatíveis com o legado. Identidades têm mapas explícitos; nunca se assume igualdade de IDs.
- Matrícula, retirada, reativação e arquivamento refletem o acesso. Conteúdo privado não é apagado. Revisão por contador evita reconstruir o espelho a cada leitura.
- Escritas transacionais por banco e registros duráveis de identidade permitem repetir a projeção depois de falha entre commits. Não se promete atomicidade entre dois bancos WAL.
- Classroom pessoal preserva descrição, prazo UTC, referências de materiais e estado de entrega. Tarefas V1 são adotadas pelo vínculo exato de usuário, oferta, curso e atividade; trocar o curso preserva o histórico anterior. “Devolvida” sem nota não é considerada concluída. Aplicação do cache revalida matrícula e associação; tarefas geram atividades do próprio usuário, sem mistura entre contas.
- Importação acadêmica tem prévia, fingerprint do conteúdo, revisão explícita, execução transacional e repetição segura. O modo suportado é atualizar o banco legado já associado à instalação, preservando notas, documentos, projetos e caminhos de arquivos nesse banco. Não é uma importação de todos os assets para uma instalação independente. Currículos/turmas textuais não são adivinhados; privilégios e conexões Google não são promovidos.
- Fuso configurável por instituição, datas reais e matemática de calendário independente do fuso do servidor. Prazos manuais usam hora local e rejeitam horários inexistentes.
- Erros de duplicação, referência e validação têm mensagens úteis. Rascunhos acadêmicos não secretos permanecem na aba após rejeição; senhas não são guardadas. O editor de horário valida datas e sobreposições antes de enviar para manter os blocos editados. Admin pode matricular usuários cadastrados sem exigir cohort; gestores mantêm a seleção por escopo.
- Alterar o nome do perfil atualiza também a identidade canônica, evitando que uma sincronização acadêmica restaure o nome anterior.
- Navegação clássica mantém áreas à esquerda e controles à direita. Grade preserva largura legível, dias com aulas/semana completa, marcas de meia hora e detalhes em diálogo.

## Validação final

95 testes direcionados em 19 arquivos passaram: projeção, importação, recuperação, autorização, isolamento institucional, Classroom, calendário, grade e destaques de Hoje. Typecheck e lint dos arquivos alterados passaram. Compilações locais passaram; o reteste no navegador confirmou as correções do editor de horário e da matrícula sem cohort.

Navegador: campo vazio e só espaços bloqueados; instituição válida criada; campo obrigatório de nome curto detectado; curso criado; código duplicado rejeitado com mensagem clara; datas invertidas rejeitadas. O teste identificou perda de preenchimento, que motivou a correção do rascunho.

Google real não conectado nesta prévia. Teste do adaptador usa respostas sintéticas, não comprova OAuth ou permissões de uma conta real. Nova senha não foi criada pelo navegador; criação/validação de usuário é coberta em testes backend.

## Revisão adicional

- [REVIEW_FIXES_2026_10_14.md](REVIEW_FIXES_2026_10_14.md): ajustes adicionais solicitados e testes reais na prévia.
- O teste de período confirmou campos preservados após rejeição e permitiu corrigir/salvar sem repetir o preenchimento. Cadastro de instituição, curso, disciplina, período e oferta realizado no navegador.
- A prévia foi copiada antes das alterações. Integridade dos dois bancos: `ok`; verificação de chaves estrangeiras: sem erros. Migrações já aplicadas não foram reescritas; correção complementar em 0026.

## Fechamento do teste de uso

- Admin criou instituição, curso, período, disciplina e oferta no navegador.
- Matrícula individual sem turma/cohort funcionou; disciplina apareceu no App. Repetição foi rejeitada, mantendo o preenchimento. Retirada marcou histórico sem apagar dados.
- Horário com fim anterior ao início foi rejeitado no editor, preservando o bloco. Correção para quarta-feira 10:00–11:30 foi salva.
- Períodos não atuais usam a seção “Outros períodos”, pois a lista também pode conter períodos futuros. O resumo do Admin mostra período de turma apenas quando há esse contexto.
- Integridade/FKs dos bancos de QA confirmadas. Prévia usa produção compilada; serviços limitados, sem servidores de desenvolvimento.
- A importação e sua repetição foram verificadas em bancos sintéticos. Não se executou importação sobre dados de produção.

Próxima etapa principal: 3 — Admin, usuários/gestores, remoção segura, eventos e modo de prova. Compartilhamento de projeto nesta revisão é para leitura; edição colaborativa não foi adicionada.

## Referências do Classroom

- [CourseWork: conteúdo, materiais e prazo](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWork).
- [StudentSubmission: estado e nota atribuída](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWork.studentSubmissions).

## Prévia entregue

- App: http://127.0.0.1:3090/today; Admin: http://127.0.0.1:3091/control.
- Compilação final concluída com sucesso. App, Admin e realtime consumiam aproximadamente 244 MiB somados após a abertura da prévia; é uma medição pontual, sem incluir o navegador.
- Evidência visual capturada após a compilação final. Nenhum dado, serviço ou configuração do ZimaOS foi alterado. Nenhum push ou publicação foi realizado.
