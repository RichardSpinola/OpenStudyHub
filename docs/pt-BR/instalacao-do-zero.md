# Instale um servidor novo

## Antes de começar

Use um servidor Linux com Docker Engine e Docker Compose v2 funcionando, Bash, GNU coreutils (incluindo `realpath -m`), `awk` e ao menos 2 GiB livres para os dados iniciais. Uploads, imagens e backups exigem mais espaço. O instalador não instala Docker, configura DNS/TLS/firewall nem atualiza instâncias existentes. Ele usa imagens prontas, sem compilar o projeto no servidor.

O instalador usa a imagem fixa `ghcr.io/richardspinola/openstudyhub:3.2.1`. Confira as [notas da release](https://github.com/RichardSpinola/OpenStudyHub/releases/tag/v3.2.0) antes de instalar. Use `--image` apenas para escolher outra imagem confiável com versão explícita.

## 1. Obtenha e confira o projeto

Use uma cópia completa ou pacote de código-fonte do [repositório oficial](https://github.com/RichardSpinola/OpenStudyHub). Execute a partir dessa cópia; baixar apenas o script não basta, pois ele usa os modelos de implantação. Confira `scripts/install-server.sh` antes de executar. Não é necessário usar `curl | sudo bash`.

## 2. Execute o assistente

```sh
bash scripts/install-server.sh --language pt-BR
# Interface em inglês (padrão):
bash scripts/install-server.sh
```

Os padrões são diretório `./openstudyhub`, App `127.0.0.1:3000` e Admin `127.0.0.1:3001`. O assistente solicita diretório, endereço de escuta, portas e URL usada pelas pessoas. Mostra um resumo e pede `yes` antes de continuar. Escolher `0.0.0.0` expõe o App nas interfaces do servidor; configure a proteção da rede/sistema por conta própria. O Admin permanece em localhost.

Para uma configuração repetível, informe os valores e use `--yes` somente depois de conferi-los:

```sh
bash scripts/install-server.sh --language pt-BR --directory ./openstudyhub   --project openstudyhub --app-url http://127.0.0.1:3000   --app-bind 127.0.0.1 --app-port 3000 --admin-port 3001 --yes
```

O instalador verifica acesso ao Docker, projeto/volumes existentes, portas e espaço; cria configuração privada com chave aleatória; executa as duas migrations; inicia cinco serviços e confere se respondem. Ele não assume uma instância existente. Se parar, preserve diretório, volume e `install.log` privado; veja [solução de problemas](troubleshooting.md). Não apague o volume para tentar novamente.

## 3. Abra o Admin privado

No servidor: `http://127.0.0.1:3001/control/setup`. Para um servidor remoto, encaminhe a porta a partir do seu computador:

```sh
ssh -N -L 3001:127.0.0.1:3001 SEU_USUARIO@SEU_SERVIDOR
```

Abra o mesmo endereço localhost no seu computador. Se a porta local 3001 estiver ocupada, mude apenas a primeira porta do comando e abra essa porta. Use sua conta SSH, não o usuário do OpenStudyHub.

Conclua idioma, primeiro Admin, instituição, curso e estrutura acadêmica; confira o resumo. As credenciais são criadas nessa tela, não pelo instalador. As contas dos estudantes são administradas separadamente pelo Admin.

## 4. Publique o App quando estiver pronto

Encaminhe apenas o App pelo proxy/túnel HTTPS. Defina `APP_URL` com a origem pública exata e `OPENSTUDYHUB_REALTIME_PUBLIC_URL` com `wss://.../realtime`; mantenha as rotas WebSocket `/realtime` e `/whiteboard`. Reinicie após alterar a configuração. O Admin continua privado.

Google e autocomplete Brave podem ser configurados depois. Veja [Google](google.md) e [implantação](deployment.md).

## Diagnóstico sem mudar dados

```sh
bash scripts/install-server.sh --language pt-BR --diagnose --directory ./openstudyhub
```

Valida o Compose, lista estados dos serviços e confere App/Admin, proxy, realtime e versão sem imprimir valores do ambiente. O instalador registra nomes personalizados de projeto. Logs brutos podem conter informações privadas: confira-os em particular.

## Opções do instalador

| Opção                                     | Finalidade                                                                              |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| `--language en` / `--language pt-BR`      | Idioma do instalador; inglês é o padrão.                                                |
| `--directory CAMINHO`                     | Diretório novo e vazio. Nunca indique uma instância existente.                          |
| `--project NOME`                          | Nome único do projeto Docker Compose, registrado para diagnóstico.                      |
| `--app-bind IPv4`                         | Padrão `127.0.0.1`. Escolha uma interface privada ou `0.0.0.0` explicitamente.          |
| `--app-port PORTA` / `--admin-port PORTA` | Duas portas diferentes de 1024 a 65535. Admin permanece em localhost.                   |
| `--app-url URL`                           | Origem HTTP(S) exata, sem caminho, parâmetros ou credenciais.                           |
| `--image IMAGEM:VERSÃO`                   | Versão explícita e confiável, sem `latest`. Padrão: imagem pública 3.2.0.               |
| `--yes`                                   | Aceita a configuração exibida sem confirmação interativa.                               |
| `--diagnose`                              | Confere instância criada pelo instalador sem iniciar serviços nem alterar configuração. |
| `--help`                                  | Mostra a forma de uso.                                                                  |

O instalador grava `compose.yml`, `Caddyfile`, `.env`, `instance-project` e `install.log` privado no diretório escolhido. Os dados do aplicativo ficam no volume Docker nomeado, não junto do `.env`. Preserve o backup do volume e a configuração privada, principalmente a chave de criptografia.

<!-- Compatibility anchors for previously published guide links. -->

<span id="1-escolha-o-endereco-publico"></span>
<span id="10-backup-inicial"></span>
<span id="2-prepare-os-dados-persistentes"></span>
<span id="3-crie-o-env"></span>
<span id="4-suba-a-aplicacao"></span>
<span id="5-faca-o-primeiro-setup"></span>
<span id="6-configure-google-do-zero"></span>
<span id="7-defina-a-conta-de-armazenamento"></span>
<span id="8-cadastre-usuarios-e-offerings"></span>
<span id="9-teste-antes-de-colocar-dados-reais"></span>
<span id="instalacao-do-zero"></span>
