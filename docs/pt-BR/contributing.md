# Contribua

Use Node.js 24 e pnpm 10. Instale dependências fixadas com `pnpm install --frozen-lockfile`. Copie `.env.example` para `.env` privado, use bancos locais distintos com caminhos absolutos graváveis, aplique migrations principal/canônica e inicie desenvolvimento. Não use dados de produção.

```sh
pnpm db:migrate
node --env-file=.env scripts/migrate-v2-production.mjs
pnpm dev
```

Antes de contribuir com código, confira formatação, ESLint, TypeScript e testes relevantes. O CI existente também executa testes completos/build. Não reescreva migrations SQL aplicadas. Documente mudanças e preserve avisos de terceiros.

## Desenvolvimento da documentação

O inglês é padrão na raiz pública; Português (Brasil) espelha os mesmos guias em `/pt-BR/`. Edite ambos. Use dados fictícios e texto alternativo informativo nas capturas. Preserve URLs publicadas e evite instruções de setup duplicadas e contraditórias.

```sh
# Cria ambiente Python temporário se necessário; não inicia produção:
bash scripts/preview-docs.sh
# Compilar e conferir os dois idiomas sem servir:
bash scripts/preview-docs.sh --build-only
# Testes do instalador com Docker simulado, sem containers reais:
python3 scripts/test-install-server.py
```

A prévia escuta apenas `127.0.0.1:3080`. Encerre ao terminar. Mudanças só de documentação não exigem recompilar a imagem do aplicativo.

## Relatos e limites

Descreva resultado esperado/obtido e reprodução mínima. Use relato privado para vulnerabilidades; não cole segredos em issues. Planejamentos registram a história do desenvolvimento, não garantias atuais do produto. Publicar release, imagem ou documentação é uma ação separada do mantenedor.
