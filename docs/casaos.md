# CasaOS

Use o mesmo [Compose de importação gráfica do ZimaOS](https://github.com/RichardSpinola/OpenStudyHub/blob/main/deploy/zimaos-compose.yml) no instalador de aplicativos personalizados do CasaOS. O arquivo usa Docker Compose e metadata `x-casaos`; não há uma segunda implementação nem pacote de loja. Importe **todos** os cinco serviços juntos.

Antes de instalar, ajuste na GUI `APP_URL` e `REALTIME_PUBLIC_URL` dos serviços App, Admin e realtime para o endereço real do App. O padrão `localhost` do arquivo serve apenas para acesso local; para dispositivos da LAN, use `http://IP-DO-CASAOS:3000` e `ws://IP-DO-CASAOS:3000/realtime`. O card principal abre o App na porta `3000`. Se sua versão do CasaOS permitir atalhos, o Admin pode receber um atalho separado para `http://IP-DO-CASAOS:3001`; isso não duplica a instalação.

O volume Docker nomeado `openstudyhub-data:/app/data` guarda bancos e arquivos. Não substitua por diretório temporário. Restrinja a porta `3001` à LAN ou ao acesso administrativo privado; só o App na porta `3000` pode ser exposto publicamente. Para recuperação, veja [Backup e atualização](backup-update.md).

Em HTTP na LAN, senha e cookie do Admin não são criptografados em trânsito. Mantenha o acesso numa rede confiável ou use HTTPS privado; nunca exponha a porta `3001` à internet.
