# Checklist de release V2

Este checklist pertence ao gate da Fase 10.2. Nenhum item marcado aqui substitui execução e evidência do gate final.

## Código, dados e licenças

- [ ] Revisar diff e histórico público: nenhum banco de QA, dado pessoal, `.env`, token, cookie, upload real, credencial ou caminho local.
- [ ] Conservar código oficial, migrations V1/V2, scripts de manutenção, testes úteis, extensão e atribuições de terceiros.
- [ ] Confirmar `LICENSE`, licença MIT do Excalidraw e notas de licença das fontes incorporadas.

## Verificações técnicas

- [ ] Formatação, lint sem warnings, typecheck e suíte completa.
- [ ] Builds finais de App, Admin, realtime e extensão.
- [ ] Instalação limpa e atualização com migrations V1/V2 em bancos separados.
- [ ] Integridade e chaves estrangeiras dos bancos; `/api/health` do App e acesso ao login do Admin.
- [ ] Build da imagem Docker e Compose com volume persistente e Admin acessível apenas na rede prevista.
- [ ] Backup, restauração com serviços parados e recuperação após falha.
- [ ] Revisão de sessões, autorização, OAuth, uploads, WebSocket, logs e exposição de dados.

## Smoke humano e publicação

- [ ] Setup, login e logout no App/Admin; Home, Hoje, Disciplinas, Notes, Documents, Projects, Chat e Extras.
- [ ] Google Classroom e Drive com consentimento real apenas se o ambiente estiver configurado; verificar callback V2.
- [ ] Extensão Chromium instalada sem compactação: opções, URL inválida, Nova Aba e sessão web normal.
- [ ] Documentação publicada sem links locais e sem afirmar que há pacote de loja para ZimaOS/CasaOS/UmbrelOS.
- [ ] Definir versão, tag, push e publicação somente após aprovação explícita do gate.
