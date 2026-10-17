# Contribute

Use Node.js 24 and pnpm 10. Install the locked dependencies with `pnpm install --frozen-lockfile`. Copy `.env.example` to a private `.env`, use separate absolute writable database paths for local Node execution, apply main and canonical migrations, then start development. Do not point development at production data.

```sh
pnpm db:migrate
node --env-file=.env scripts/migrate-v2-production.mjs
pnpm dev
```

Before a code contribution, run formatting checks, ESLint, TypeScript and tests relevant to the change. The existing CI also runs full tests/build. Never rewrite applied migration SQL. Document behavior changes and preserve third-party notices.

## Documentation development

English is canonical at the public root; Português (Brasil) mirrors the same guides under `/pt-BR/`. Edit both. Use fictional data in screenshots and informative alt text. Keep legacy public page paths working; avoid duplicate contradictory setup instructions.

```sh
# Creates a temporary Python environment when needed; no production services:
bash scripts/preview-docs.sh
# Build and check both languages without serving:
bash scripts/preview-docs.sh --build-only
# Installer-focused tests (mocked Docker; no real containers):
python3 scripts/test-install-server.py
```

The preview binds only `127.0.0.1:3080`. Stop it when done. Documentation-only edits do not require rebuilding the application image.

## Reports and scope

Describe expected/actual behavior and minimal reproduction. Use private reporting for vulnerabilities; do not paste secrets into issues. Project planning records describe development history, not current product guarantees. Publishing a release, image or documentation site is a separate maintainer action.
