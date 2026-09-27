# Changelog

## 2.0.1

Corrige o loop de login do Control Plane quando o Admin é acessado por HTTP em uma rede local confiável e o App usa HTTPS. O cookie do Admin passa a seguir a origem da requisição, preservando `Secure` para HTTPS, `HttpOnly`, `SameSite=Lax`, isolamento por host e revogação no logout. O Compose de importação gráfica para ZimaOS/CasaOS acompanha a atualização da imagem fixa.

Leia as [notas da hotfix](RELEASE_NOTES_2_0_1.md) antes de atualizar.

## 2.0.0

O OpenStudyHub V2 organiza cursos, períodos, turmas, disciplinas, professores, horários e matrículas em uma estrutura acadêmica própria. A instalação separa o App, usado pela comunidade, do Admin / Control Plane, mantido em acesso local ou de rede privada por padrão.

- Google Classroom por usuário, com acesso somente de leitura, descoberta de turmas, associação manual às disciplinas e sincronização. Drive e Google Docs são opcionais e podem usar uma conta de armazenamento designada pelo administrador.
- Home personalizável, Hoje, notas, documentos com modelos, projetos com arquivos e versões, Chat em tempo real, perfis e notificações.
- Extras controlados pelo Admin: Quadro Global colaborativo e minigames Snake, 2048, Campo Minado, Paciência e Dominó.
- Interface em Português e English, com temas Material e Legacy/TUI e fluxo inicial de configuração da instância.
- Backup manual dos bancos e assets privados, restauração offline, extensão Nova Aba para Chromium e Firefox e implantação self-hosted com Docker Compose.

Leia as [notas da versão](RELEASE_NOTES.md) antes de instalar ou atualizar.
