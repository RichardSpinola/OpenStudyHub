# Checklist de publicação

Checklist do mantenedor para cada release. Marque a conclusão somente depois de conferir o candidato exato e os artefatos publicados.

- [ ] Revisar arquivos candidatos, histórico Git e capturas para dados privados.
- [ ] Compilar os dois idiomas em modo estrito; conferir links, equivalência e responsividade.
- [ ] Validar testes do instalador e uma instalação limpa descartável; preservar produção.
- [ ] Conferir versão, notas, licenças e limites conhecidos.
- [ ] Confirmar a imagem pública da nova versão antes de alterar exemplos Compose e afirmar disponibilidade.
- [ ] Conferir gate existente de qualidade/build/testes e reutilizar validações funcionais registradas quando adequado.
- [ ] Agrupar mudanças em commits revisáveis, preservando histórico.
- [ ] Após aprovação: enviar branch candidata e tag, aguardar o workflow da imagem, conferir download anônimo e então publicar `main`, GitHub Release e documentação; conferir links públicos.

Um build documental aprovado não equivale a teste completo do aplicativo/segurança/carga. Uma instância privada em execução não comprova, por si só, a disponibilidade ou correção da imagem pública e da GitHub Release.

<!-- Compatibility anchors for previously published guide links. -->

<span id="checklist-de-release-v2"></span>
<span id="codigo-dados-e-licencas"></span>
<span id="smoke-humano-e-publicacao"></span>
<span id="verificacoes-tecnicas"></span>
