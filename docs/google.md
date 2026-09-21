# Google: OAuth, Classroom, Drive e Docs

Google é opcional. O Core funciona sem estas variáveis.

## Modelo

Há um único OAuth app por instalação do OpenStudyHub. Cada usuário conecta sua própria Conta Google.

- Classroom usa sempre a conta do próprio usuário.
- Drive/Docs podem usar uma conta central de armazenamento escolhida por ADMIN.
- ADMIN não recebe automaticamente o token Google de outros usuários.

## APIs

Habilite no mesmo projeto Google Cloud conforme o que a instância usará:

- Google Drive API
- Google Docs API
- Google Classroom API
- Google Picker API, se quiser selecionar Docs existentes pelo Picker

## OAuth client

Crie um OAuth client do tipo Web application e registre exatamente o callback usado pela instância.

Desenvolvimento:

```text
http://localhost:3000/api/google/callback
```

Produção deve usar a URL HTTPS real da instância.

Configure:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://hub.exemplo.com/api/google/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=
```

`GOOGLE_TOKEN_ENCRYPTION_KEY` deve representar 32 bytes aleatórios codificados em Base64. Guarde backup seguro da chave; perder a chave exige reconectar as contas Google.

## Scopes

A V1 usa identidade mínima, `drive.file` e scopes Classroom read-only necessários às funções implementadas.

`drive.file` é intencional: o Hub trabalha com arquivos criados pelo app ou explicitamente autorizados, em vez de pedir leitura geral do Drive.

## Google Picker opcional

Para `Escolher no Drive`:

```env
GOOGLE_PICKER_API_KEY=
GOOGLE_CLOUD_PROJECT_NUMBER=
```

Restrinja a API key no Google Cloud. Se Picker não estiver configurado, o import DOCX continua disponível.

## Templates iniciais opcionais

IDs reais nunca devem ir ao Git:

```env
GOOGLE_TEMPLATE_GENERIC_ACTIVITY_ID=
GOOGLE_TEMPLATE_PROGRAMMING_ACTIVITY_ID=
GOOGLE_TEMPLATE_CLASS_NOTES_ID=
```

A alternativa recomendada é importar os DOCX pelo próprio OpenStudyHub para que o arquivo-base seja criado/autorizado sob `drive.file`.

## Classroom

O mapping é por Subject Offering.

Se um curso só estiver visível na conta de um aluno, ADMIN pode registrar manualmente Course ID + nome na Offering; o sync posterior usa o token Google do aluno matriculado.

Não faça merge automático de Classrooms com nomes parecidos.

## Drive central

ADMIN pode escolher uma Conta Google conectada como storage owner.

A estrutura é criada de forma lazy:

```text
Nome da Instituição - OSH/
  Program/
    [Cohort/]
      Period/
        Subject/
          Atividades/
          Anotações/
          Documentos/
```

Classroom continua usando a conta pessoal, mesmo quando Drive central está ativo.
