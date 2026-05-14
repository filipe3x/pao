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

echo "==> 2. Detectar Node 22 para $APP_USER"
USER_HOME="$(getent passwd "$APP_USER" | cut -d: -f6)"
NVM_SH="$USER_HOME/.nvm/nvm.sh"

resolve_node() {
  # 1. Override explícito via env (deploy/install.sh NODE_BIN_OVERRIDE=/path/node)
  if [[ -n "${NODE_BIN_OVERRIDE:-}" ]]; then echo "$NODE_BIN_OVERRIDE"; return; fi
  # 2. nvm directo (mais fiável: source da nvm.sh em vez de depender de profile/bashrc)
  if [[ -s "$NVM_SH" ]]; then
    sudo -u "$APP_USER" bash -c "source '$NVM_SH' && nvm which default 2>/dev/null" && return
  fi
  # 3. Glob (fallback)
  local g
  g="$(ls -1 "$USER_HOME"/.nvm/versions/node/v22.*/bin/node 2>/dev/null | sort -V | tail -1 || true)"
  if [[ -n "$g" ]]; then echo "$g"; return; fi
  # 4. PATH normal (provavelmente Node antigo do sistema)
  command -v node || true
}

NODE_BIN="$(resolve_node)"
NODE_V="$(sudo -u "$APP_USER" "$NODE_BIN" -v 2>/dev/null || true)"
if [[ ! "$NODE_V" =~ ^v22\. ]]; then
  echo "[!] Node 22 não detectado para $APP_USER (got: '$NODE_V' em '$NODE_BIN')." >&2
  echo "    Se usas nvm: 'nvm install 22 && nvm alias default 22' e re-corre o install.sh." >&2
  echo "    Ou força com:  sudo NODE_BIN_OVERRIDE=/caminho/para/node bash deploy/install.sh" >&2
  exit 1
fi
NODE_BIN_DIR="$(dirname "$NODE_BIN")"
echo "    Node $NODE_V em $NODE_BIN"

echo "==> 3. Módulos Apache necessários"
a2enmod proxy proxy_http rewrite headers ssl deflate mime >/dev/null

echo "==> 4. npm ci + build + seed (como $APP_USER, com Node 22 no PATH)"
sudo -u "$APP_USER" env "PATH=$NODE_BIN_DIR:$PATH" bash -c "
  cd '$REPO_DIR'
  node -v
  npm ci
  npm run build
  npm run db:seed
"

echo "==> 5. systemd unit"
install -m 0644 "$REPO_DIR/deploy/systemd/pao.service" /etc/systemd/system/pao.service
# Patch ExecStart com o path absoluto do node detectado em (2).
# systemd não carrega o profile do user, portanto precisa do binário exacto.
sed -i "s|^ExecStart=/usr/bin/node|ExecStart=$NODE_BIN|" /etc/systemd/system/pao.service
echo "    $(grep ^ExecStart= /etc/systemd/system/pao.service)"
systemctl daemon-reload
systemctl enable --now pao
sleep 1
systemctl status pao --no-pager -l | head -8 || true

echo "==> 6. Vhost Apache"
VHOST_DST="/etc/apache2/sites-available/$DOMAIN.conf"
CERT_FILE="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
LE_SSL_CONF="/etc/apache2/sites-available/$DOMAIN-le-ssl.conf"
if [[ -f "$CERT_FILE" ]]; then
  echo "    Cert existe — instalo vhost final (HTTP redirect + HTTPS hardened)"
  install -m 0644 "$REPO_DIR/scripts/apache/$DOMAIN.conf.example" "$VHOST_DST"
  # certbot --apache cria um vhost :443 paralelo (-le-ssl.conf) sem os
  # ProxyPass, que se sobrepõe ao nosso. Apagar.
  if [[ -f "$LE_SSL_CONF" ]]; then
    echo "    A remover vhost paralelo $LE_SSL_CONF (criado pelo certbot --apache)"
    a2dissite "$DOMAIN-le-ssl.conf" >/dev/null 2>&1 || true
    rm -f "$LE_SSL_CONF"
  fi
else
  echo "    Sem cert ainda — instalo vhost bootstrap HTTP-only (suficiente p/ Certbot)"
  cat > "$VHOST_DST" <<EOF
# Bootstrap vhost — gerado por deploy/install.sh.
# Re-corre o install.sh DEPOIS de 'sudo certbot --apache -d $DOMAIN' para
# substituir este ficheiro pelo scripts/apache/$DOMAIN.conf.example completo.
<VirtualHost *:80>
  ServerName $DOMAIN
  DocumentRoot $REPO_DIR/client/dist
  <Directory $REPO_DIR/client/dist>
    Options -Indexes +FollowSymLinks
    AllowOverride None
    Require all granted
  </Directory>
  ErrorLog  \${APACHE_LOG_DIR}/pao_error.log
  CustomLog \${APACHE_LOG_DIR}/pao_access.log combined
</VirtualHost>
EOF
fi
a2ensite "$DOMAIN.conf" >/dev/null
apache2ctl configtest
systemctl reload apache2

echo "==> 7. Cron diário de backup"
install -m 0755 "$REPO_DIR/deploy/cron/pao-backup" /etc/cron.daily/pao-backup

echo
if [[ -f "$CERT_FILE" ]]; then
  echo "==> Pronto. Smoke test:"
  echo "  curl -I https://$DOMAIN/healthz"
else
  echo "==> Pronto, bootstrap. Falta:"
  echo
  echo "  # 1) Emitir cert:"
  echo "  sudo certbot --apache -d $DOMAIN --agree-tos \\"
  echo "      -m webmaster@brasume.com --no-eff-email"
  echo
  echo "  # 2) Re-correr este install.sh — agora detecta o cert e instala o vhost final:"
  echo "  sudo bash deploy/install.sh"
  echo
  echo "  # 3) Smoke:"
  echo "  curl -I https://$DOMAIN/healthz"
fi
