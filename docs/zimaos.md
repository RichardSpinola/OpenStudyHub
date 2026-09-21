# ZimaOS

ZimaOS é um ambiente possível para hospedar OpenStudyHub; não é requisito do
projeto.

A V1 distribui um Dockerfile e um Compose genéricos. O objetivo é manter o mesmo
container portátil entre ZimaOS e outros hosts Linux.

## Estratégia recomendada

1. mantenha um diretório persistente para `/app/data`;
2. importe/adapte `docker-compose.example.yml`;
3. não exponha o Docker socket ao container;
4. publique o Hub somente atrás de HTTPS/reverse proxy;
5. configure `APP_URL` e `GOOGLE_REDIRECT_URI` com a URL externa real;
6. valide `/api/health` antes de conectar Google.

A interface exata de instalação do ZimaOS pode mudar. Por isso o guia público
documenta os requisitos do container, e não depende de um botão específico da
UI do ZimaOS.

Quando você fizer a instalação real pela primeira vez, use
[Instalação do zero](instalacao-do-zero.md) como checklist e registre qualquer
diferença necessária neste guia.
