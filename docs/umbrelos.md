# UmbrelOS

Esta fase prepara o caminho **manual** com [Docker Compose](deployment.md) em host UmbrelOS que permita executar Compose. Não há pacote publicado na Umbrel App Store nem instalação de um clique. O [formato oficial da Umbrel App Store](https://github.com/getumbrel/umbrel-apps) é um empacotamento separado; não trate o Compose genérico deste repositório como pacote nativo de loja.

Mantenha juntos migration, App, Admin, realtime e proxy do `docker-compose.example.yml`; ele usa a imagem versionada `ghcr.io/richardspinola/openstudyhub:2.0.1` e o volume Docker nomeado `openstudyhub-data:/app/data`. Esta instalação manual mantém o `.env` e o `deploy/Caddyfile` junto do Compose no host, portanto não depende de um importador gráfico que copie esses arquivos. Configure `APP_URL`, URL pública WebSocket e, se usar Google, o callback V2. O App sai pela porta `3000` e pode ser exposto publicamente; o Admin fica local/LAN na porta `3001` e não deve passar pelo proxy público. Verifique `/api/health`, setup e Admin antes de conectar Google.

Para atualizar ou restaurar, siga [Backup e atualização](backup-update.md). Se a instalação UmbrelOS não oferecer Docker Compose acessível ao operador, esta via manual não se aplica; será necessário um pacote nativo validado separadamente antes de prometer instalação pela loja.
