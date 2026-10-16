# Agenda, tarefas pessoais e tour

## Minhas tarefas

Abra **Hoje → Minhas tarefas → Nova tarefa**. Preencha um título; descrição, prazo e disciplina são opcionais. Os horários usam o fuso acadêmico mostrado no formulário.

A lista é privada e funciona sem Google. Marcar uma tarefa como concluída não entrega nem conclui atividades do Classroom. Em **Ver todas**, você encontra tarefas com prazo, sem prazo e concluídas. Use o círculo para concluir/reabrir, o lápis para editar e a lixeira para excluir após confirmar. Há um limite de 1.000 tarefas por conta, incluindo concluídas.

O resumo em Hoje mostra até três pendências, priorizando prazos mais próximos e atrasados. Conteúdos vinculados a disciplinas indisponíveis não ganham acesso adicional por essa associação.

## Exportar agenda

Em **Hoje → Exportar agenda**, escolha as datas e os conteúdos: aulas, eventos acadêmicos, prazos do Classroom e tarefas pessoais com prazo. O período pode ter até um ano. Tarefas concluídas, atividades entregues e conteúdos sem acesso não são exportados.

Clique em **Baixar agenda** e importe o arquivo `.ics` no calendário de sua preferência. O arquivo é uma cópia daquele momento; alterações no Hub não atualizam o calendário externo. A forma de importar e tratar uma nova importação depende do aplicativo usado; identificadores dos compromissos são mantidos, mas nem todo calendário evita cópias repetidas.

Os horários são escritos em UTC, preservando o instante correspondente ao fuso acadêmico. Não há assinatura pública, conexão adicional ao Google, alarmes automáticos ou sincronização de volta. O arquivo segue o formato [iCalendar (RFC 5545)](https://www.rfc-editor.org/rfc/rfc5545.html).

## Conheça o Hub

O tour abre as páginas reais e destaca os elementos explicados. O percurso completo apresenta Home, Hoje, disciplinas, notas, Biblioteca, Chat, Extras e Configurações. **Conhecer as novidades** abre um percurso mais curto com recursos novos.

Contas novas recebem o convite depois do primeiro acesso. Contas existentes também recebem o convite desta edição, uma vez. Use **Voltar**, **Avançar**, **Pular esta parte** ou **Sair**. Ao sair, o progresso é guardado na conta. Para continuar, repetir ou escolher outro percurso, abra **Configurações → Ajuda → Conheça o Hub**.

O tour não envia mensagens, cria arquivos, solicita permissões ou altera preferências. Salve o que estiver editando antes de iniciá-lo, pois ele muda de página. Se não houver conteúdo, a explicação apresenta a área vazia; ferramentas desativadas ou sem acesso ficam fora do percurso. No modo de prova o tour não inicia, e tarefas/exportação ficam indisponíveis.

O progresso tem revisão por conta: se outra aba atualizou o tour, você escolhe continuar ou reiniciar sem sobrescrever silenciosamente o estado mais recente. Se a conexão falhar, aparece uma mensagem para tentar novamente.

## Controle do administrador

Em **Sistema → Recursos e modelos → Apresentação do Hub**, o Admin pode desligar o convite automático. O tour continua acessível pela Ajuda. Reativar o convite não obriga quem já concluiu ou dispensou esta edição a vê-la novamente.

Os passos são publicados junto ao código, com uma edição própria, independente do número de cada atualização do aplicativo. Não há editor de apresentações no Admin.

## Dados e recuperação

Tarefas e progresso ficam no banco principal da instância, ligados à conta. São incluídos no snapshot desse banco pelo backup existente. A migração é aditiva e não apaga tarefas oficiais, perfis ou preferências. O ensaio completo de recuperação e atualização fica para a etapa 8A, a ser planejada com o mantenedor.
