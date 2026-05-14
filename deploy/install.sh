#!/usr/bin/env bash
#
# Post-clone deploy para pao.brasume.com no VPS brasume.
# Assume:
#   - Apache2 + Certbot já instalados e configurados (outros sites a correr)
#   - Utilizador 'ember' e grupo 'http-web' já existem
#   - Node 22 disponível no PATH (NodeSource ou similar)
#   - Repo clonado em /var/www/pao
#
# Idempotente. Correr como ember (com sudo onde indicado).
#
# Uso:
#   cd /var/www/pao
#   sudo bash deploy/install.sh

set -euo pipefail

REPO_DIR="${REPO_DIR:-/var/www/pao}"
APP_USER="ember"
APP_GROUP="http-web"
DATA_DIR="$REPO_DIR/data"
DOMAIN="pao.brasume.com"

if [[ $EUID -ne 0 ]]; then
  echo "[!] Correr com sudo." >&2
  exit 1
fi

if [[ ! -d "$REPO_DIR" ]]; then
  echo "[!] $REPO_DIR não existe. Faz git clone para esse caminho primeiro." >&2
  exit 1
fi

if [[ ! -f "$REPO_DIR/.env" ]]; then
  cat >&2 <<EOF
[!] $REPO_DIR/.env não existe. Cria-o primeiro:
    sudo -u $APP_USER cp $REPO_DIR/.env.example $REPO_DIR/.env
    sudo -u $APP_USER \$EDITOR $REPO_DIR/.env
        # set NODE_ENV=production, ADMIN_PASSWORD, ADMIN_SESSION_SECRET (>=16)
EOF
  exit 1
fi

echo "==> 1. Permissões do repo (ember:http-web)"
chown -R "$APP_USER:$APP_GROUP" "$REPO_DIR"
install -d -o "$APP_USER" -g "$APP_GROUP" -m 0750 "$DATA_DIR" "$DATA_DIR/backups"

echo "==> 2. Confirmar Node 22"
NODE_V="$(sudo -u "$APP_USER" node -v 2>/dev/null || true)"
if [[ ! "$NODE_V" =~ ^v22\. ]]; then
  echo "[!] Node 22 não detectado para $APP_USER (got: '$NODE_V')." >&2
  echo "    Instala via NodeSource:  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash - && sudo apt-get install -y nodejs" >&2
  exit 1
fi

echo "==> 3. Módulos Apache necessários"
a2enmod proxy proxy_http rewrite headers ssl deflate mime >/dev/null

echo "==> 4. npm ci + build + seed (como $APP_USER)"
sudo -u "$APP_USER" bash -lc "cd '$REPO_DIR' && npm ci && npm run build && npm run db:seed"

echo "==> 5. systemd unit"
install -m 0644 "$REPO_DIR/deploy/systemd/pao.service" /etc/systemd/system/pao.service
systemctl daemon-reload
systemctl enable --now pao
systemctl status pao --no-pager -l | head -8 || true

echo "==> 6. Vhost Apache (se ainda não existir)"
VHOST_DST="/etc/apache2/sites-available/$DOMAIN.conf"
if [[ ! -f "$VHOST_DST" ]]; then
  install -m 0644 "$REPO_DIR/scripts/apache/$DOMAIN.conf.example" "$VHOST_DST"
  a2ensite "$DOMAIN.conf" >/dev/null
  # Pré-cert: comentar o redirect HTTP→HTTPS para o desafio HTTP-01 funcionar
  sed -i 's|^  RewriteEngine On|  #RewriteEngine On|; s|^  RewriteCond %{SERVER_NAME}|  #RewriteCond %{SERVER_NAME}|; s|^  RewriteRule \^ https|  #RewriteRule ^ https|' "$VHOST_DST"
  apache2ctl configtest
  systemctl reload apache2
  echo "    Vhost instalado com o redirect HTTP comentado (até o Certbot correr)."
else
  echo "    $VHOST_DST já existe — não toco."
fi

echo "==> 7. Cron diário de backup"
install -m 0755 "$REPO_DIR/deploy/cron/pao-backup" /etc/cron.daily/pao-backup

echo
echo "==> Pronto. Falta:"
echo
echo "  sudo certbot --apache -d $DOMAIN --redirect --hsts --staple-ocsp \\"
echo "      --agree-tos -m webmaster@brasume.com --no-eff-email"
echo
echo "  # depois (o cert popula os paths /etc/letsencrypt/live/$DOMAIN/...):"
echo "  sudo sed -i 's|^  #RewriteEngine On|  RewriteEngine On|; s|^  #RewriteCond %{SERVER_NAME}|  RewriteCond %{SERVER_NAME}|; s|^  #RewriteRule \^ https|  RewriteRule ^ https|' $VHOST_DST"
echo "  sudo apache2ctl configtest && sudo systemctl reload apache2"
echo
echo "  curl -I https://$DOMAIN/healthz"
