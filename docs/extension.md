# OpenStudyHub como Nova Aba

Se você abre o OpenStudyHub várias vezes ao dia, a extensão pode colocá-lo na Nova Aba. Ela usa a URL da sua instância e o login normal do site. O mesmo código em [`extension/openstudyhub-new-tab/`](https://github.com/RichardSpinola/OpenStudyHub/tree/main/extension/openstudyhub-new-tab) serve a Chrome/Chromium e Firefox. Usa Manifest V3 e [`chrome_url_overrides.newtab`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/chrome_url_overrides), que substitui **Nova Aba**; não muda a página inicial nem a janela inicial do navegador. Edge, Brave e Vivaldi podem usar o pacote Chromium quando aceitam esse recurso.

## Chrome, Edge, Brave e Vivaldi

1. Abra a página de extensões do navegador: `chrome://extensions`, `edge://extensions`, `brave://extensions` ou `vivaldi://extensions`.
2. Ative o modo de desenvolvedor e escolha **Carregar sem compactação**.
3. Selecione a pasta `extension/openstudyhub-new-tab`, que contém `manifest.json`.
4. Abra os detalhes da extensão e escolha **Opções**. Informe somente a URL base da instância, como `https://hub.example.org` ou `http://127.0.0.1:3000`, e salve.
5. Use **Abrir instância** para conferir o endereço. Abra uma nova aba para testar a substituição. Se o navegador perguntar qual extensão controla a Nova Aba, escolha OpenStudyHub.

## Firefox

1. Abra `about:debugging` e escolha **Este Firefox**.
2. Clique em **Carregar extensão temporária** e selecione `extension/openstudyhub-new-tab/manifest.json`.
3. Em `about:addons`, abra as preferências da extensão, informe a URL base da instância e salve.
4. Clique em **Abrir instância** e depois abra uma nova aba.

O carregamento temporário [não persiste após reiniciar o Firefox](https://www.extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/). Uma instalação permanente exige pacote assinado pela Mozilla; esta fase não publica nem assina a extensão. A configuração `browser_specific_settings.gecko` no mesmo manifesto prepara o pacote para assinatura futura e declara ausência de coleta de dados. O mecanismo [New Tab do Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/chrome_url_overrides) é diferente de configurar Home ou New Window.

A URL fica armazenada localmente no navegador. A extensão não contém senha, token nem sessão: o login é o login web normal do OpenStudyHub. Ela não pede acesso ao histórico, às abas existentes, ao conteúdo de sites ou ao provedor de pesquisa. A única permissão declarada é [`storage`](https://developer.chrome.com/docs/extensions/reference/api/storage), necessária para guardar a URL. `chrome.tabs` e host permissions não são necessários.

Se não houver URL configurada, a Nova Aba mostra um botão para abrir as opções. O modo anônimo pode manter a Nova Aba própria do navegador, conforme a [documentação do Chrome](https://developer.chrome.com/docs/extensions/develop/ui/override-chrome-pages). A extensão precisa que a instância seja acessível pelo navegador; ela não inicia o servidor. Para desabilitar ou remover, use a página de extensões ou complementos do navegador; sua configuração local poderá ser apagada ao remover a extensão.

## Gerar o pacote para revisão ou publicação futura

Na raiz do repositório:

```sh
cd extension/openstudyhub-new-tab
zip -r ../openstudyhub-new-tab.zip manifest.json newtab.html newtab.js options.html options.js style.css icons
```

O ZIP gerado é um artefato temporário; `manifest.json` deve ficar na raiz do ZIP. Antes de publicar numa loja, revisar a versão, descrição, imagens de listagem, política de privacidade aplicável e as [políticas da Chrome Web Store](https://developer.chrome.com/docs/webstore/program-policies/policies). Esta fase não publica a extensão.
