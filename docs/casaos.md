# CasaOS

O OpenStudyHub V2 é uma implantação com cinco serviços Docker. Use o [Compose V2](deployment.md) pelo Docker Compose no host CasaOS; não converta o arquivo em um único contêiner no instalador de apps personalizados. Ainda não existe pacote publicado na loja CasaOS.

1. No host, mantenha o checkout/Compose e um `.env` privado. Configure o domínio público do App e o WebSocket em `APP_URL` e `OPENSTUDYHUB_REALTIME_PUBLIC_URL`.
2. Execute `docker compose -f docker-compose.example.yml up -d --build` num ambiente que disponha de Docker Compose.
3. Confira `http://127.0.0.1:3000/api/health` e o Admin em `http://127.0.0.1:3001/control/login`. Para Admin via LAN, use o IP LAN em `OPENSTUDYHUB_ADMIN_BIND` e proteja a porta.
4. Publique apenas a porta do App por HTTPS; o callback Google é `APP_URL + /api/v2/google/callback`.

O volume `openstudyhub-data` contém bancos e assets. Faça backup antes de atualizar e siga [o procedimento de recuperação](backup-update.md). A opção de importar Compose pela UI do CasaOS pode variar por versão; esta orientação usa o mecanismo Docker do host para preservar todos os serviços e dependências.
