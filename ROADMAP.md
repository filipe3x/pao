# Roadmap — pao.brasume.com

Mini-roadmap de implementação chave-na-mão, do zip ao domínio em HTTPS.
Stack: Vite + React + TS · Express · `node:sqlite` · Apache2 (reverse proxy) · Certbot (Let's Encrypt).

> Substitui a sugestão de Caddy do `HANDOFF.md` por **Apache2 + Certbot**,
> mantendo tudo o resto. Decisão: o `brasume.com` provavelmente já tem
> Apache2 com outros vhosts, portanto reutilizar é mais barato do que
> introduzir um segundo proxy.

---

## Fase 0 — Preparação local (1h)

- [ ] Extrair `Calculadora do Pão.zip` para `prototype/` (referência durante o port).
- [ ] Confirmar Node ≥ 22 (`node -v`) — é requisito do `node:sqlite` builtin.
- [ ] `pnpm` ou `npm` instalado.
- [ ] Criar `.gitignore` com `data/`, `node_modules/`, `client/dist/`, `.env`.

## Fase 1 — Scaffold do projecto (meio dia)

- [ ] `pnpm create vite client --template react-ts`, mover para layout do `HANDOFF.md`.
- [ ] `pnpm add -D tailwindcss @tailwindcss/vite` (Tailwind v4 via plugin Vite).
- [ ] `client/src/styles.css` com `@import "tailwindcss";` + `@theme` (tokens do design).
- [ ] `server/` com Express, `node:sqlite`, schema do `HANDOFF.md`.
- [ ] `concurrently` para dev (Vite 5173 + Express 3000) + proxy `/api → :3000` no `vite.config.ts`.

## Fase 2 — Port do protótipo (2–3 dias)

- [ ] Componentes 1:1 do `app.jsx` → `.tsx` tipados (`Masthead`, `RecipeTabs`, `Controls`, `Panel`, `IngredientRow`, `ShoppingList`, `NewRecipeModal`, `ExactStamp`, `PrintArea`).
- [ ] `lib/calc.ts`, `lib/format.ts`, `lib/store.ts` (com `useSyncExternalStore`).
- [ ] `lib/api.ts` — fetch wrappers para `/api/*`.
- [ ] Preservar o truque de impressão (`#print-area` + cleanup no `afterprint`).
- [ ] CSS residual que Tailwind não cobre: paper-grain, exact-stamp, slider thumb, `@media print`.

## Fase 3 — Backend + persistência (1–2 dias)

- [ ] `server/db.ts` cria schema, ligar PRAGMA `foreign_keys=ON`, `journal_mode=WAL`.
- [ ] `server/seed.ts` popula receita base (Apêndice A do `HANDOFF.md`).
- [ ] Rotas `/api/recipes`, `/api/recipes/:id`, `/api/.../ingredients`, `/api/.../prices`, `/api/settings`.
- [ ] Middleware `userId = 'default'` (single-user por agora; magic-link fica para depois).
- [ ] Endpoint utilitário `POST /api/import-local-storage` para migrar `calc-pao-v1`.

## Fase 4 — Build de produção (meio dia)

- [ ] `pnpm build` → `client/dist/`.
- [ ] Express serve `client/dist/` como estáticos + SPA fallback (`*` → `index.html`, excepto `/api/*`).
- [ ] Health-check em `GET /healthz` (devolve `{ok:true}` — usado pelo Apache p/ monitorização).
- [ ] `.env.example` com `PORT=3000 NODE_ENV=production DB_PATH=/var/lib/pao/pao.db`.

## Fase 5 — Deploy ao servidor (1 dia)

Ver secções "**Provisioning**", "**systemd**", "**Apache2 vhost**" e
"**Certbot**" abaixo. Roadmap operacional:

- [ ] DNS: `A pao.brasume.com → IP-do-servidor` (TTL baixo até estabilizar).
- [ ] `apt install apache2 certbot python3-certbot-apache` (se ainda não estiver).
- [ ] `a2enmod proxy proxy_http headers ssl http2 rewrite`.
- [ ] Criar utilizador `pao`, clonar repo para `/opt/pao`, `pnpm install --prod && pnpm build`.
- [ ] `mkdir -p /var/lib/pao && chown pao:pao /var/lib/pao` (para o SQLite).
- [ ] Instalar unit `systemd` (abaixo), `systemctl enable --now pao`.
- [ ] Instalar vhost HTTP (porta 80) — necessário para o desafio HTTP-01 do Certbot.
- [ ] Correr `certbot --apache -d pao.brasume.com` — escolher "redirect HTTP→HTTPS".
- [ ] Validar: `curl -I https://pao.brasume.com/healthz`.

## Fase 6 — Operação contínua

- [ ] Backup diário (cron + `VACUUM INTO`, ver abaixo).
- [ ] `certbot renew --dry-run` para confirmar renovação automática.
- [ ] `journalctl -u pao -f` para tail dos logs aplicacionais.
- [ ] (Opcional) `fail2ban` no `auth.log` do Apache e `ufw allow 'Apache Full'`.

---

## Provisioning — passos no servidor

Assumindo Debian/Ubuntu recentes. Correr como root (ou com `sudo`).

```bash
# 1) Pacotes base
apt update
apt install -y apache2 certbot python3-certbot-apache git curl ufw

# 2) Node 22 LTS via NodeSource (necessário para node:sqlite builtin)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
corepack enable
corepack prepare pnpm@latest --activate

# 3) Módulos Apache necessários para o reverse proxy
a2enmod proxy proxy_http headers ssl http2 rewrite
systemctl restart apache2

# 4) Utilizador de serviço (sem shell de login)
adduser --system --group --home /opt/pao --shell /usr/sbin/nologin pao

# 5) Código + build
install -d -o pao -g pao /opt/pao /var/lib/pao
sudo -u pao git clone <repo-url> /opt/pao/app
cd /opt/pao/app
sudo -u pao pnpm install --frozen-lockfile
sudo -u pao pnpm build
sudo -u pao cp .env.example .env   # editar PORT, DB_PATH, etc.

# 6) Firewall
ufw allow OpenSSH
ufw allow 'Apache Full'           # 80 + 443
ufw --force enable
```

---

## systemd unit — `/etc/systemd/system/pao.service`

```ini
[Unit]
Description=pao.brasume.com — calculadora de pão
After=network.target

[Service]
Type=simple
User=pao
Group=pao
WorkingDirectory=/opt/pao/app
EnvironmentFile=/opt/pao/app/.env
ExecStart=/usr/bin/node --env-file=.env server/index.ts
Restart=on-failure
RestartSec=3

# Hardening básico
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/pao
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
LockPersonality=true
MemoryDenyWriteExecute=true

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now pao
systemctl status pao
```

---

## Apache2 vhost — passo 1: HTTP (porta 80)

Criar `/etc/apache2/sites-available/pao.brasume.com.conf` com **apenas o
bloco HTTP** primeiro. O Certbot vai injectar o bloco HTTPS automaticamente
no passo 2.

```apache
<VirtualHost *:80>
    ServerName pao.brasume.com
    ServerAdmin webmaster@brasume.com

    # Permite o desafio HTTP-01 do Certbot servido pelo próprio Apache
    DocumentRoot /var/www/html

    # Tudo o resto vai para o Node
    ProxyPreserveHost On
    ProxyRequests Off
    <Location />
        ProxyPass         http://127.0.0.1:3000/
        ProxyPassReverse  http://127.0.0.1:3000/
    </Location>

    ErrorLog  ${APACHE_LOG_DIR}/pao.error.log
    CustomLog ${APACHE_LOG_DIR}/pao.access.log combined
</VirtualHost>
```

```bash
a2ensite pao.brasume.com
apache2ctl configtest
systemctl reload apache2

# Smoke test sem TLS
curl -I http://pao.brasume.com/healthz
```

---

## Certbot — passo 2: obter o certificado e ligar HTTPS

```bash
certbot --apache \
    -d pao.brasume.com \
    --redirect \
    --hsts \
    --staple-ocsp \
    --agree-tos \
    -m webmaster@brasume.com \
    --no-eff-email
```

O Certbot:

1. Faz o desafio HTTP-01 contra `http://pao.brasume.com/.well-known/acme-challenge/...`.
2. Cria `/etc/apache2/sites-available/pao.brasume.com-le-ssl.conf` com o
   bloco `<VirtualHost *:443>`.
3. Reescreve o vhost da porta 80 para redireccionar para HTTPS.
4. Regista um timer systemd (`certbot.timer`) que renova duas vezes por dia.

Confirmar renovação:

```bash
systemctl list-timers | grep certbot
certbot renew --dry-run
```

---

## Apache2 vhost — passo 3: endurecer o `:443`

Depois do Certbot escrever o ficheiro SSL, **editá-lo** para acrescentar
proxy WebSocket-ready, HTTP/2, headers de segurança e compressão.
Manter as linhas `SSLCertificate*` que o Certbot inseriu.

`/etc/apache2/sites-available/pao.brasume.com-le-ssl.conf`:

```apache
<IfModule mod_ssl.c>
<VirtualHost *:443>
    ServerName pao.brasume.com
    ServerAdmin webmaster@brasume.com

    Protocols h2 http/1.1

    # === Reverse proxy para o Node em :3000 ===
    ProxyPreserveHost On
    ProxyRequests Off
    ProxyTimeout 60

    # WebSocket upgrade (caso venhas a usar — barato deixar pronto)
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule /(.*) ws://127.0.0.1:3000/$1 [P,L]

    <Location />
        ProxyPass         http://127.0.0.1:3000/  retry=0
        ProxyPassReverse  http://127.0.0.1:3000/
    </Location>

    # === Compressão ===
    <IfModule mod_deflate.c>
        AddOutputFilterByType DEFLATE \
            text/html text/plain text/css text/xml \
            application/javascript application/json \
            application/xml image/svg+xml font/woff2
    </IfModule>

    # === Cache estática agressiva (Vite gera hashes nos ficheiros) ===
    <LocationMatch "^/assets/">
        Header set Cache-Control "public, max-age=31536000, immutable"
    </LocationMatch>

    # === Headers de segurança ===
    Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains"
    Header always set X-Content-Type-Options "nosniff"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set Permissions-Policy "geolocation=(), microphone=(), camera=()"
    # CSP minimalista — ajustar se vier a entrar Sentry/Plausible/etc.
    Header always set Content-Security-Policy "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self'; connect-src 'self'"

    ErrorLog  ${APACHE_LOG_DIR}/pao.ssl.error.log
    CustomLog ${APACHE_LOG_DIR}/pao.ssl.access.log combined

    # === TLS — gerido pelo Certbot ===
    SSLCertificateFile      /etc/letsencrypt/live/pao.brasume.com/fullchain.pem
    SSLCertificateKeyFile   /etc/letsencrypt/live/pao.brasume.com/privkey.pem
    Include /etc/letsencrypt/options-ssl-apache.conf
</VirtualHost>
</IfModule>
```

```bash
apache2ctl configtest && systemctl reload apache2
curl -I https://pao.brasume.com/healthz
```

---

## Backup do SQLite — `/etc/cron.daily/pao-backup`

```bash
#!/bin/sh
set -e
TS=$(date +%F)
DEST=/var/lib/pao/backups
install -d -o pao -g pao "$DEST"
sudo -u pao sqlite3 /var/lib/pao/pao.db "VACUUM INTO '$DEST/pao-$TS.db'"
# Manter 30 dias
find "$DEST" -name 'pao-*.db' -mtime +30 -delete
```

`chmod +x /etc/cron.daily/pao-backup`. Para off-site, sincronizar `$DEST`
para S3/Backblaze com `rclone` num segundo cron.

---

## Checklist final (chave-na-mão)

- [ ] `https://pao.brasume.com` carrega o SPA com cadeado verde.
- [ ] HTTP redirecciona para HTTPS (`curl -I http://pao.brasume.com` → 301).
- [ ] `https://pao.brasume.com/api/recipes` devolve a receita base.
- [ ] `systemctl status pao` activo; reinicia em caso de crash.
- [ ] `certbot renew --dry-run` passa sem erros.
- [ ] Backup diário gera ficheiro em `/var/lib/pao/backups/`.
- [ ] Logs: `/var/log/apache2/pao.ssl.access.log` + `journalctl -u pao`.
- [ ] `ufw status` mostra só OpenSSH e Apache Full.

---

## Apêndice — troubleshooting rápido

| Sintoma | Onde olhar |
|---|---|
| 502 Bad Gateway | `systemctl status pao`; o Node caiu ou está noutra porta |
| Certbot falha `connection refused` no `:80` | Firewall a bloquear, ou Apache não está a servir o vhost HTTP |
| `Mixed content` no browser | Falta `ProxyPreserveHost On` ou app a gerar URLs `http://` absolutos |
| 404 em rotas client-side | Falta SPA fallback no Express (`app.get('*', ...)` excepto `/api`) |
| SQLite `SQLITE_BUSY` | Confirmar `journal_mode=WAL` activo em `db.ts` |
| Cert não renova | `journalctl -u certbot.timer`; verificar que o vhost `:80` continua a expor `/.well-known/acme-challenge/` |
