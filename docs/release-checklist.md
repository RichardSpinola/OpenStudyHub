# Publication checklist

Maintainer checklist for each release. Mark completion only after checking the exact candidate and its published artifacts.

- [ ] Review candidate source files, Git history and screenshots for private information.
- [ ] Build both documentation languages in strict mode; check links, language counterparts and responsive pages.
- [ ] Validate installer tests and one disposable clean installation; preserve production installations.
- [ ] Review version, release notes, licenses and known limitations.
- [ ] Confirm public image 3.0.0 is available before switching public Compose examples and installation claims.
- [ ] Review the existing code quality/build/test gate and reuse recorded functional validation where appropriate.
- [ ] Group pending changes into reviewable commits, preserving previous history.
- [ ] After publication approval: publish the candidate branch and tag, wait for the image workflow, verify the anonymous pull, then publish `main`, GitHub Release and documentation and verify public links.

Do not interpret a checked documentation build as a full application/security/load test. A running private instance does not by itself prove availability or correctness of the public image and GitHub Release.

<!-- Compatibility anchors for previously published guide links. -->

<span id="checklist-de-release-v2"></span>
<span id="codigo-dados-e-licencas"></span>
<span id="smoke-humano-e-publicacao"></span>
<span id="verificacoes-tecnicas"></span>
