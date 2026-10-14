# Revisão final UX da etapa zero

## Decisão principal

A V2 aprovada é a referência visual. A V3 incorpora ajustes definidos; não substitui todo o design pela simulação. Preservar modelos de botões, ícones Tabler, temas, opções de navegação e funcionalidades existentes. Mudança da navegação principal: Documentos + Projects passam a Biblioteca, mantendo tipos separados.

Esta rodada modifica somente o acompanhamento e a prévia local. Não altera o App funcional, banco, Google, servidor ou release. Após esta revisão, não criar outra direção visual por iniciativa própria.

## Elementos protegidos

- Barra: mesma organização e conjunto de ícones. Top/clássica preservadas na implementação; links e notificações pertencem ao App, sem copiá-los para o Control Plane.
- Material: paleta neutra, formas e componentes aprovados. Legacy/TUI: manter a direção terminal já aprovada. Corrigir encaixe sem trocar a identidade.
- Home: lápis e lateral existentes, seletor de fundo/presets/imagem pessoal, editar atalhos, Ocultar/Mostrar, relógio/posição, resumo Hoje, Salvar widgets, buscador e configurações completas.
- ASCII: nove fontes existentes, não apenas “Atual/Compacto”. Texto é exclusivo de Admin; fonte pessoal é a adaptação planejada. Redução automática de largura não é uma opção de fonte.
- Hoje: conteúdo atual preservado. Home usa os mesmos destaques: próxima aula/encontro, prazo e atualização do mural. Ajustar a grade temporal conforme horários reais e fuso; não refazer toda a página.
- Disciplina: cartões/capas/histórico e seis abas. Notas, Documentos e Projetos usam suas representações gráficas e grade automática. Notas mantém associação opcional à oferta; migrar para workspace não exige remover a aba.
- Biblioteca: abas separadas, lista/grade, criação/importação distintas, modelos, versões, tecnologias e compartilhamento. Ícones de linguagem sem substituir o texto acessível.
- Capa: configurar dentro da disciplina no Admin, com autorização server-side; não um botão solto na visão geral acadêmica.

## Admin sem excesso de navegação

1. Acadêmico mostra instituições.
2. Ao escolher uma instituição, mostrar visão geral e cursos daquela instituição.
3. Ao escolher um curso, mostrar período/turmas, disciplinas/ofertas e horários/eventos no mesmo contexto.
4. Detalhes locais recolhíveis para ações secundárias; breadcrumbs para voltar sem perder o contexto.
5. Pessoas/permissões mostram contas, contexto e concessões resumidos na página.
6. Integrações mostram estado, última verificação, destino e ação necessária; configuração detalhada recolhível.
7. Sistema mostra saúde/versão diretamente; Extras, backup, notificações e auditoria na mesma área, com estados e configurações locais.

Nada disso elimina autorização, grants, vínculos ou confirmações de ações com impacto.

## Cobertura e limites

O inventário de 48 rotas está em [SCREENS.md](SCREENS.md), com revisão por famílias e evidências. O backlog A01–A34 / U01–U29 continua íntegro em [BACKLOG.md](BACKLOG.md).

A prévia agora tem Home, Hoje, lista de Disciplinas, detalhe de Disciplina, proposta de Notas, Biblioteca, Admin com subfluxos e Revisão completa. O mapa da revisão declara o que preservar, o que ajustar e a etapa de cada família.

Chat, Extras, Google pessoal, Configurações/perfil, login/setup/onboarding, gestão e rotas legadas **não tiveram todos os seus estados simulados**. Sua revisão está no mapa/backlog; a conferência do fluxo funcional ocorrerá na etapa responsável. Ausência na simulação não autoriza remover, redesenhar ou declarar aprovado o recurso. O protótipo de Notas não contém editor colaborativo real; a grade Hoje é uma amostra resumida, não o algoritmo temporal final.

## O que o usuário precisa conferir

1. Home: lápis → controles preservados e fontes; resumo Hoje → página Hoje.
2. Disciplinas: abrir uma matéria → alternar Mural/Timeline e Notas/Documentos/Projetos. Biblioteca: testar suas duas abas e lista/grade.
3. Admin: Acadêmico → instituição → curso → expandir uma disciplina. Depois Pessoas/permissões, Integrações e Sistema; confirmar contexto e informações visíveis sem navegar demais.
4. Revisão completa: conferir o que será mantido/ajustado nas áreas sem amostra. A lista é a referência para as próximas etapas, sem exigir 48 percursos manuais agora.

Esta é a última rodada de direção visual da etapa zero. O próximo trabalho deve aplicar os ajustes acordados aos componentes reais, com validações dirigidas e retorno curto, preservando o restante.
