# Integração Google opcional

O OpenStudyHub funciona sem Google. **Classroom é uma conexão pessoal, somente de leitura**; cada usuário conecta e associa suas turmas. **Drive central é armazenamento administrado da instância**, escolhido pelo Admin entre contas conectadas e autorizadas. Escolher o responsável não revela o Classroom pessoal de todos.

## Configure o cliente OAuth

1. No [Google Cloud Console](https://console.cloud.google.com/), escolha o projeto da instância. Ative Classroom, Drive e Docs; ative Picker somente para selecionar Docs existentes pelo seletor.
2. Configure consentimento e usuários de teste quando o aplicativo estiver em Testing. Confira os requisitos de verificação para acesso ampliado.
3. Crie um cliente OAuth **Aplicativo da Web**. Guarde Client ID e Client Secret no ambiente privado do servidor.
4. Cadastre o callback exato: `APP_URL + /api/v2/google/callback`. Exemplo: `https://hub.example.org/api/v2/google/callback`. Esquema, host, porta e caminho precisam coincidir. O Admin não é a superfície de callback.

Para QA local, cadastre a origem/porta local exata separadamente. Não altere credenciais de produção apenas para contornar um erro local. Veja [o fluxo web do Google](https://developers.google.com/identity/protocols/oauth2/web-server).

## Configuração privada

Defina `APP_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` e `GOOGLE_TOKEN_ENCRYPTION_KEY` nos serviços que usam a integração. A chave é aleatória, de 32 bytes em Base64; preserve-a nas atualizações. Reinicie App/Admin após mudanças. O instalador gera a chave inicial, mas não pede segredos OAuth.

Picker também precisa de `GOOGLE_PICKER_API_KEY` restrita e `GOOGLE_CLOUD_PROJECT_NUMBER`. IDs opcionais de modelos iniciais pertencem somente à configuração privada. Não comite códigos OAuth, tokens, cookies, chaves reais nem IDs privados de Drive/Classroom.

## Permissões e conteúdo

A conexão inicial solicita `openid`, `email` e estes scopes Classroom:

```text
https://www.googleapis.com/auth/classroom.courses.readonly
https://www.googleapis.com/auth/classroom.coursework.me.readonly
https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly
https://www.googleapis.com/auth/classroom.announcements.readonly
```

O Drive opcional acrescenta `https://www.googleapis.com/auth/drive.file`. Ele limita o acesso a arquivos criados ou autorizados explicitamente para o aplicativo; colar uma URL arbitrária não concede acesso. Veja [a orientação do Google sobre scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

Em Configurações → Integrações, conecte, descubra Classrooms, confira e confirme associações e sincronize. Avisos, atividades e **materiais** são tipos separados. Confira a última sincronização se faltar material do professor. Conteúdo antigo em cache pode continuar visível quando a conexão exige reconectar.

## Armazenamento e reparação

Admin → Integrações → Armazenamento escolhe o responsável e prepara a raiz. Os caminhos acadêmicos seguem instituição/curso/turma/período/disciplina. Projetos usam um ramo descritivo `Projetos - curso`; modelos privados ficam em Modelos e no nome da pessoa. Nomes podem ser localizados; use as referências salvas em vez de adivinhar pastas pelo nome.

Se faltar a raiz, confira o estado e use a ação explícita de criar/recuperar. A recuperação pode preservar a referência anterior em vez de duplicar pastas silenciosamente. O Google pode recusar operações em arquivos criados por outro cliente OAuth, mesmo que a conta seja dona. Confira permissões ou gerencie esses arquivos no Drive; não amplie scopes apenas para esconder uma falha.

Atualizações normais **não** resetam a Biblioteca nem recriam todas as pastas. Arquivos remotos do Drive não são baixados para o backup local. Veja [backup/atualização](backup-update.md).

<!-- Compatibility anchors for previously published guide links. -->

<span id="configurar-no-google-cloud"></span>
<span id="google-na-v2-classroom-drive-e-docs"></span>
<span id="scopes-usados"></span>
<span id="uso-no-openstudyhub"></span>
<span id="variaveis-privadas"></span>
