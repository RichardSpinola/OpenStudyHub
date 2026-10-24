#!/usr/bin/env bash
# New Docker installations only. Never source an instance's .env as shell code.
set -Eeuo pipefail
umask 077
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
language=en
install_dir=./openstudyhub
project=openstudyhub
app_bind=127.0.0.1
app_port=3000
admin_port=3001
app_url=
image=ghcr.io/richardspinola/openstudyhub:3.2.1
accepted=false
diagnose=false
created=false
say() { if [[ $language == pt-BR ]]; then printf '%s\n' "$2"; else printf '%s\n' "$1"; fi; }
fail() { say "$1" "$2" >&2; exit 1; }
usage() {
  if [[ $language == pt-BR ]]; then
    cat <<'PTHELP'
OpenStudyHub — nova instalação
bash scripts/install-server.sh --language pt-BR [--directory CAMINHO]
  [--project NOME] [--app-url URL] [--app-bind IPv4] [--app-port PORTA]
  [--admin-port PORTA] [--image IMAGEM:VERSÃO] [--yes] [--diagnose]
Padrões: ./openstudyhub, projeto openstudyhub, 127.0.0.1:3000 / 127.0.0.1:3001.
Requer Linux, Bash, GNU coreutils (realpath -m), awk, Docker e Compose v2.
Não instala Docker nem atualiza instâncias. Usa a imagem versionada 3.2.0.
--image permite escolher explicitamente uma imagem local confiável.
PTHELP
    return
  fi
  cat <<'HELP'
OpenStudyHub — new installation / nova instalação
bash scripts/install-server.sh [--language en|pt-BR] [--directory PATH]
  [--project NAME] [--app-url URL] [--app-bind IPv4] [--app-port PORT]
  [--admin-port PORT] [--image PINNED_IMAGE] [--yes] [--diagnose]
Defaults: ./openstudyhub, project openstudyhub, 127.0.0.1:3000 / 127.0.0.1:3001.
Requires Linux, Bash, GNU coreutils (realpath -m), awk, Docker with Compose v2. Does not install Docker or update instances.
Uses the pinned 3.2.0 image. --image may select another trusted version or local image.
HELP
}
while (($#)); do
  case $1 in
    --help|-h) usage; exit 0;;
    --yes) accepted=true; shift;;
    --diagnose) diagnose=true; shift;;
    --language|--directory|--project|--app-url|--app-bind|--app-port|--admin-port|--image)
      (($# >= 2)) || { usage >&2; exit 2; }
      case $1 in
        --language) language=$2;; --directory) install_dir=$2;; --project) project=$2;;
        --app-url) app_url=$2;; --app-bind) app_bind=$2;; --app-port) app_port=$2;;
        --admin-port) admin_port=$2;; --image) image=$2;;
      esac; shift 2;;
    *) usage >&2; exit 2;;
  esac
done
[[ $language == en || $language == pt-BR ]] || exit 2
[[ $(uname -s) == Linux ]] || fail 'Linux is required.' 'É necessário Linux.'
command -v docker >/dev/null || fail 'Docker is missing. Install Docker and Compose using the host guide first.' 'Docker ausente. Instale Docker e Compose seguindo o guia do sistema.'
for utility in realpath df awk cp mkdir rmdir chmod ls; do
  command -v "$utility" >/dev/null || fail "Missing host utility: $utility" "Utilitário ausente no host: $utility"
done
realpath -m . >/dev/null 2>&1 || fail 'GNU-compatible realpath -m is required.' 'É necessário realpath compatível com GNU (-m).'
docker info >/dev/null 2>&1 || fail 'Cannot access Docker. Check that it is running and your account has access.' 'Sem acesso ao Docker. Confira o serviço e o acesso da sua conta.'
docker compose version >/dev/null 2>&1 || fail 'Docker Compose v2 is required.' 'É necessário Docker Compose v2.'
[[ $project =~ ^[a-z0-9][a-z0-9_-]{0,47}$ ]] || fail 'Invalid project name.' 'Nome do projeto inválido.'
if ! $accepted && ! $diagnose; then
  [[ -t 0 ]] || fail 'Use an interactive terminal, or review --help and supply --yes.' 'Use um terminal interativo ou confira --help e forneça --yes.'
  read -r -p "$(say 'Installation directory' 'Diretório da instalação') [$install_dir]: " choice; install_dir=${choice:-$install_dir}
  read -r -p "$(say 'App bind IPv4 (0.0.0.0 explicitly exposes it)' 'IPv4 do App (0.0.0.0 expõe o serviço explicitamente)') [$app_bind]: " choice; app_bind=${choice:-$app_bind}
  read -r -p "$(say 'App port' 'Porta do App') [$app_port]: " choice; app_port=${choice:-$app_port}
  read -r -p "$(say 'Admin port (localhost only)' 'Porta do Admin (somente localhost)') [$admin_port]: " choice; admin_port=${choice:-$admin_port}
  read -r -p "$(say 'App URL' 'URL do App') [${app_url:-http://127.0.0.1:$app_port}]: " choice; app_url=${choice:-$app_url}
fi
[[ $app_port =~ ^[0-9]{1,5}$ && $admin_port =~ ^[0-9]{1,5}$ ]] || exit 2
((10#$app_port >= 1024 && 10#$app_port <= 65535 && 10#$admin_port >= 1024 && 10#$admin_port <= 65535 && 10#$app_port != 10#$admin_port)) || fail 'Use two different ports between 1024 and 65535.' 'Use duas portas diferentes entre 1024 e 65535.'
app_port=$((10#$app_port)); admin_port=$((10#$admin_port))
[[ $image =~ ^[a-zA-Z0-9][a-zA-Z0-9._/@:-]+$ && $image == *:* && $image != *:latest ]] || fail 'Choose an explicit image version.' 'Escolha uma versão explícita da imagem.'
[[ -n $install_dir && $install_dir != *$'\n'* ]] || exit 2
# Canonicalize without creating directories during diagnosis/preflight.
install_dir=$(realpath -m -- "$install_dir")
if $diagnose && [[ -f $install_dir/instance-project ]]; then
  IFS= read -r project < "$install_dir/instance-project"
  [[ $project =~ ^[a-z0-9][a-z0-9_-]{0,47}$ ]] || exit 2
fi
compose_file="$install_dir/compose.yml"
compose=(docker compose --project-name "$project" --project-directory "$install_dir" --env-file "$install_dir/.env" -f "$compose_file")
if $diagnose; then
  [[ -f $compose_file && -f $install_dir/.env ]] || fail 'No installer-managed configuration found at this path.' 'Não há configuração criada pelo instalador neste caminho.'
  "${compose[@]}" config --quiet 2>/dev/null || fail 'Configuration is invalid. Review it privately; do not share secrets.' 'Configuração inválida. Revise em privado; não compartilhe segredos.'
  say 'Services (no environment values):' 'Serviços (sem valores do ambiente):'
  "${compose[@]}" ps --all
  "${compose[@]}" exec -T openstudyhub-app node -e 'fetch("http://127.0.0.1:3000/api/health",{signal:AbortSignal.timeout(2000)}).then(async r=>{console.log("App health: "+r.status);if(!r.ok)process.exitCode=1}).catch(()=>{console.error("App health unavailable");process.exitCode=1})'
  "${compose[@]}" exec -T openstudyhub-admin node -e 'fetch("http://127.0.0.1:3000/control/login",{signal:AbortSignal.timeout(2000)}).then(r=>{console.log("Admin HTTP: "+r.status);if(!r.ok)process.exitCode=1}).catch(()=>process.exitCode=1)'
  "${compose[@]}" exec -T openstudyhub-app node -e '(async()=>{for(const [name,url] of [["Proxy","http://openstudyhub-web:3000/api/health"],["Realtime","http://openstudyhub-realtime:3045/health"]]){const r=await fetch(url,{signal:AbortSignal.timeout(2000)});console.log(name+" HTTP: "+r.status);if(!r.ok)process.exitCode=1}})().catch(()=>{console.error("Proxy/realtime health unavailable");process.exitCode=1})'
  "${compose[@]}" exec -T openstudyhub-app node -p '"Version: "+require("./package.json").version'
  exit 0
fi
# Existing configuration/data are never adopted, overwritten or removed.
[[ ! -e $install_dir || (-d $install_dir && -z $(ls -A -- "$install_dir")) ]] || fail 'Directory is not empty. Use the update guide for an existing instance.' 'Diretório não está vazio. Use o guia de atualização para uma instância existente.'
existing=$(docker ps -aq --filter "label=com.docker.compose.project=$project")
volumes=$(docker volume ls -q --filter "label=com.docker.compose.project=$project")
[[ -z $existing && -z $volumes ]] || fail 'This Docker project already exists. Use another name only for a separate new instance.' 'Este projeto Docker já existe. Outro nome serve apenas para uma instância nova separada.'

app_url=${app_url:-http://127.0.0.1:$app_port}
[[ $app_url =~ ^https?://[a-zA-Z0-9.-]+(:[0-9]{1,5})?/?$ ]] || fail 'Use a plain HTTP(S) origin without credentials, paths or queries.' 'Use uma origem HTTP(S) sem credenciais, caminhos ou parâmetros.'
say 'Review installation:'  'Confira a instalação:'
printf "$(say '  Directory: %s\n  Project: %s\n  Image: %s\n  App: %s:%s\n  Admin: 127.0.0.1:%s\n  URL: %s\n' '  Diretório: %s\n  Projeto: %s\n  Imagem: %s\n  App: %s:%s\n  Admin: 127.0.0.1:%s\n  URL: %s\n')" "$install_dir" "$project" "$image" "$app_bind" "$app_port" "$admin_port" "$app_url"
if ! $accepted; then
  read -r -p "$(say 'Continue? Type yes: ' 'Continuar? Digite yes: ')" answer
  [[ $answer == yes ]] || exit 0
fi
parent=$install_dir
while [[ ! -d $parent ]]; do parent=$(dirname -- "$parent"); done
free_kib=$(df -Pk -- "$parent" | awk 'END {print $4}')
[[ $free_kib =~ ^[0-9]+$ ]] && ((free_kib >= 2097152)) || fail 'At least 2 GiB free is required for initial data; reserve more for uploads and backups.' 'São necessários ao menos 2 GiB livres para os dados iniciais; reserve mais para uploads e backups.'
# No pull if a trusted, explicitly pinned image is already present locally.
if ! docker image inspect "$image" >/dev/null 2>&1; then
  docker pull "$image" >/dev/null || fail 'Image unavailable. Check the version, registry access and network. No installation files were written.' 'Imagem indisponível. Confira a versão, o acesso ao registro e a rede. Nenhum arquivo de instalação foi gravado.'
fi
# Validate values in Node before they become dotenv/Compose input. Test actual port binding.
docker run --rm --network host --entrypoint node "$image" -e '
const net=require("node:net"); const [bind,p,a,address]=process.argv.slice(1);
(async()=>{const oct=bind.split(".");if(oct.length!==4||oct.some(x=>!/^\d{1,3}$/.test(x)||+x>255))throw Error("Invalid IPv4");
const u=new URL(address);if(!["http:","https:"].includes(u.protocol)||u.username||u.password||u.pathname!=="/"||u.search||u.hash||/[\s\u0024\u0022\u0027\\]/.test(address))throw Error("Use a plain HTTP(S) origin");
for(const [host,port] of [[bind,+p],["127.0.0.1",+a]])await new Promise((ok,no)=>{const s=net.createServer();s.once("error",no);s.listen(port,host,()=>s.close(ok))});
})().catch(()=>{console.error("Invalid address, unavailable bind address, or occupied port.");process.exitCode=1});' "$app_bind" "$app_port" "$admin_port" "$app_url" || fail 'Address/port check failed; no files were written.' 'Falha na validação do endereço/porta; nenhum arquivo foi gravado.'
[[ -f $repo_root/deploy/install-compose.yml && -f $repo_root/deploy/Caddyfile ]] || fail 'Run from a complete project checkout/release bundle.' 'Execute a partir de uma cópia completa do projeto/pacote de release.'
# mkdir is deliberately exclusive to avoid adopting a directory created concurrently.
if [[ -d $install_dir ]]; then rmdir -- "$install_dir"; fi
mkdir -p -- "$(dirname -- "$install_dir")"
mkdir -m 700 -- "$install_dir"
created=true
printf '%s\n' "$project" > "$install_dir/instance-project"
trap 'status=$?; if ((status != 0)) && $created; then say "Installation stopped. Files and volumes were preserved. Review the private install.log and run --diagnose; do not delete volumes." "Instalação interrompida. Arquivos e volumes preservados. Confira install.log em privado e use --diagnose; não apague volumes." >&2; fi' EXIT
cp -- "$repo_root/deploy/install-compose.yml" "$compose_file"
cp -- "$repo_root/deploy/Caddyfile" "$install_dir/Caddyfile"
key=$(docker run --rm --network none --entrypoint node "$image" -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("base64"))')
[[ $key =~ ^[A-Za-z0-9+/]{43}=$ ]] || fail 'Key generation failed.' 'Falha ao gerar chave.'
ws_url=${app_url/#https:/wss:}; ws_url=${ws_url/#http:/ws:}
cat > "$install_dir/.env" <<ENV
NODE_ENV=production
APP_NAME=OpenStudyHub
APP_URL=${app_url%/}
OPENSTUDYHUB_IMAGE=$image
OPENSTUDYHUB_APP_BIND=$app_bind
OPENSTUDYHUB_APP_PORT=$app_port
OPENSTUDYHUB_ADMIN_BIND=127.0.0.1
OPENSTUDYHUB_ADMIN_PORT=$admin_port
OPENSTUDYHUB_REALTIME_PUBLIC_URL=${ws_url%/}/realtime
GOOGLE_TOKEN_ENCRYPTION_KEY=$key
ENV
unset key
chmod 600 "$install_dir/.env" "$compose_file" "$install_dir/Caddyfile"
# Raw service logs are private and never echoed by the installer/diagnostic.
if ! { "${compose[@]}" config --quiet && "${compose[@]}" run --rm --no-deps openstudyhub-migrate && "${compose[@]}" up -d; } > "$install_dir/install.log" 2>&1; then exit 1; fi
ready=false
for ((attempt=0;attempt<60;attempt++)); do
  if "${compose[@]}" exec -T openstudyhub-app node -e 'fetch("http://127.0.0.1:3000/api/health",{signal:AbortSignal.timeout(2000)}).then(r=>{if(!r.ok)process.exitCode=1}).catch(()=>process.exitCode=1)' >/dev/null 2>&1 &&
     "${compose[@]}" exec -T openstudyhub-admin node -e 'fetch("http://127.0.0.1:3000/control/setup",{signal:AbortSignal.timeout(2000)}).then(r=>{if(!r.ok)process.exitCode=1}).catch(()=>process.exitCode=1)' >/dev/null 2>&1 &&
     "${compose[@]}" exec -T openstudyhub-app node -e 'Promise.all(["http://openstudyhub-web:3000/api/health","http://openstudyhub-realtime:3045/health"].map(async u=>{const r=await fetch(u,{signal:AbortSignal.timeout(2000)});if(!r.ok)throw Error("unhealthy")})).catch(()=>process.exitCode=1)' >/dev/null 2>&1; then ready=true; break; fi
  sleep 2
done
$ready || fail 'Services did not become ready. Configuration and data were preserved.' 'Os serviços não ficaram prontos. Configuração e dados foram preservados.'
say 'Installation ready. Complete first-run setup in the private Admin.' 'Instalação pronta. Conclua a configuração inicial no Admin privado.'
printf 'App: %s\nAdmin: http://127.0.0.1:%s/control/setup\n' "$app_url" "$admin_port"
say 'Remote server: forward the Admin port with SSH; see the installation guide. Google is optional and configured later.' 'Servidor remoto: encaminhe a porta do Admin por SSH; veja o guia de instalação. Google é opcional e pode ser configurado depois.'
