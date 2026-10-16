# Etapa 7 — plano aprovado e execução

Autorizada em 15/10/2026. A prévia fica **desligada durante implementação, testes técnicos e build**; só é ligada para as verificações visuais necessárias e volta a ser desligada ao terminar. Uma tarefa pesada por vez. Sem publicação, secrets do servidor ou integração Google real nesta etapa.

## Configurações do usuário

Portal com oito cartões ilustrados: Conta e perfil; Aparência; Home e atalhos; Notificações; Integrações; Acessibilidade e idioma; Ajuda; Sobre e Créditos. Três colunas em telas amplas, duas intermediárias e uma no celular. Cada grupo tem retorno claro ao portal; se o conteúdo for longo, a rolagem é normal. Links antigos continuam aceitos.

Preferências simples salvam automaticamente, com confirmação/erro; perfil mantém salvamento explícito. Não apagar preferências nem substituir a identidade Material/Legacy. Admin mantém a organização já aprovada; recebe somente os controles operacionais desta etapa.

## Movimento e aparência

Animações discretas em toda a **área do usuário**, incluindo transições de página, controles, cartões e painéis. Duração curta, sem decoração contínua e sem animar novamente mensagens, colaboração ou contadores a cada atualização. Respeitar redução de movimento do sistema e do usuário.

Wallpaper desfocado opcional nas áreas comuns e na navegação: desligado, leve, médio ou forte. Sem imagem mantém fundo sólido. Chat mantém seu próprio wallpaper; editores, jogos abertos e Quadro Branco conservam a superfície de trabalho. Usar uma camada filtrada, preservar contraste e respeitar redução de transparência.

## Chat

Seta flutuante para **Ir para última mensagem** sempre que a pessoa estiver acima do fim, mesmo sem mensagem nova. Indicador separado de novidade. Reaproveitar a janela recente carregada ou buscar as últimas mensagens se estiver no histórico paginado. Preservar rascunho/anexo e posição de leitura. Em caso de falha, manter a ação disponível.

## Backup, recuperação e operação

Cópias manuais e rotina diária após configurar destino e guardar a chave de recuperação. Sugestão inicial: 03:00 no fuso escolhido, sete cópias automáticas válidas; retenção configurável e sem limpar manuais. Pacote criptografado com bancos e arquivos geridos, manifesto/checksums e exportação ZIP sanitizada antiga separada. Arquivos remotos não são declarados copiados.

Destino local e cópia no Drive central quando configurado. Uma execução por vez entre processos, manutenção durante snapshot, histórico de falhas e recuperação offline com validação anterior à substituição e cópia de retorno. O ensaio real com Google continua dependendo da confirmação futura antes de acessar secrets.

Reduzir trabalho repetido dos bancos, renovação duplicada de tokens, polling e cópias desnecessárias em RAM. Comparar um cenário técnico reproduzível, sem transformar microbenchmark em promessa para todas as páginas. Saúde dos dois bancos, realtime e arquivos; diagnóstico privado com ações compreensíveis e saúde pública sanitizada. Configuração push/VAPID para instalação nova. Rever reconexão com rede tardia e preparar o pacote operacional.

## Validação e entrega

Somente conferências visuais **necessárias nos elementos alterados**. A revisão visual ampla fica com o usuário. Testes técnicos dirigidos são mantidos para dados, recuperação e autorização. Sem passeios por todas as páginas, testes de carga ou builds repetidos sem falha concreta. Um commit local e relato curto com resultados e limitações.

## Etapa 8

Checkpoint integrado: ensaio real dividido em percursos, nova instância de teste no notebook, confirmação antes de buscar secrets, Drive/Classroom real, instalação/gerenciador, imagem distribuível, extensão, documentação e preparação do GitHub. A V3 permanece aberta a novas funcionalidades depois deste checkpoint.

## Complemento aprovado em 16/10/2026

Executar somente a etapa 7. Agenda exportável (.ics, sem assinatura), checklist privado em Hoje com gerenciamento em /today/tasks e tour guiado sobre as páginas reais, exclusivo da área do usuário. Contas novas e existentes recebem convite por edição; Ajuda oferece retomada/reinício; Admin pode desligar apenas o convite. Nenhum envio ou alteração de preferências pelo tour.

A rodada integrada de testes será planejada com o usuário na **8A**. Nesta entrega, apenas verificações dirigidas de dados/acesso/datas/progresso e conferências visuais necessárias. **8B** ficará para documentação/apresentação e GitHub; **8C**, implantação no servidor. Não executar essas partes agora. Pendências anteriores da 7 continuam registradas na 8A; não são declaradas resolvidas por mudança de etapa.
