# OpenStudyHub v2.0.1 — hotfix

Corrige o loop de login do Control Plane quando o App usa HTTPS e o Admin é aberto por HTTP no IP da LAN. O cookie de sessão agora segue a origem real: permanece `Secure` no App HTTPS e funciona no Admin HTTP local, sem remover `HttpOnly`, `SameSite=Lax` ou a revogação no logout.

Esta versão também prepara o Compose de importação gráfica do ZimaOS/CasaOS com os cinco serviços, proxy embutido, card principal do App e volume Docker persistente. Para atualizar, faça backup dos dados e use a imagem fixa `ghcr.io/richardspinola/openstudyhub:2.0.1` após sua publicação. Não exponha o Admin publicamente; HTTP na LAN não criptografa senha nem cookie.
