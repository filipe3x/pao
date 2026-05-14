# Deploy — `pao.brasume.com`

Adaptado à convenção do VPS `brasume` (mesma máquina de `curvsync`, `words`, `sleep`, `embers`):

- **App em** `/var/www/pao/`
- **Corre como** `ember:http-web` — process manager **PM2** (igual a curvsync / isleep / words)
- **Apache** serve o SPA directamente do `client/dist/`; só `/api` (e `/healthz`) vão por proxy para o Node
- **Node** escuta em `127.0.0.1:3050` (porto reservado para pao neste VPS); Node 22 via nvm
- **SQLite** em `/var/www/pao/data/pao.db`, backups em `/var/www/pao/data/backups/`

## Layout

```
deploy/
├── install.sh                       # post-clone (build, pm2, vhost, cron)
└── cron/pao-backup                  # VACUUM INTO diário, retém 30 dias

scripts/apache/
└── pao.brasume.com.conf.example     # vhost único (HTTP redirect + HTTPS)

ecosystem.config.cjs                 # gerado pelo install.sh, gitignored
```

> O `install.sh` assume que o `pm2 startup` (auto-arranque ao boot) já está
> configurado para o user `ember` — é o caso neste VPS porque curvsync /
> isleep / words já lá vivem. Só corre `pm2 save` no fim.

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
sudo bash deploy/install.sh      # re-corre build + pm2 reload (zero-downtime quando dá)
```

Ou, se só queres reiniciar sem rebuild:

```bash
pm2 restart pao
```

## Operação

| Tarefa | Comando |
|---|---|
| Lista pm2       | `pm2 list` (deve aparecer `pao` junto a curvsync / isleep / words) |
| Logs Node       | `pm2 logs pao` (sai com `Ctrl+C`) |
| Logs Apache     | `tail -f /var/log/apache2/pao_access.log /var/log/apache2/pao_error.log` |
| Restart Node    | `pm2 restart pao` |
| Reload (0-DT)   | `pm2 reload pao` |
| Stop / Start    | `pm2 stop pao` · `pm2 start pao` |
| Reload Apache   | `sudo systemctl reload apache2` |
| Renovação cert  | automática via `certbot.timer`; testar: `sudo certbot renew --dry-run` |
| Backup manual   | `sudo -u ember sqlite3 /var/www/pao/data/pao.db "VACUUM INTO '/tmp/pao-now.db'"` |
| Restore         | `pm2 stop pao && sudo -u ember cp /tmp/pao-bk.db /var/www/pao/data/pao.db && pm2 start pao` |
