# Notes: pages, databases and images

Open **Notes → New page**, name the page and start blank or with a template. Subject and coursework associations are optional. Pages start private. Create subpages to organize a longer subject or project.

![Notes workspace with fictional content](assets/screens/en/notes.jpg)

## Write and organize

Type `/` to insert headings, lists, checklists, quotes, code and text tables. Select text to format it; use a block handle to move it. Page options include moving, duplicating, associating, exporting and history/recovery. Text undo and database/title undo are separate controls.

## Simple databases

Add an empty, tasks or reading database. Table and Board show the same records. Records have a name and status; extra fields support text, numbers, dates and checkboxes. Move cards or change their status directly. These are lightweight study databases, not a spreadsheet with formulas or relational queries.

## Images

Use **Image** in the editor toolbar, or paste/drop an image. Preview, crop, add a caption and insert. PNG, JPEG and WebP are accepted up to 5 MB and 20 megapixels; conversion removes metadata and resizes to at most 2,560 pixels. Each page permits 50 images and 20 MB, including retained history images. Uploading needs a connection to the instance.

Images stored locally follow the page's access permissions. HTML export embeds local images; Markdown and recovery JSON retain references that need the instance's images. External images still depend on their host.

## Sharing and saving

The owner grants read or edit access to people or eligible groups. Subpages have independent permissions: sharing a parent does not automatically share every child. Group access ends when membership ends.

Editing synchronizes periodically, not through live participant cursors. **Saved** means the server acknowledged the change. When disconnected, an already open page can retain a browser draft where storage is available. Do not clear site storage before recovering it.

Download a recovery draft if needed. Import recovery JSON, Markdown or text from Notes to create a separate private page. History can restore recent versions as private copies; up to 15 snapshots are retained with a minimum 30-second interval. Permanent page deletion requires typed confirmation; subpages remain.

## Storage and limits

Notes and their private images are local instance data and work without Google; they are included in local backups, not automatically copied into Drive. Pages allow 100,000 characters, 2,500 blocks and 1.5 MB of collaborative state. A page supports 12 databases, 20 fields and 300 records per database.

The editor uses BlockNote and Yjs. [Credits and licenses](LICENSING.md) explain these dependencies. No AppFlowy or Notion source code is incorporated.

<!-- Compatibility anchors for previously published guide links. -->

<span id="bases-em-tabela-e-quadro"></span>
<span id="compartilhar"></span>
<span id="escrever-e-organizar"></span>
<span id="imagens"></span>
<span id="limites-desta-entrega"></span>
<span id="notas-paginas-e-trabalho-em-grupo"></span>
<span id="salvamento-e-recuperacao"></span>
