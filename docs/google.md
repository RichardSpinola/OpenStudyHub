# Google na V2: Classroom, Drive e Docs

Você pode usar o OpenStudyHub sem conectar o Google. Se quiser trazer suas turmas e atividades do Classroom, cada pessoa autoriza a própria conta e confirma a associação com suas disciplinas. O Drive para documentos é uma escolha separada da instância: o Admin pode indicar uma conta conectada para o armazenamento central. Essa escolha não dá ao Admin acesso automático aos Classrooms pessoais. A instalação usa um cliente OAuth **Web application** por instância.

## Configurar no Google Cloud

1. Crie ou escolha um projeto no [Google Cloud Console](https://console.cloud.google.com/). Ative **Google Classroom API**, **Google Drive API** e **Google Docs API**. Ative **Google Picker API** apenas se for usar o seletor de Docs existentes.
2. Configure a tela de consentimento OAuth com os scopes abaixo. Se o aplicativo estiver em modo **Testing**, cadastre cada conta que fará o teste em **Test users**. Revise requisitos de verificação do Google antes de disponibilizar amplamente.
3. Em **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**, escolha **Aplicativo da Web**. Copie o Client ID e o Client Secret do **mesmo cliente** para o ambiente privado do servidor.
4. No cliente, adicione a URI de redirecionamento autorizada **exatamente** como `APP_URL + /api/v2/google/callback`. O esquema, host, porta e caminho devem coincidir; diferença produz `redirect_uri_mismatch` ([documentação do Google](https://developers.google.com/identity/protocols/oauth2/web-server)).

Para uma instância de exemplo em `https://hub.example.org`, a URI exata é:

```text
https://hub.example.org/api/v2/google/callback
```

Para um teste local em `http://127.0.0.1:3000`, use `http://127.0.0.1:3000/api/v2/google/callback`; a porta precisa ser a mesma do App que iniciou o OAuth. Produção usa HTTPS. Registre cada origem de JavaScript autorizada que o Picker usar, incluindo a origem pública do App. Não use a URL do Admin como callback.

## Variáveis privadas

```env
APP_URL=https://hub.example.org
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://hub.example.org/api/v2/google/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=
```

`GOOGLE_TOKEN_ENCRYPTION_KEY` é uma chave aleatória de 32 bytes em Base64. Gere e guarde fora do Git, por exemplo com `openssl rand -base64 32`. Preserve a mesma chave em atualizações e backups seguros; perdê-la exige reconectar contas. Reinicie App e Admin após alterar variáveis. Não registre chaves, tokens, authorization code ou OAuth state em logs.

O Picker é opcional e exige `GOOGLE_PICKER_API_KEY` e `GOOGLE_CLOUD_PROJECT_NUMBER` (número do projeto, não o ID textual). Restrinja a API key no Google Cloud. Sem Picker, a importação DOCX e os arquivos criados/autorizados pelo app continuam disponíveis. IDs opcionais de modelos iniciais (`GOOGLE_TEMPLATE_GENERIC_ACTIVITY_ID`, `GOOGLE_TEMPLATE_PROGRAMMING_ACTIVITY_ID`, `GOOGLE_TEMPLATE_CLASS_NOTES_ID`) pertencem somente ao ambiente privado.

## Scopes usados

O código V2 pede `openid`, `email` e os quatro scopes Classroom abaixo na conexão inicial:

```text
https://www.googleapis.com/auth/classroom.courses.readonly
https://www.googleapis.com/auth/classroom.coursework.me.readonly
https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly
https://www.googleapis.com/auth/classroom.announcements.readonly
```

O Drive opcional acrescenta `https://www.googleapis.com/auth/drive.file` quando o usuário autoriza esse recurso. Esse scope limita o acesso aos arquivos criados ou explicitamente abertos/compartilhados com o aplicativo, inclusive pelo Picker; ele não concede leitura geral do Drive ([guia oficial](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)). A tela de consentimento do Google Cloud deve declarar os scopes que o app solicitará. O código determina o que é pedido em cada etapa.

## Uso no OpenStudyHub

Depois do login local, abra **Configurações → Integrações → Google**. Conecte a conta, descubra os Classrooms, revise sugestões e confirme manualmente a associação com cada turma de disciplina. Não há mapping automático por nome parecido. A sincronização traz os dados para o espaço local do usuário; o Admin pode definir a janela de sync automático. A página Google indica conexão, última verificação, falha temporária ou necessidade de reconexão.

No Admin, uma conta conectada pode ser escolhida como owner do armazenamento Drive central. A estrutura acadêmica é criada/sincronizada pela administração. Classroom continua pessoal mesmo quando Drive central está ativo. O diretório raiz usa `Nome da instituição - OSH`; pastas de disciplinas e projetos seguem a organização configurada. Se uma pasta remota for apagada, use a ação administrativa de sincronizar/reparar pastas depois de verificar a referência atual, sem criar uma segunda estrutura arbitrária.

Erros de OAuth podem vir de callback diferente, conta fora dos test users, scopes não declarados, consentimento recusado ou sessão local expirada. Confira primeiro as variáveis e o cliente OAuth correspondente. Não copie tokens entre bancos/instalações. Para backup e restauração, siga [o guia operacional](operations/manual-backup-restore.md): a cópia remove tokens e exige reconexão posterior.
