# Modelos personalizados

OpenStudyHub não tenta reconstruir um DOCX do zero. O fluxo recomendado é
transformar seu arquivo-base em um Google Docs autorizado ao Hub e reutilizá-lo
como modelo.

## Importar um DOCX

1. Abra **Documentos → Gerenciar modelos**.
2. Escolha **Importar DOCX**.
3. Dê um nome ao modelo.
4. Escolha a categoria:
   - Atividade
   - Anotações
   - Documento
   - Outro
5. Selecione o `.docx`.
6. Importe como Google Docs.

O Drive converte o arquivo e o OpenStudyHub salva a referência autorizada pelo
scope `drive.file`.

## Usar um Google Doc existente

Quando o Google Picker estiver configurado, use **Escolher no Drive**. O Picker
concede acesso por arquivo sem exigir acesso geral ao Drive.

Colar o ID/URL de um Google Doc arbitrário não garante autorização. Com
`drive.file`, conhecer o ID não é o mesmo que ter permissão para operar naquele
arquivo.

## Preparar o layout

Faça no próprio documento-base tudo que precisa ser preservado:

- fonte;
- margens;
- cabeçalho;
- logotipo institucional;
- espaçamento;
- tabelas;
- blocos de código;
- seções fixas.

Ao gerar um documento, o Hub copia a base em vez de tentar redesenhar o layout.

## Categorias

A categoria do modelo é pré-selecionada na geração, mas pode ser alterada.

Exemplo de destino:

```text
Instituição - OSH/
  ADS/
    2026.2/
      POO/
        Atividades/
          Lista 01
```

## Compartilhar ao gerar

Se o formulário oferecer um Group, você pode registrar o compartilhamento no Hub
durante a geração. O acesso do Hub e a permissão real do Google Drive são camadas
separadas: o sistema nunca transforma o arquivo em público apenas para facilitar
o acesso.

## Boas práticas

- mantenha modelos genéricos;
- não coloque IDs reais no Git;
- evite dados pessoais no documento-base;
- prefira importar o DOCX pela própria instância;
- teste uma cópia antes de usar o modelo em uma atividade real.
