# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Calculadora de pão sem glúten — port em produção de um protótipo HTML/JSX para Vite + React + TS + Express + `node:sqlite`, com deploy chave-na-mão Apache2 + Certbot em `pao.brasume.com`. Idioma do projecto: **PT-PT**.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Vite (5173) + Express (3000) em paralelo, com proxy `/api` e `/healthz`. Usa `tsx watch` para o server. |
| `npm run build` | `npm run build:client` (`tsc -b` + `vite build` → `client/dist/`) + `npm run build:server` (`tsc -p server/tsconfig.json` → `dist-server/`). |
| `npm start` | Corre `dist-server/index.js` com `--env-file=.env`. Em produção o Express serve o SPA + API no mesmo processo. |
| `npm run lint` | Type-check em ambos os projectos (client + server). Não há ESLint configurado. |
| `npm test` | Vitest unit (`tests/unit/`). Um único teste: `npx vitest run tests/unit/calc.test.ts`. |
| `npm run test:e2e` | Playwright smoke (`tests/e2e/`). |
| `npm run db:seed` | Popula receita base no SQLite (idempotente). |
| `npm run db:reset` | Apaga `data/pao.db` e refaz seed. |
| `npm run db:backup` | `VACUUM INTO data/backups/pao-<data>.db`. |

**Sempre que mexes em `.env` em dev:** o `tsx watch` reinicia o processo, mas se houver um `tsx`/`node` orphan a usar valores antigos, mata-o (`pkill -f tsx`) antes de testar — já houve confusão por causa disto.

## Arquitectura

### Divisão "estado do utilizador vs defaults globais"

Decisão central do projecto (não está no `HANDOFF.md` original — foi tomada na altura da implementação):

- **Estado do utilizador** (loaves, includeHacks, prices overrides, customRecipes) vive em **localStorage** sob a chave `calc-pao-v2`. Não há auth nem multi-utilizador. O `lib/store.ts` faz migração one-shot de `calc-pao-v1` (formato legacy onde prices eram `€/kg` em vez de `{price, grams}`).
- **Defaults globais** (receita base + ingredientes) vivem no **SQLite** (`data/pao.db`). São servidos em `GET /api/recipes` e `GET /api/recipes/:id`.
- **Edição dos defaults** está protegida por um *admin lock*: o user clica no 🔒, escreve a `ADMIN_PASSWORD` do `.env`, e recebe um token HMAC válido por 8h em `sessionStorage`. Todas as rotas mutantes (`PATCH`/`POST`/`DELETE`) exigem `Bearer` token via `requireAdmin` middleware.

No `App.tsx`, o flag derivado `isAdminEditingDefault = !isCustom && !!adminToken` decide se uma edição vai para o servidor (via `lib/api.ts` → `adminPatchIngredient` etc., seguido de `refreshDefaults()`) ou para localStorage (`mutateCustomRecipe`). **Receitas custom criadas pelo user normal nunca tocam no servidor** — ficam locais.

### Store no client (`client/src/lib/store.ts`)

Não é Redux nem Zustand — é um store manual com `useSyncExternalStore`. Tem uma única `let store` mutável, um `Set<listener>` e funções exportadas (`setRecipeId`, `setLoaves`, `setPriceOverride`, `addCustomRecipe`, …). Cada acção faz `store = {...store, …}` + `persist()` + `emit()`. **Não introduzir Zustand/Redux** sem pedir — a app não justifica.

### CSS — não converter para utilities Tailwind

O `client/src/styles.css` é o `styles.css` do protótipo (~870 linhas) preservado **1:1**. Por cima:
- `@import "tailwindcss";` + `@theme { … }` declara os tokens (`bg-paper`, `text-sienna`, etc. disponíveis como utilities).
- `:root { --paper: …; }` re-declara as variáveis com os nomes antigos para que o CSS legacy continue a funcionar sem search&replace.

**Não tentar converter os componentes para Tailwind utilities puros** — o design é editorial-denso e o JSX ficaria ilegível. Tailwind é para coisas novas (ex.: `lock-btn` no `AdminLockButton.tsx` ainda usa classes legacy, mas componentes novos podem usar utilities).

### Mapeamento snake_case ↔ camelCase

A DB usa `package_price`, `is_free`, `ingredient_key`, `section_id`. O client usa `packagePrice`, `free`, `key`, `id`. A conversão acontece em **dois sítios**:

- **DB → client:** `lib/api.ts → rowToRecipe()` (e os helpers internos `getRecipe`/`fetchAllRecipes`).
- **Client → DB nas rotas admin:** `server/routes/recipes.ts` tem maps explícitos (ex.: `isFree → is_free`).

Quando adicionares uma coluna nova, alterar **ambos os sítios** e os tipos em `client/src/types.ts`.

### Impressão (`#print-area`)

A `ShoppingList` clona o seu próprio `.list-card` para um `<div id="print-area">` na raiz do `body`, regista `afterprint` para limpar, e tem um `setTimeout(cleanup, 2000)` como fallback do Safari. **Não simplificar para `window.print()` directo** — provoca páginas em branco em Chrome/Safari por causa de pais com `display:none` ou `position:fixed`. Está no `@media print` do styles.css: `body > *:not(#print-area) { display: none !important; }`.

### Server (`server/`)

- `node:sqlite` builtin (Node ≥ 22, `--experimental-strip-types` não é necessário porque usamos `tsx` em dev e build em prod). PRAGMA `journal_mode=WAL`, `foreign_keys=ON`.
- `server/index.ts` em produção:
  - `/assets/*` → cache 1 ano imutável (Vite hash nos nomes)
  - `index.html`, `sw.js`, `manifest.webmanifest` → `Cache-Control: no-cache` (crítico para o PWA detectar updates)
  - SPA fallback: regex `/^\/(?!api|healthz).*/` para não engolir as rotas API.
- `server/routes/admin.ts` exige `ADMIN_SESSION_SECRET` com ≥16 chars — caso contrário lança no primeiro `/unlock`.

### Build de TS

Há **dois `tsconfig.json` separados** (client e server) ligados por um `tsconfig.json` raiz com referências. Não há `tsc -b` único; usa o `npm run lint` ou `npm run build` que sabem disto.

## Deploy

Deploy real é no VPS `brasume` (mesma máquina de `curvsync`, `words`, `sleep`, `embers`). Convenção:

- Código em `/var/www/pao/`, dono `ember:http-web`
- Apache serve `client/dist/` directamente (DocumentRoot); só `/api` e `/healthz` vão por proxy para Node em `127.0.0.1:3050`
- Vhost único em `scripts/apache/pao.brasume.com.conf.example` (HTTP redirect + HTTPS no mesmo ficheiro, estilo Curve-sync)
- SQLite em `/var/www/pao/data/pao.db`; backups em `/var/www/pao/data/backups/`

`deploy/install.sh` faz o post-clone (build, systemd, vhost, cron) **assumindo Apache+Certbot já instalados**. `ROADMAP.md` tem o passo-a-passo greenfield original — útil como referência mas o deploy real segue `deploy/README.md`.

**O Node em produção** continua a saber servir o SPA (cache headers + SPA fallback em `server/index.ts`), mas atrás de Apache esse código é redundante — Apache catch-all everything except `/api` e `/healthz`. Não remover; serve para correr `npm start` localmente sem Apache.

CI em `.github/workflows/ci.yml`: `lint + test + build + seed sanity-check` em Node 22.

## Coisas a evitar

- **Não criar rotas mutantes públicas.** Tudo o que não é `GET` em `/api/recipes` tem de estar depois do `recipesRouter.use(requireAdmin)`.
- **Não migrar para Postgres/MySQL** sem pedir. A app é single-user-implicit; o SQLite é proposital (zero ops, backup = copiar ficheiro).
- **Não tirar o protótipo** de `prototype/` — é referência para o port (e foi explicitamente preservado).
- **Não escrever `console.log` em código que vai para produção** — usar `console.error` para erros (já há um error handler centralizado no Express).
