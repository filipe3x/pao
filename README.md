# Calculadora de Pão — `pao.brasume.com`

Calculadora de receitas para pão sem glúten (massa, custo, lista de compras).

- **Stack:** Vite 6 + React 18 + TypeScript · Tailwind v4 · Express · `node:sqlite`
- **PWA:** sim (manifest + service worker via `vite-plugin-pwa`)
- **Persistência:** SQLite para os *defaults* globais; `localStorage` para o estado do utilizador
- **Edição de defaults:** modo *admin lock* — botão de cadeado + password única (`ADMIN_PASSWORD` em `.env`)
- **Deploy:** Apache2 + Certbot em `pao.brasume.com` (ver [`ROADMAP.md`](./ROADMAP.md))

## Quickstart

```bash
cp .env.example .env
# edita ADMIN_PASSWORD e ADMIN_SESSION_SECRET
npm install
npm run db:seed      # cria data/pao.db com a receita base
npm run dev          # Vite em :5173 + Express em :3000
```

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev`        | Vite (5173) + server (3000) em paralelo, com proxy `/api` e `/healthz` |
| `npm run build`      | Build do client (`client/dist/`) e do server (`dist-server/`) |
| `npm start`          | Corre o build de produção (server serve o SPA + API) |
| `npm test`           | Vitest (unit) |
| `npm run test:e2e`   | Playwright (smoke) |
| `npm run db:seed`    | Popula a receita base no SQLite |
| `npm run db:reset`   | Apaga `data/pao.db` e refaz seed |
| `npm run db:backup`  | `VACUUM INTO data/backups/pao-<data>.db` |
| `npm run lint`       | Type-check em client + server |

## Estrutura

Ver `ROADMAP.md` para o detalhe do plano fase-a-fase, e `HANDOFF.md`
(do design) para o contexto original. O protótipo original ficou em `prototype/`.

## Deploy

Apache2 + Certbot — passos completos em [`ROADMAP.md`](./ROADMAP.md).
