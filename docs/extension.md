# OpenStudyHub in your New Tab

The extension opens your chosen instance using the normal web session. It replaces the **New Tab page**, not the browser's homepage or New Window behavior. Its Manifest V3 package requests only local `storage`, not browsing history or other websites' content.

## Chromium, Chrome, Edge, Brave and Vivaldi

1. Obtain `extension/openstudyhub-new-tab/` from the trusted project source.
2. Open your browser's Extensions page, enable developer mode and choose **Load unpacked**.
3. Select the folder containing `manifest.json`.
4. Open the extension options, set a plain base URL such as `https://hub.example.org`, save and test **Open instance**.
5. Open a new tab and accept the browser's extension-selection prompt if shown.

Browser policy or another New Tab extension can prevent the override. Disable/remove the extension from the browser's manager to restore normal behavior.

## Firefox

Open `about:debugging` → This Firefox → Load Temporary Add-on and choose `manifest.json`. Configure the instance in the add-on preferences. Temporary installation disappears after restarting Firefox; permanent distribution requires Firefox signing. The project does not claim that a permanent store listing exists.

## Packaging and versions

The checked-in ZIP is an extension artifact, not a server backup. Its manifest version is independent of the server package; an unchanged extension need not be renamed solely to match the Hub. Before a future distribution, inspect archive contents, permissions, browser compatibility and store requirements. This documentation round does not publish the extension.

<!-- Compatibility anchors for previously published guide links. -->

<span id="chrome-edge-brave-e-vivaldi"></span>
<span id="gerar-o-pacote-para-revisao-ou-publicacao-futura"></span>
<span id="openstudyhub-como-nova-aba"></span>
