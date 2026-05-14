# Deploy — `pao.brasume.com`

Adaptado à convenção do VPS `brasume` (mesma máquina de `curvsync`, `words`, `sleep`, `embers`):

- **App em** `/var/www/pao/`
- **Corre como** `ember:http-web`
- **Apache** serve o SPA directamente do `client/dist/`; só `/api` (e `/healthz`) vão por proxy para o Node
- **Node** escuta em `127.0.0.1:3050` (porto reservado para pao neste VPS)
- **SQLite** em `/var/www/pao/data/pao.db`, backups em `/var/www/pao/data/backups/`

## Layout

```
deploy/
├── install.sh                       # post-clone (build, systemd, vhost, cron)
├── systemd/pao.service              # User=ember, Group=http-web, /var/www/pao
└── cron/pao-backup                  # VACUUM INTO diário, retém 30 dias

scripts/apache/
└── pao.brasume.com.conf.example     # vhost único (HTTP redirect + HTTPS)
```

## Playbook (a partir do `ember@brasume`)

```bash
# 1. Clone
cd /var/www
sudo git clone https://github.com/filipe3x/pao.git
sudo chown -R ember:http-web pao
cd pao

# 2. .env com segredos fortes
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"  # → ADMIN_PASSWORD
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"  # → ADMIN_SESSION_SECRET
$EDITOR .env                          # NODE_ENV=production, colar os dois

# 3. Provisionamento — 1.ª vez instala vhost bootstrap HTTP-only
sudo bash deploy/install.sh

# 4. Certbot — emite o cert para pao.brasume.com
sudo certbot --apache -d pao.brasume.com --agree-tos \
    -m webmaster@brasume.com --no-eff-email

# 5. Re-correr install.sh — agora detecta o cert e instala o vhost final
#    (HTTP→HTTPS redirect + bloco HTTPS hardened com HSTS, caches, proxy)
sudo bash deploy/install.sh

# 6. Smoke
curl -I https://pao.brasume.com/healthz
curl -sf https://pao.brasume.com/api/recipes | python3 -m json.tool | head -10
```

## Updates

```bash
cd /var/www/pao
sudo -u ember git pull
sudo -u ember npm ci
sudo -u ember npm run build
sudo systemctl restart pao
```

## Operação

| Tarefa | Comando |
|---|---|
| Logs Node       | `journalctl -u pao -f` |
| Logs Apache     | `tail -f /var/log/apache2/pao_access.log /var/log/apache2/pao_error.log` |
| Restart Node    | `sudo systemctl restart pao` |
| Reload Apache   | `sudo systemctl reload apache2` |
| Renovação cert  | automática via `certbot.timer`; testar: `sudo certbot renew --dry-run` |
| Backup manual   | `sudo -u ember sqlite3 /var/www/pao/data/pao.db "VACUUM INTO '/tmp/pao-now.db'"` |
| Restore         | `sudo systemctl stop pao && sudo -u ember cp /tmp/pao-bk.db /var/www/pao/data/pao.db && sudo systemctl start pao` |
