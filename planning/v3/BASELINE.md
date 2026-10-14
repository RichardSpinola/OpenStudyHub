# Etapa zero — base consolidada

## Origem e proteção

- Base `efe06fc`: hotfix de cookie do Control Plane em HTTP LAN. Histórico público preservado, incluindo `90a5812`.
- Branch local `v3-dev`, vinculada ao mesmo repositório público OpenStudyHub.
- Incorporados 16 arquivos das correções locais pós-release, conferidos byte a byte contra a origem. Nenhum banco, configuração particular ou nota privada transportado.
- Documentação/Compose ZimaOS e CasaOS já estavam na hotfix, em 2.0.1; versões anteriores não substituíram essas correções.
- Patches preservam credencial central para novos Projects, dono antigo de projetos vinculados, destino pessoal dos documentos, identidade Google, compartilhamento do documento e proteção contra troca silenciosa da raiz.
- Esses patches são a base, não a solução completa da V3: proprietário em app_settings, dependência legada e política fixa permanecem no backlog.
- Dependências locais reaproveitadas por link ignorado no Git. Pacote/lockfile intactos; instalação independente será validada no checkpoint apropriado.
- V2 preservada. Não houve deploy, reset, migração da instalação nem envio ao GitHub.

## Arquivos incorporados

| Arquivo                                                                 | SHA-256                                                            |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/app/api/projects/[projectId]/preview/route.ts`                     | `e523c7eb16c4cd605a1b319485b5abecb4edac9e1da9ea1210ee5c0bbf0687cd` |
| `src/app/api/projects/[projectId]/versions/[version]/download/route.ts` | `b3ab23f02c3a88b664f6778332f302f7f9f0396dbfdf6f5ec077e4f4661d0bd7` |
| `src/app/control/google/page.tsx`                                       | `28025ea0ef55d4759bee37e4cb50ce1b1626ae59ec8f5c9826e277f9db533341` |
| `src/app/documents/actions.ts`                                          | `490cb883cb88b3c8694f0a168ade724b06fc7ec8c0549197f80664014ab13837` |
| `src/app/documents/page.tsx`                                            | `6d5364ab05fc8a600cf379398ed9c5ca8e9438614905d205bce03782cf8c6151` |
| `src/app/projects/[projectId]/page.tsx`                                 | `1032058a5592c38883bce76869fdb9a007ed651e0846fbc88202ca96b3b2b4ed` |
| `src/app/subjects/[subjectId]/page.tsx`                                 | `58a2b015a862e6c5b638661e63d8424c524a4f620c5c8638e6cfac2b72ab2054` |
| `src/lib/document-workflows.ts`                                         | `f114d236a53c948c5330f355cba27284407385f1238ff663eaf33c666e17f278` |
| `src/lib/google/drive.test.ts`                                          | `7d7a02f410f0e2e43a35486d2c9b72bd7db672cf0a058dfeead9fcec8981bdf6` |
| `src/lib/google/drive.ts`                                               | `7a7f60d2e84724b5ae7827f2d118f1bf16fe97a428627802bb0613d4833870be` |
| `src/lib/google/storage-owner.ts`                                       | `72d3d7dea1e9b46295a143f136d30d3822419a3c683390055e3ff489f2702f12` |
| `src/lib/projects.test.ts`                                              | `d7a58e55798fc3b6346c1fd3c0642e5a7fd30c78b4b1a8a63ec68cc531eafff7` |
| `src/lib/projects.ts`                                                   | `50b760c3213334e404da348f95cdeeace1dc5ac7f789f61442ee8c0453e77fef` |
| `src/lib/v2/drive-storage.ts`                                           | `f080c3fc499205c3f615f453a6835b606b869e17106ab4777fd537d81a971978` |
| `src/lib/v2/google-oauth.ts`                                            | `67e4105957a5ab343d7d8c6ed22d966dac6683f1e3bb7c81a32442037a4d124e` |
| `src/lib/v2/google-phase3.test.ts`                                      | `06fe11d3a4413522418d4087790c5c37d39b2b5ea3228951ca6fbd8ad9e7839d` |

## Evidências

- 42 testes passaram em 6 arquivos: Projects, Drive, geração de documentos, Google V2, superfícies e leitura acadêmica.
- 5 testes adicionais passaram em 2 arquivos, filtrados para setup, grants, CRUD e preservação de histórico. Outros 16 ignorados intencionalmente pelo filtro.
- Cookie de sessão: 3 testes passaram. Total desta etapa: **50 testes aprovados em 9 arquivos**, além dos 16 ignorados pelo filtro de fluxos.
- Typecheck: PASS. ESLint dos 16 arquivos incorporados e script da prévia: PASS. Formatação dos arquivos incorporados e da prévia: PASS.
- 48 rotas de página inventariadas; 34 achados técnicos e 20 grupos de pedidos mapeados às etapas.
- Quatro prévias nos dois temas: 16 composições em largura de conteúdo 390 px e automática observada de 1265 px, sem overflow horizontal. Biblioteca/disciplina também conferidas em 1024 px.
- Filtro de documento, alternância de projetos, diálogo fictício e troca de aba da disciplina conferidos.
- SSH somente leitura: App, Admin e realtime saudáveis; App/Admin/realtime/proxy somaram cerca de 423 MiB na amostra. Uma amostra não representa pico de carga ou meta garantida.

## Limites

Revisão de código/inventário e padrões, apoiada nas capturas fornecidas; não uma execução visual de cada uma das 48 páginas. Testes isolados não aprovam automaticamente todos os fluxos no navegador. Sintomas não reproduzidos continuam no backlog.

OAuth real, Google externo, atualização do servidor, migrations, full suite e build não repetidos nesta preparação. Não afirmar que as atividades dos demais usuários foram corrigidas por este checkpoint.

Prévia é simulação, não substituição obrigatória do layout. Áreas originais boas serão conservadas. Busca e cadastro na prévia são demonstrações locais, sem serviço externo nem gravação real.

## Para conferir

Abra a prévia, alterne Tela/Tema e compare a largura normal com 390 px. Avalie a biblioteca, o agrupamento do Admin e a posição independente de Ações/Aulas. Esta etapa termina com preparação técnica e proposta visual; a direção ainda pode receber seus ajustes antes da implementação.
