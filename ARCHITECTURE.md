# Arquitetura do OpenStudyHub V2

Uma instalação reúne o App para usuários, o Admin / Control Plane para configuração e um serviço de colaboração em tempo real. O proxy encaminha o tráfego público ao App e ao WebSocket; o Admin permanece local ou na rede privada por padrão. Google Classroom e Drive são opcionais.

```text
Navegador ─ HTTPS ─ proxy ─ App (Next.js) ─ banco principal + banco V2
                         └─ /realtime ─ serviço de colaboração
Admin privado ───────────── Control Plane ─ bancos da mesma instalação
Google opcional ─ OAuth por usuário; Classroom somente leitura; Drive/Docs
```

## Identidade e autorização

O login local é independente da conexão Google. A sessão é validada no servidor; o cookie guarda um token aleatório `HttpOnly`, e o banco guarda seu hash. A autorização é verificada nas rotas e ações, inclusive em Chat, compartilhamento, Extras e Admin. Um ID enviado pelo navegador não concede acesso.

## Modelo acadêmico

A instituição contém cursos (`Program`), turmas (`Cohort`) e períodos acadêmicos. Uma disciplina (`Subject`) pode ter várias ofertas (`SubjectOffering`), cada uma associada a curso, período, turma e professor conforme o caso. A matrícula (`Enrollment`) liga o usuário à oferta. Classrooms são associados às ofertas por confirmação do usuário; nomes parecidos não criam um vínculo automático.

## Google e armazenamento

Cada usuário autoriza sua conta para descobrir e sincronizar os próprios Classrooms em modo somente leitura. Refresh tokens são criptografados; access tokens não são persistidos como sessão do App. O Drive é opcional: o Admin pode designar uma conta conectada como responsável pelo armazenamento central. Ser responsável pelo Drive não concede permissão acadêmica extra. O produto mantém metadados locais e referências aos arquivos Google; dados persistentes e uploads locais ficam fora do repositório.

## Trabalho diário e colaboração

Hoje combina agenda e atividades. Notas, documentos, projetos e Chat preservam permissões por usuário, grupo ou contexto acadêmico. Arquivos privados são servidos após checagem de acesso, não diretamente de `public/`. O serviço `/realtime` atende presença, Chat e colaboração do Quadro Global. O Admin controla a visibilidade de Extras e de cada minigame na instância; ocultar um recurso também bloqueia sua rota ao usuário comum.

## Operação

O Compose de exemplo inicia migrations antes do App, Admin e realtime. `DATABASE_PATH` e `OPENSTUDYHUB_V2_DATABASE_PATH` apontam para bancos SQLite separados no volume persistente. Em produção, use HTTPS para o App, mantenha Admin e volume privados e configure backup de ambos os bancos, dos assets e dos segredos guardados separadamente. Consulte [deploy](docs/deployment.md), [backup](docs/backup-update.md) e [Google](docs/google.md) para o procedimento atual.
