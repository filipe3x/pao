# Deploy — `pao.brasume.com`

Ficheiros prontos a copiar para um servidor Debian/Ubuntu com Apache2.
O passo-a-passo completo (com explicações) está em [`../ROADMAP.md`](../ROADMAP.md).

## Layout

```
deploy/
├── install.sh                       # script de provisioning (Apache + Node + systemd + UFW + cron)
├── systemd/
│   └── pao.service                  # unit do daemon Node (porta 3000)
├── apache/
│   ├── pao.brasume.com.conf         # vhost :80 (pré-Certbot)
│   └── pao.brasume.com-le-ssl.conf  # vhost :443 (substituir o do Certbot)
└── cron/
    └── pao-backup                   # VACUUM INTO diário do SQLite
```

## Fluxo rápido (chave-na-mão)

```bash
# No servidor (root):
git clone <repo-url> /opt/pao/app
cd /opt/pao/app
sudo -u pao cp .env.example .env
sudo -u pao $EDITOR .env       # define ADMIN_PASSWORD e ADMIN_SESSION_SECRET
sudo bash deploy/install.sh /opt/pao/app

# Depois (o install.sh imprime o comando exacto):
sudo certbot --apache -d pao.brasume.com --redirect --hsts --staple-ocsp \
    --agree-tos -m webmaster@brasume.com --no-eff-email

# Substituir o vhost SSL gerado pelo template endurecido:
sudo cp deploy/apache/pao.brasume.com-le-ssl.conf \
        /etc/apache2/sites-available/
sudo apache2ctl configtest && sudo systemctl reload apache2

# Validar
curl -I https://pao.brasume.com/healthz
```

## Segredos

| Var | Onde | Para que serve |
|---|---|---|
| `ADMIN_PASSWORD`        | `.env` | Password única para destrancar a edição de defaults pelo botão 🔒. |
| `ADMIN_SESSION_SECRET`  | `.env` | HMAC para assinar o token de sessão admin (>= 16 chars). |

Gerar valores fortes:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"  # password
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"  # secret
```

## Operação

| Tarefa | Comando |
|---|---|
| Logs do daemon | `journalctl -u pao -f` |
| Restart        | `systemctl restart pao` |
| Renovação cert | `systemctl list-timers \| grep certbot` (auto) — testar: `certbot renew --dry-run` |
| Backup manual  | `sudo -u pao sqlite3 /var/lib/pao/pao.db "VACUUM INTO '/tmp/pao-now.db'"` |
| Restore        | parar serviço → substituir `pao.db` por um backup → arrancar |
| Update código  | `cd /opt/pao/app && git pull && sudo -u pao npm ci && sudo -u pao npm run build && sudo systemctl restart pao` |
