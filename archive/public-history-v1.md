# Arquivo histórico: publicação da V1

Este roteiro registra uma proposta antiga para a primeira publicação da V1. Ele não é um procedimento de release da V2 e fica fora do site público. Para a V2, use o [checklist atual](../docs/release-checklist.md) e revise o histórico e os dados antes de qualquer publicação.

O histórico privado de desenvolvimento não deve ser publicado se já conteve arquivos locais como `AGENTS.md` ou dados que foram removidos depois.

A opção mais simples para a primeira publicação é preservar o repositório privado local e criar um repositório Git novo a partir da árvore final auditada.

## 1. Faça um backup privado do histórico atual

Fora da pasta que será publicada:

```bash
git bundle create ../OpenStudyHub-private-history.bundle --all
```

Guarde esse bundle em local privado. Não envie ao GitHub público.

## 2. Exporte somente a árvore final

Depois da auditoria e do commit final:

```bash
mkdir -p ../OpenStudyHub-public

git archive HEAD | tar -x -C ../OpenStudyHub-public
cd ../OpenStudyHub-public
```

Confirme novamente que `.env`, bancos, uploads e arquivos privados não estão presentes.

## 3. Crie um histórico novo

```bash
git init -b main
git add .
git status
git commit -m "feat: release OpenStudyHub v1.0.0"
```

Só então adicione o remote público e faça o primeiro push, após escolher a licença e revisar o staging.

Esse método não reescreve nem destrói o repositório de desenvolvimento; simplesmente evita publicar o histórico privado antigo.
