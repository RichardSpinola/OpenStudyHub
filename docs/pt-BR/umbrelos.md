# UmbrelOS

O projeto não distribui pacote oficial da loja Umbrel. Use a [implantação Compose](deployment.md) somente se o host disponibilizar Docker Compose e permitir mounts persistentes/rede necessários. Caso contrário, esse método não se aplica.

Mantenha migration, App, Admin, realtime e proxy juntos. Configure ambiente privado, dados persistentes, origem pública e WebSockets; preserve o Admin em localhost/acesso privado. Conclua setup depois de conferir saúde. Não presuma compatibilidade de um exemplo Compose com um importador gráfico não suportado.

Antes de atualizar, preserve configuração e volume do host e siga [backup/atualização](backup-update.md).
