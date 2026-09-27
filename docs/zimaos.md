# ZimaOS

Use o [Compose para importação gráfica](https://github.com/RichardSpinola/OpenStudyHub/blob/main/deploy/zimaos-compose.yml). Ele instala migration, App, Admin, realtime e proxy como **uma instalação**, com o volume Docker persistente `openstudyhub-data:/app/data`. A imagem `2.0.1` é pública: não precisa de terminal, conta GitHub ou PAT.

1. No ZimaOS, abra **App Center → Install a Customized App → Import → Docker Compose**.
2. Cole o conteúdo completo de `deploy/zimaos-compose.yml` ou importe esse arquivo.
3. Antes de clicar em **Install**, confira na própria GUI as variáveis `APP_URL` e `REALTIME_PUBLIC_URL` dos serviços App, Admin e realtime. O arquivo traz `localhost` como padrão local; para acesso pela rede, use em todos eles o endereço real que abrirá no navegador, por exemplo `http://IP-DO-ZIMAOS:3000` e `ws://IP-DO-ZIMAOS:3000/realtime`. Se usar HTTPS depois, os valores passam a `https://...` e `wss://...`. Não é necessário corrigir o YAML após a importação.
4. Clique em **Install**. O card principal **OpenStudyHub** abre `http://IP-DO-ZIMAOS:3000`.
5. Na GUI do ZimaOS, crie **manualmente um atalho**, chamado **OpenStudyHub Admin**, com URL `http://IP-DO-ZIMAOS:3001` e o [mesmo ícone](https://raw.githubusercontent.com/RichardSpinola/OpenStudyHub/v2.0.0/public/brand/icon-512.png). Esse atalho não instala outra stack nem cria outro card pelo Compose.
6. Abra o Admin pelo atalho e conclua o primeiro setup. Mantenha a porta `3001` acessível apenas na LAN ou em acesso administrativo privado; só o App na porta `3000` pode ser exposto publicamente.

O proxy encaminha `/realtime` e `/whiteboard` ao serviço realtime interno. Não mova `/app/data` para `/tmp`, tmpfs ou uma pasta temporária do instalador. Antes de atualizar ou restaurar, siga [Backup e atualização](backup-update.md).

Em HTTP LAN, a senha e o cookie do Admin trafegam sem criptografia. Restrinja a porta `3001` a uma rede confiável; para acesso fora dela, use HTTPS privado. Não exponha o Admin publicamente.
