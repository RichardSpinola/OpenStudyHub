# Generic document template examples

This directory contains neutral, optional reference documents for OpenStudyHub
Document Automation. They are examples only: migrations do not import or enable
them, and an installation may use completely different templates.

The DOCX files are visual references. In Documents, importing one of these
examples explicitly creates an app-owned Google Doc with the corresponding
placeholder and section configuration; the user can then style that source in
Google Docs. The source Google Doc remains canonical, while OpenStudyHub stores
only its ID, template configuration and generated-file metadata.

The examples use canonical `{{placeholder}}` values described by
`template-manifest.json`. Google Docs generation replaces known placeholders,
leaves missing optional values blank, copies the source instead of editing it,
and writes the result to the configured Subject Offering Drive folder.

For custom section placement, include `{{document.sections}}` in the Google Doc.
If a legacy template does not contain that marker, OpenStudyHub appends the
configured sections to the end of the generated copy.

Configuring any other existing file must still satisfy Google `drive.file`
access. Leaving the source field empty while creating a template also asks
OpenStudyHub to create an app-owned basic Google Doc that can then be styled
directly in Google Docs.
