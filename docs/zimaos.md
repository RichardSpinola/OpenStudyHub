# ZimaOS

Use o [Compose V2](deployment.md) como instalação manual no host ZimaOS com Docker/Compose. Ainda não existe entrada publicada em loja ZimaOS. Mantenha **todos** os serviços do Compose na mesma implantação: migration, App, Admin, realtime e proxy. Não importe apenas o primeiro contêiner como se fosse o aplicativo inteiro.

Configure `.env` e volume persistente antes de iniciar. O App sai em `127.0.0.1:3000` e pode ser ligado a um túnel HTTPS; o Admin sai em `127.0.0.1:3001` e deve permanecer na LAN. Se acessar o Admin por outro computador, altere `OPENSTUDYHUB_ADMIN_BIND` para o IP LAN do servidor e restrinja por firewall. Ajuste `APP_URL`, `OPENSTUDYHUB_REALTIME_PUBLIC_URL` e o callback Google V2 ao domínio público do App. Confira `/api/health` e `/control/login` após subir.

O caminho de execução e atualização é o mesmo de [Backup e atualização](backup-update.md). A interface do ZimaOS pode mudar; a instalação documentada depende apenas do Docker Compose no host, sem prometer integração nativa de loja.
