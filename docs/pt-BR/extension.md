# OpenStudyHub na Nova Aba

A extensão abre a instância escolhida usando a sessão normal do site. Substitui a **Nova Aba**, não a página inicial nem o comportamento de Nova Janela. O pacote Manifest V3 pede apenas `storage` local, sem histórico ou conteúdo de outros sites.

## Chromium, Chrome, Edge, Brave e Vivaldi

1. Obtenha `extension/openstudyhub-new-tab/` de uma fonte confiável do projeto.
2. Abra Extensões, ative o modo desenvolvedor e escolha **Carregar sem compactação**.
3. Selecione a pasta que contém `manifest.json`.
4. Abra as opções, informe URL base como `https://hub.example.org`, salve e teste **Abrir instância**.
5. Abra uma nova aba e aceite a escolha de extensão se o navegador perguntar.

Políticas do navegador ou outra extensão de Nova Aba podem impedir a substituição. Desative/remova pelo gerenciador para restaurar o comportamento normal.

## Firefox

Abra `about:debugging` → Este Firefox → Carregar extensão temporária e selecione `manifest.json`. Configure a instância nas preferências. A instalação temporária desaparece ao reiniciar; distribuição permanente exige assinatura Firefox. O projeto não afirma ter uma listagem permanente de loja.

## Pacote e versões

O ZIP versionado é um artefato da extensão, não backup do servidor. A versão do manifesto é independente do pacote do servidor; uma extensão sem alterações não precisa mudar só para acompanhar o Hub. Antes de distribuir, confira conteúdo, permissões, compatibilidade e requisitos das lojas. Esta rodada não publica a extensão.

<!-- Compatibility anchors for previously published guide links. -->

<span id="chrome-edge-brave-e-vivaldi"></span>
<span id="gerar-o-pacote-para-revisao-ou-publicacao-futura"></span>
<span id="openstudyhub-como-nova-aba"></span>
