#!/usr/bin/env bash
#
# Provisioning chave-na-mão para pao.brasume.com — Apache2 + Node 22 + systemd.
# Correr como root (ou via sudo) num Debian/Ubuntu recente.
#
# Idempotente: pode ser re-executado em segurança.
#
# Uso:
#   sudo bash deploy/install.sh /caminho/para/clone/pao
#
# Onde "/caminho/para/clone/pao" é a directoria onde já clonaste este repo
# (incluindo o sub-directório dist-server e client/dist do build de produção).

set -euo pipefail

REPO_DIR="${1:-/opt/pao/app}"
APP_USER="pao"
APP_HOME="/opt/pao"
DATA_DIR="/var/lib/pao"
DOMAIN="pao.brasume.com"
ADMIN_EMAIL="webmaster@brasume.com"

if [[ $EUID -ne 0 ]]; then
  echo "[!] Correr como root (sudo)." >&2
  exit 1
fi

echo "==> 1. Pacotes base"
apt-get update
apt-get install -y --no-install-recommends \
  apache2 certbot python3-certbot-apache git curl ca-certificates ufw sqlite3

echo "==> 2. Node 22 LTS (NodeSource)"
if ! command -v node >/dev/null || [[ "$(node -v)" != v22.* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
corepack enable

echo "==> 3. Módulos Apache (proxy + ssl + http2 + rewrite + headers + deflate)"
a2enmod proxy proxy_http proxy_wstunnel ssl http2 rewrite headers deflate >/dev/null || true

echo "==> 4. Utilizador de serviço '$APP_USER'"
if ! id "$APP_USER" >/dev/null 2>&1; then
  adduser --system --group --home "$APP_HOME" --shell /usr/sbin/nologin "$APP_USER"
fi
install -d -o "$APP_USER" -g "$APP_USER" "$APP_HOME" "$DATA_DIR" "$DATA_DIR/backups"

echo "==> 5. Build do código em $REPO_DIR"
if [[ ! -d "$REPO_DIR" ]]; then
  echo "[!] $REPO_DIR não existe. Clonar primeiro e voltar a correr." >&2
  exit 1
fi
chown -R "$APP_USER:$APP_USER" "$REPO_DIR"
sudo -u "$APP_USER" bash -lc "cd '$REPO_DIR' && npm ci && npm run build && npm run db:seed"

if [[ ! -f "$REPO_DIR/.env" ]]; then
  echo "[!] $REPO_DIR/.env não existe. Cria a partir do .env.example antes de continuar:" >&2
  echo "    sudo -u $APP_USER cp $REPO_DIR/.env.example $REPO_DIR/.env" >&2
  echo "    sudo -u $APP_USER \$EDITOR $REPO_DIR/.env   # set ADMIN_PASSWORD e ADMIN_SESSION_SECRET" >&2
  exit 1
fi

echo "==> 6. Instalar unit systemd"
install -m 0644 "$REPO_DIR/deploy/systemd/pao.service" /etc/systemd/system/pao.service
# Ajustar WorkingDirectory se o REPO_DIR não for o default
if [[ "$REPO_DIR" != "/opt/pao/app" ]]; then
  sed -i "s|/opt/pao/app|$REPO_DIR|g" /etc/systemd/system/pao.service
fi
systemctl daemon-reload
systemctl enable --now pao
systemctl status pao --no-pager -l | head -5 || true

echo "==> 7. Vhost Apache (porta 80) — pré-Certbot"
install -m 0644 "$REPO_DIR/deploy/apache/$DOMAIN.conf" "/etc/apache2/sites-available/$DOMAIN.conf"
a2ensite "$DOMAIN" >/dev/null
apache2ctl configtest
systemctl reload apache2

echo "==> 8. Firewall (ufw)"
ufw allow OpenSSH >/dev/null
ufw allow 'Apache Full' >/dev/null
ufw --force enable >/dev/null

echo "==> 9. Cron diário de backup do SQLite"
install -m 0755 "$REPO_DIR/deploy/cron/pao-backup" /etc/cron.daily/pao-backup

echo
echo "==> Pronto. Falta o passo manual do Certbot:"
echo
echo "    sudo certbot --apache \\"
echo "        -d $DOMAIN \\"
echo "        --redirect --hsts --staple-ocsp \\"
echo "        --agree-tos -m $ADMIN_EMAIL --no-eff-email"
echo
echo "Depois, substituir o vhost SSL pelo template endurecido:"
echo "    sudo cp $REPO_DIR/deploy/apache/$DOMAIN-le-ssl.conf \\"
echo "           /etc/apache2/sites-available/$DOMAIN-le-ssl.conf"
echo "    sudo apache2ctl configtest && sudo systemctl reload apache2"
echo
echo "Smoke test:"
echo "    curl -I https://$DOMAIN/healthz"
