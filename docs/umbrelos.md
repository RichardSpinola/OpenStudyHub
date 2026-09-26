# UmbrelOS

Esta fase prepara o caminho **manual** com [Docker Compose](deployment.md) em host UmbrelOS que permita executar Compose. Não há pacote publicado na Umbrel App Store nem instalação de um clique. O [formato oficial da Umbrel App Store](https://github.com/getumbrel/umbrel-apps) é um empacotamento separado; não trate o Compose genérico deste repositório como pacote nativo de loja.

Mantenha juntos migration, App, Admin, realtime e proxy do `docker-compose.example.yml`; persista o volume `openstudyhub-data`. Configure `.env`, `APP_URL`, URL pública WebSocket e, se usar Google, o callback V2. Exponha somente o App por HTTPS. O Admin fica local/LAN na porta `3001` e não deve passar pelo proxy público do UmbrelOS. Verifique `/api/health`, setup e Admin antes de conectar Google.

Para atualizar ou restaurar, siga [Backup e atualização](backup-update.md). Se a instalação UmbrelOS não oferecer Docker Compose acessível ao operador, esta via manual não se aplica; será necessário um pacote nativo validado separadamente antes de prometer instalação pela loja.
