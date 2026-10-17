# Arquitetura

## Uma instância, responsabilidades separadas

O App Next.js atende os fluxos de estudo. O Admin é uma superfície separada com autenticação própria. Um serviço Node realtime atende colaboração e agendamento de backup; Caddy encaminha App e WebSockets. Migrations executam antes dos serviços.

Os bancos SQLite principal/legado e canônico acadêmico coexistem intencionalmente. Uma ponte de identidade/projeção liga registros existentes a usuários e ofertas acadêmicas canônicas. `v2` nos caminhos internos identifica essa arquitetura e permanece por compatibilidade. Não una bancos, renomeie variáveis nem edite migrations aplicadas como parte de uma limpeza documental.

## Persistência e limites

Assets privados e versões locais de projetos ficam no volume; notas e parte das imagens/estado ficam no SQLite. Google armazena documentos/projetos remotos opcionais. Credenciais OAuth são configuração privada; refresh tokens criptografados pertencem à conexão, não ao código do navegador. Classroom pessoal e responsabilidade do Drive central são distintos.

App, Admin, realtime e migrations precisam concordar sobre caminhos e criptografia. Preserve Admin privado e volume ao substituir imagens. Veja [implantação](deployment.md), [Google](google.md) e [recuperação](operations/manual-backup-restore.md).
