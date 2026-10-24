# ZimaOS

Use o modelo completo `deploy/zimaos-compose.yml` na importação de aplicativo personalizado do ZimaOS. Importe os cinco serviços juntos, com volume persistente `openstudyhub-data`. É uma instalação Compose manual, não um pacote oficial de loja.

O modelo fixa a imagem 3.1.0 para todos os serviços do Hub. Use o guia de atualização para preservar uma instalação existente.

1. Confira o modelo e a tag antes de importar.
2. Defina origem do App e URL pública realtime de modo consistente em App, Admin e realtime.
3. Mantenha o Admin em localhost ou endereço LAN privado protegido. Publique somente o App com HTTPS.
4. Aguarde migrations, confira health e abra o setup privado.
5. Configure Google depois, se necessário.

Para Admin localhost remoto, use o encaminhamento SSH em [instalação](instalacao-do-zero.md). Preserve projeto, mounts e configuração do gerenciador ao atualizar. Não execute o instalador sobre essa instalação. Veja [atualizações](backup-update.md).
