# Assistente de IA local

O assistente é opcional e fica **desativado por padrão**. Ele responde dúvidas de estudo usando um servidor de modelos que você já mantém: o OpenStudyHub não instala servidor de inferência, não baixa modelos, não escolhe modelo por você e não exige assinatura de nuvem. As pessoas só o veem depois que um administrador conecta, testa e ativa um modelo.

## Requisitos

- Um servidor **Ollama** existente, ou um servidor que implemente a API **Chat Completions** compatível com OpenAI (`/v1/models` e `/v1/chat/completions` com streaming).
- Um modelo já instalado nesse servidor. Escolha um que caiba na memória do servidor; o Hub apenas lista o que o provedor informa.
- Acesso de rede dos contêineres do Hub ao provedor. No Docker, `127.0.0.1` é o próprio contêiner do Hub; use o endereço do provedor na rede local ou o nome de uma rede Docker.
- A chave de criptografia da instância (`GOOGLE_TOKEN_ENCRYPTION_KEY`) precisa estar configurada. Ela também protege a credencial opcional do provedor.

Espere velocidade modesta em hardware só com CPU. Na validação da 3.1.0, um modelo de 1B parâmetros em um servidor de quatro núcleos sem GPU gerou cerca de 10–15 tokens por segundo: respostas curtas chegam em poucos segundos, enquanto um texto longo pode atingir o limite padrão de 120 segundos e fica guardado como resposta parcial interrompida. Modelos pequenos também erram fatos; trate as respostas como apoio ao estudo a ser conferido, não como autoridade.

## Conectar e ativar

Em **Admin → Assistente de IA**:

1. Escolha o provedor e seu endereço base, por exemplo `http://192.168.1.20:11434` para Ollama. Em servidores compatíveis, você pode incluir `/v1`; o Hub acrescenta os caminhos fixos da API.
2. Informe uma credencial apenas se o provedor exigir. Ela é criptografada com a chave da instância e nunca vai para o navegador. Campo vazio mantém a credencial salva; a opção de remoção a apaga.
3. Clique em **Testar conexão e listar modelos**, escolha um modelo e teste novamente. Essa ação explícita do administrador contata o provedor mesmo com o assistente desativado. **O teste salva as configurações do provedor e deixa o assistente desativado**; depois, ative e salve novamente.
4. Ative imagens apenas se o modelo aceitar. No Ollama, o Hub confere as capacidades informadas pelo modelo; servidores compatíveis não têm um campo padrão para isso, então confirme na documentação do modelo.
5. Defina instruções, limites e permissões, ative e salve. Alterar o provedor ou desativar o assistente interrompe respostas em andamento e preserva o histórico.

No Ollama, o Hub pede respostas com o modo separado de "raciocínio" (thinking) desligado. Sem isso, modelos de raciocínio gastam o limite de saída e o tempo limite em texto oculto antes de mostrar qualquer resposta. Servidores compatíveis recebem uma requisição padrão; o raciocínio que esses servidores enviarem separadamente não é exibido.

O navegador fala apenas com o Hub. Em cada requisição ao provedor, o servidor fixa o endereço resolvido, recusa redirecionamentos e bloqueia endereços link-local e de metadados de nuvem. Endereços privados e de loopback são permitidos, porque a IA local normalmente está neles. Não exponha um servidor de inferência na internet sem autenticação e controles de rede próprios.

## Limites e permissões

| Configuração            | Padrão              | Significado                                                                                       |
| ----------------------- | ------------------- | ------------------------------------------------------------------------------------------------- |
| Contexto / saída máxima | 8192 / 2048 tokens  | Contexto enviado ao modelo e tamanho máximo da resposta. A saída precisa deixar espaço à entrada. |
| Tempo limite            | 120 s               | Por resposta. Uma resposta que excede fica guardada como interrompida, com o texto parcial.       |
| Simultâneas / fila      | 1 / 8               | Para toda a instância. Com a fila cheia, a pessoa é orientada a tentar em instantes.              |
| Cota diária             | 0                   | Pedidos por pessoa por dia (UTC); `0` significa sem cota (os limites técnicos continuam).         |
| Grupos / @IA global     | desligado/desligado | Conversas e cópias em grupos; à parte, @IA na sala global de toda a instância.                    |
| Fontes do Hub / anexos  | ligado / ligado     | Se as pessoas podem escolher notas, documentos, projetos e materiais, ou anexar arquivos.         |

O assistente não tem ferramentas: não pode editar, excluir, compartilhar nem executar nada no Hub, e nunca executa arquivos ou código enviados. Documentos, histórico do chat e anexos são passados ao modelo como dados citados e não confiáveis, com a instrução de não seguir comandos contidos neles. Ainda assim, um modelo pode produzir texto errado ou enganoso; a proteção é o assistente não ter nada sobre o que agir, e não o modelo sempre obedecer.

## Usar o assistente

Abra **Extras → Assistente de IA** ou a entrada do assistente no **Chat**. As conversas são privadas da sua conta: crie, renomeie, pesquise e exclua. As respostas aparecem enquanto são geradas; **Parar** cancela a sua. Respostas interrompidas ou com falha mantêm o texto parcial e ficam identificadas. Se o navegador perder a transmissão, reabra a conversa.

### Fontes e anexos

As fontes são escolhidas explicitamente; o assistente não percorre sua biblioteca nem segue links. Você pode escolher notas suas ou compartilhadas com você, documentos gerados e locais, arquivos de texto de projetos e materiais do Classroom em cache. Cada fonte recebe um rótulo `[S1]`, `[S2]` etc., e o modelo é orientado a citar esses rótulos.

Anexos por mensagem: até **quatro arquivos de 10 MB** cada.

- PDF (até 50 páginas), DOCX, TXT UTF-8 e Markdown.
- PNG, JPEG e WebP estáticos apenas quando imagens estiverem ativadas para um modelo com visão.
- O texto extraído é limitado a 50.000 caracteres por mensagem e reduzido para caber no contexto configurado; a interface avisa quando houve redução. Históricos longos são encurtados a partir das mensagens mais antigas.
- PDF, DOCX e imagens são processados em um processo separado, com limites de memória e tempo.

### Compartilhar uma cópia com um grupo de estudo

**Compartilhar cópia** mostra quantas mensagens e anexos serão compartilhados e pede confirmação. A cópia pertence ao grupo de estudo existente escolhido; o original privado continua separado, e excluí-lo não remove a cópia. Toda nota, documento ou projeto usado como fonte já precisa estar compartilhado com esse grupo; caso contrário, o compartilhamento é recusado. Caches privados de materiais do Classroom não podem ser compartilhados com grupos.

Membros do grupo podem ler a cópia, baixar seus anexos e continuá-la. O acesso é conferido em toda leitura, envio, transmissão e download: quem é removido do grupo ou perde acesso a uma fonte perde o acesso imediatamente. Somente quem fez a pergunta pode parar aquela resposta.

## @IA no chat

São necessárias duas autorizações: o administrador permite IA em grupos (e, à parte, @IA na sala global), e o responsável por cada grupo de estudo ativa **Permitir @IA neste grupo**. Os outros membros não podem alterar isso.

O assistente responde apenas quando alguém escreve `@IA` como palavra. Mensagens comuns, endereços como `ia@exemplo.com`, palavras como `@IAgo` e as próprias respostas do assistente nunca iniciam uma geração, então respostas não disparam outras respostas. Apenas as mensagens recentes da sala atual são lidas; conversas diretas e outras salas nunca são consultadas. As respostas têm autoria própria visível e ficam armazenadas separadamente das mensagens humanas. Se @IA não estiver permitido na sala, a menção é enviada como mensagem comum e nenhuma resposta é gerada.

## Backup e armazenamento

O histórico das conversas e as fontes ficam no banco da instância; os arquivos enviados ficam no diretório privado de arquivos, em `ai/`. Ambos entram nos backups gerenciados e são restaurados com eles. A credencial do provedor fica criptografada: restaure com a mesma chave de criptografia da instância ou informe-a novamente. Pedidos ativos são marcados como interrompidos nos snapshots exportados e após reinicialização.

## Solução de problemas

| Sintoma                                                 | O que conferir                                                                                                               |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| O teste falha com "Não foi possível salvar ou conectar" | Endereço acessível a partir do contêiner do Hub (não `127.0.0.1`), provedor ativo, nome exato do modelo, credencial.         |
| O assistente se desligou sozinho                        | O teste de conexão salva as configurações com o assistente desativado. Ative e salve novamente.                              |
| Respostas terminam interrompidas                        | Tempo limite curto para o hardware ou pedido muito longo. Aumente o tempo limite ou peça respostas mais curtas.              |
| "A fila está cheia"                                     | Aumente fila ou simultaneidade somente se o provedor tiver memória e CPU sobrando.                                           |
| Imagens recusadas                                       | Imagens desativadas ou modelo sem suporte a visão informado.                                                                 |
| @IA não responde em um grupo                            | IA em grupos permitida no Admin, @IA ativado pelo responsável, cota e fila disponíveis, `@IA` escrito como palavra separada. |
