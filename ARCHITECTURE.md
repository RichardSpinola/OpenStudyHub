# Arquitetura do OpenStudyHub

## 1. Visão geral

OpenStudyHub é uma aplicação Next.js self-hosted com SQLite local. O Core não depende de Google ou de serviços de IA.

```text
Browser
  ↓ HTTPS / reverse proxy
OpenStudyHub (Next.js)
  ├── SQLite: contas, metadata, relações, authz, cache
  ├── private-assets: avatares, banners, anexos de chat, favicons cacheados
  └── Google opcional
       ├── Classroom read-only
       ├── Drive `drive.file`
       └── Google Docs
```

## 2. Segurança e identidade

- Login local e Google OAuth são independentes.
- Sessões são server-side; o cookie contém token aleatório HttpOnly, e SQLite guarda apenas hash.
- Refresh tokens Google são criptografados com AES-256-GCM.
- Access tokens são efêmeros.
- Autorização é validada no servidor; IDs enviados pelo browser não concedem autoridade.

## 3. Roles e escopos

- `ADMIN`: autoridade global.
- `MODERATOR`: escopo de Program.
- `CURATOR`: escopo de Cohort.
- `USER`: contexto e recursos permitidos.

Visual Tags são apenas metadata de perfil e nunca concedem permissão.

## 4. Modelo acadêmico

```text
Program
  └── Cohort (opcional)

Subject
  └── SubjectOffering
       ├── Program
       ├── AcademicPeriod
       ├── Cohort/professor quando aplicável
       └── Classroom mapping opcional

User * ── * SubjectOffering via Enrollment
```

A mesma disciplina pode ter várias Offerings. Classrooms de professores/turmas diferentes não são fundidos automaticamente.

## 5. Google

Há um OAuth app por instância. Cada usuário conecta sua própria Conta Google.

### Classroom

Classroom sempre usa o token do usuário atual e é read-only. O mapeamento é explícito por Offering.

### Drive acadêmico central

Opcionalmente, um ADMIN escolhe uma Conta Google conectada como storage owner da instância.

- `owner_user_id`: dono lógico do recurso no Hub.
- `storage_user_id`: conexão Google que controla o arquivo/pasta.

Estrutura criada preguiçosamente:

```text
OpenStudyHub/
  _Templates/
  Program/
    [Cohort/]
      Period/
        Subject/
          Atividades/
          Anotações/
          Documentos/
```

Projects não são migrados para esse storage na V1.

## 6. Notes e Documents

- Private Notes: owner-only, nunca compartilhadas.
- Subject Notes: privadas por padrão, compartilháveis explicitamente com Groups.
- Documents: privados por padrão, compartilháveis explicitamente com Groups.
- Google Docs continua canônico para conteúdo de Documents.
- SQLite guarda metadata, contexto e relações.

## 7. Groups e Chat

Group é entidade de autorização reutilizada por Chat e sharing.

Chat suporta direct, group e audience por Program/Cohort. Mensagens usam polling simples na V1; não há WebSocket nem Web Push em background.

Anexos de chat ficam fora de `public/` e são servidos apenas após autorização.

## 8. Projects

Projects recebem upload de pasta/ZIP, validam caminhos e conteúdo, produzem manifests SHA-256 e versões portáveis. Nenhum código é executado.

Projects continuam owner-private na V1 e podem ser ocultados por feature flag.

## 9. Persistência

- SQLite: `DATABASE_PATH`.
- mídia privada: `PRIVATE_ASSET_PATH`.
- migrations: `drizzle/`.
- arquivos Google permanecem no Google Drive.

Backup deve preservar banco e private-assets.

## 10. Deploy

A V1 suporta processo Node.js e Docker. Em produção, use HTTPS e um reverse proxy; não exponha Docker socket, SQLite ou serviços internos como rede pública.
