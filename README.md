# Calculadora de Pão — `pao.brasume.com`

Calculadora de receitas para pão sem glúten (massa, custo, lista de compras).

- **Stack:** Vite 6 + React 18 + TypeScript · Tailwind v4 · Express · `node:sqlite`
- **PWA:** sim (manifest + service worker via `vite-plugin-pwa`)
- **Persistência:** SQLite para os *defaults* globais; `localStorage` para o estado do utilizador
- **Edição de defaults:** modo *admin lock* — botão 🔒 + password única (`ADMIN_PASSWORD` em `.env`)
- **Deploy:** Apache2 + Certbot em `pao.brasume.com` (ver [`ROADMAP.md`](./ROADMAP.md) e [`deploy/`](./deploy/))

## Quickstart (dev local)

```bash
cp .env.example .env
# edita ADMIN_PASSWORD e ADMIN_SESSION_SECRET (>=16 chars)
npm install
npm run db:seed      # cria data/pao.db com a receita base
npm run dev          # Vite em :5173 + Express em :3000
```

Abrir `http://localhost:5173`. Edições aos preços ficam em `localStorage`.
Para destrancar a edição dos defaults, clicar no 🔒 e usar a `ADMIN_PASSWORD`.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev`        | Vite (5173) + server (3000) em paralelo, com proxy `/api` e `/healthz` |
| `npm run build`      | Build do client (`client/dist/`) e do server (`dist-server/`) |
| `npm start`          | Corre o build de produção (server serve o SPA + API) |
| `npm test`           | Vitest (unit, 18 testes) |
| `npm run test:e2e`   | Playwright (smoke). Primeira vez: `npx playwright install chromium` |
| `npm run icons:gen`  | Regenera os PNGs do PWA a partir de `scripts/icon-source*.svg` |
| `npm run db:seed`    | Popula a receita base no SQLite |
| `npm run db:reset`   | Apaga `data/pao.db` e refaz seed |
| `npm run db:backup`  | `VACUUM INTO data/backups/pao-<data>.db` |
| `npm run lint`       | Type-check em client + server |

## Estrutura

```
.
├── client/                   # frontend Vite + React + TS
│   ├── index.html
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── styles.css        # Tailwind v4 + CSS denso do protótipo
│       ├── types.ts
│       ├── components/       # Masthead, RecipeTabs, Panel, IngredientRow, ShoppingList, NewRecipeModal, AdminLockButton, …
│       └── lib/              # api, calc, format, store
├── server/                   # backend Express + node:sqlite
│   ├── index.ts              # SPA fallback + /healthz + cache headers
│   ├── db.ts                 # schema + WAL + foreign keys
│   ├── seed.ts               # receita base (Apêndice A do HANDOFF.md)
│   └── routes/
│       ├── recipes.ts        # GET público · PATCH/POST/DELETE protegidos
│       └── admin.ts          # /unlock /status + requireAdmin middleware
├── tests/
│   ├── unit/                 # Vitest: calc, format
│   └── e2e/                  # Playwright smoke
├── deploy/                   # ficheiros chave-na-mão (Apache, systemd, cron, install.sh)
├── prototype/                # protótipo HTML/JSX original (referência)
├── ROADMAP.md                # plano detalhado de implementação + deploy
└── HANDOFF.md                # handoff original do design
```

## Deploy

Resumo (detalhe em [`deploy/README.md`](./deploy/README.md) e [`ROADMAP.md`](./ROADMAP.md)):

```bash
# No servidor (root, Debian/Ubuntu)
git clone <repo> /opt/pao/app
cd /opt/pao/app
sudo -u pao cp .env.example .env && sudo -u pao $EDITOR .env
sudo bash deploy/install.sh /opt/pao/app
sudo certbot --apache -d pao.brasume.com --redirect --hsts --staple-ocsp \
    --agree-tos -m webmaster@brasume.com --no-eff-email
sudo cp deploy/apache/pao.brasume.com-le-ssl.conf /etc/apache2/sites-available/
sudo apache2ctl configtest && sudo systemctl reload apache2
curl -I https://pao.brasume.com/healthz
```

## Operação

| Tarefa | Comando |
|---|---|
| Logs do daemon          | `journalctl -u pao -f` |
| Restart                 | `systemctl restart pao` |
| Renovação certificado   | automática via `certbot.timer`; testar: `certbot renew --dry-run` |
| Backup manual           | `sudo -u pao sqlite3 /var/lib/pao/pao.db "VACUUM INTO '/tmp/pao-now.db'"` |
| Backup diário           | `cron.daily/pao-backup` (instalado pelo `install.sh`) |
| Restaurar               | `systemctl stop pao` → substituir `/var/lib/pao/pao.db` por backup → `systemctl start pao` |
| Actualizar código       | `cd /opt/pao/app && git pull && sudo -u pao npm ci && sudo -u pao npm run build && sudo systemctl restart pao` |
| Trancar admin no browser| limpar `sessionStorage` ou clicar no 🔓 |

## Critérios de aceitação

- [x] Página servida com HTTPS em `pao.brasume.com` *(infra pronta; falta executar no servidor)*
- [x] Estética visual idêntica ao protótipo HTML
- [x] Tabs, slider, painéis editáveis, lista de compras imprimível
- [x] CRUD de receitas custom (localStorage) + edição admin de defaults (SQLite)
- [x] Overrides de preço/embalagem persistem (localStorage para utilizador, SQLite para defaults)
- [x] Botão Imprimir gera exactamente uma página (clone para `#print-area`)
- [x] Migração one-shot de `localStorage` v1 → v2
- [x] Backup do SQLite documentado e automatizado
- [x] PWA (manifest + service worker)
- [x] Testes (Vitest 18 verdes + Playwright smoke)
- [x] CI (GitHub Actions) em `lint + test + build + seed`
