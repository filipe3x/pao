# Handoff — pao.brasume.com

**De:** Claude Design  
**Para:** Claude Code  
**Projecto:** Calculadora de pão sem glúten  
**Domínio:** `pao.brasume.com`

---

## TL;DR

Pegar no protótipo HTML/React/Babel que já existe (3 ficheiros: `Calculadora do Pão.html`, `styles.css`, `app.jsx`, `recipes.js`) e portá-lo para uma stack de produção real:

- **Build:** Vite + React + TypeScript
- **CSS:** Tailwind v4 (com tokens custom do design system — paper sépia, sienna, sage)
- **Servidor:** Node (>=22) + Express ou Fastify
- **Persistência:** SQLite **nativo** (`node:sqlite`, builtin no Node 22+)
- **Deploy:** `pao.brasume.com` (Nginx/Caddy → proxy para Node)

A lógica de cálculo, o design e os defaults estão prontos. O que falta é **persistência server-side** (multi-device, multi-utilizador opcional), CRUD de receitas em sqlite, e um build optimizado.

---

## Stack escolhida e porquê

| Camada | Escolha | Notas |
|---|---|---|
| Build | **Vite 6 + React 18 + TypeScript** | DX rápido, HMR, output minúsculo |
| CSS | **Tailwind v4** (`@import "tailwindcss"`) | Utility-first. Os tokens do design (paper, sienna, sage, fonts) ficam num `@theme` block — não precisas de `tailwind.config.js` na v4 |
| State | React state local + `useSyncExternalStore` para o store | Sem Redux/Zustand. App é pequena |
| Server | **Express** (mais simples) ou Fastify | Só precisa de servir o SPA + 5 endpoints JSON |
| DB | **`node:sqlite`** (Node ≥22) | Builtin, zero deps nativas. Alternativa: `better-sqlite3` se precisares de Node <22 |
| Fonts | Self-hosted (Newsreader, Manrope, JetBrains Mono) | Já vêm de Google Fonts no protótipo; passar para `@fontsource/*` |
| Runtime | Node 22 LTS | Para o sqlite builtin |
| Reverse proxy | Caddy (recomendado) ou Nginx | HTTPS automático com Caddy |

### Porquê SQLite nativo e não Postgres/MySQL?
- A escala é "um utilizador, um caderno de receitas" — não há concorrência real
- Zero ops, zero deps nativas, backup é copiar um ficheiro
- `node:sqlite` é builtin no Node 22 → sem `node-gyp`, sem `prebuild-install`

### Porquê Tailwind e não CSS modules?
O protótipo usa um `styles.css` denso (~870 linhas) com classes BEM-ish. Tailwind v4 permite reescrever isto como utilities mantendo os mesmos design tokens via `@theme` — mais fácil de iterar e de manter coerente. Não há páginas suficientes para justificar CSS modules.

---

## Estrutura do repositório

```
pao-brasume/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .env.example
├── README.md
├── client/                        # frontend (Vite root)
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── styles.css             # @import "tailwindcss" + @theme tokens
│   │   ├── components/
│   │   │   ├── Masthead.tsx
│   │   │   ├── RecipeTabs.tsx
│   │   │   ├── Controls.tsx       # slider + KPIs
│   │   │   ├── Panel.tsx          # Mistura Seca / Frescos / Hacks
│   │   │   ├── IngredientRow.tsx
│   │   │   ├── ShoppingList.tsx
│   │   │   ├── NewRecipeModal.tsx
│   │   │   ├── ExactStamp.tsx
│   │   │   └── PrintArea.tsx      # clone-into-body para impressão
│   │   ├── lib/
│   │   │   ├── api.ts             # fetch wrappers para /api/*
│   │   │   ├── calc.ts            # priceInfo, totals, packages
│   │   │   ├── format.ts          # fmtEur, fmtG, fmtMl
│   │   │   └── store.ts           # store global com syncExternalStore
│   │   └── types.ts               # Recipe, Section, Ingredient, Price
├── server/
│   ├── index.ts                   # Express bootstrap
│   ├── db.ts                      # node:sqlite + schema
│   ├── routes/
│   │   ├── recipes.ts             # CRUD receitas
│   │   ├── prices.ts              # overrides de preço/embalagem
│   │   └── settings.ts            # loaves, includeHacks, recipeId activa
│   └── seed.ts                    # popula a receita base "Pão sem glúten"
└── data/
    └── pao.db                     # criado em runtime; em .gitignore
```

Em produção, o servidor serve `client/dist/` como estáticos e responde a `/api/*`.

---

## Modelo de dados (SQLite)

```sql
-- users: opcional (única-pessoa para já, mas deixar a coluna pronta)
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT UNIQUE,
  created_at  INTEGER NOT NULL
);

-- receitas
CREATE TABLE IF NOT EXISTS recipes (
  id                    TEXT PRIMARY KEY,         -- 'pao-sg-mm' (base) ou 'r-XXX' (custom)
  user_id               TEXT,                     -- NULL = base/system; FK para users.id
  name                  TEXT NOT NULL,
  subtitle              TEXT,
  weekly_consumption    REAL DEFAULT 2,
  is_custom             INTEGER NOT NULL DEFAULT 0,  -- 0 = base (read-only), 1 = user-owned
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- secções (Mistura Seca, Frescos, Hacks) — fixas por receita mas guardadas
CREATE TABLE IF NOT EXISTS sections (
  id          TEXT PRIMARY KEY,                 -- 'seca' | 'frescos' | 'hacks' (scoped por recipe_id)
  recipe_id   TEXT NOT NULL,
  section_id  TEXT NOT NULL,                    -- 'seca' / 'frescos' / 'hacks'
  name        TEXT NOT NULL,
  kicker      TEXT,
  tone        TEXT NOT NULL,                    -- 'dry' | 'fresh' | 'hacks'
  optional    INTEGER NOT NULL DEFAULT 0,
  sort_index  INTEGER NOT NULL,
  UNIQUE (recipe_id, section_id),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

-- ingredientes (sources of truth: gramas/pão + defaults de embalagem)
CREATE TABLE IF NOT EXISTS ingredients (
  id              TEXT PRIMARY KEY,             -- ex 'arroz', 'i-XXX' para custom
  recipe_id       TEXT NOT NULL,
  section_id      TEXT NOT NULL,
  ingredient_key  TEXT NOT NULL,                -- key interno usado no client
  name            TEXT NOT NULL,
  grams           REAL NOT NULL,                -- por pão
  unit            TEXT,                         -- NULL = g (default), 'ml' para água
  package_price   REAL DEFAULT 0,
  package_grams   REAL DEFAULT 1000,
  is_free         INTEGER NOT NULL DEFAULT 0,
  is_exact        INTEGER NOT NULL DEFAULT 0,
  note            TEXT,
  sort_index      INTEGER NOT NULL,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (recipe_id, section_id) REFERENCES sections(recipe_id, section_id)
);

-- overrides de preço por utilizador (preserva o protótipo: cada utilizador pode
-- ajustar o preço/tamanho da embalagem sem mexer no default da receita base)
CREATE TABLE IF NOT EXISTS price_overrides (
  user_id         TEXT NOT NULL,
  recipe_id       TEXT NOT NULL,
  ingredient_key  TEXT NOT NULL,
  package_price   REAL NOT NULL,
  package_grams   REAL NOT NULL,
  updated_at      INTEGER NOT NULL,
  PRIMARY KEY (user_id, recipe_id, ingredient_key)
);

-- estado de UI por utilizador (qty pães, hacks toggle, receita activa)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id        TEXT PRIMARY KEY,
  active_recipe  TEXT,
  loaves         INTEGER DEFAULT 12,
  include_hacks  INTEGER DEFAULT 0,
  updated_at     INTEGER NOT NULL
);
```

### Receita base ("Pão sem glúten") — seed
Está em `recipes.js` do protótipo. Os valores a importar **tal como estão hoje** (depois das últimas afinações do utilizador) seguem em [Apêndice A](#apêndice-a-—-defaults-da-receita-base).

---

## API REST

Base: `/api`. Todas as respostas são JSON. Para já assume um único utilizador implícito (`user_id = 'default'`); deixar middleware preparado para auth futura.

| Método | Endpoint | Descrição |
|---|---|---|
| `GET`    | `/recipes`                        | Lista todas as receitas (base + custom do utilizador) |
| `GET`    | `/recipes/:id`                    | Receita completa com secções + ingredientes |
| `POST`   | `/recipes`                        | Cria receita (de blank ou clonando outra). Body: `{name, sourceId?: string}` |
| `PATCH`  | `/recipes/:id`                    | Renomeia / actualiza meta. Apenas custom |
| `DELETE` | `/recipes/:id`                    | Apaga (apenas custom) — cascata em secções/ingredientes/overrides |
| `POST`   | `/recipes/:id/ingredients`        | Adiciona ingrediente. Body: `{sectionId, name, grams, packagePrice, packageGrams}` |
| `PATCH`  | `/recipes/:id/ingredients/:key`   | Edita ingrediente (custom recipes only) |
| `DELETE` | `/recipes/:id/ingredients/:key`   | Remove ingrediente (custom only) |
| `PUT`    | `/recipes/:id/prices/:key`        | Override de preço/embalagem do utilizador. Body: `{packagePrice, packageGrams}` |
| `DELETE` | `/recipes/:id/prices`             | Reset de todos os overrides desta receita |
| `GET`    | `/settings`                       | Estado UI persistente |
| `PUT`    | `/settings`                       | Actualiza `{activeRecipe?, loaves?, includeHacks?}` |

**Migração do `localStorage`**: ao primeiro arranque, se o client tiver o chave `calc-pao-v1`, importa-a via `POST /api/import-local-storage` (definir endpoint utilitário) e apaga-a localmente.

---

## Frontend — notas de port

1. **Tirar a Babel runtime**. Os ficheiros `.jsx` actuais passam por `<script type="text/babel">`. No Vite, renomeia para `.tsx`, tipa os props com as interfaces de `types.ts`, e usa `import` nativos.

2. **Manter os componentes 1:1**: `Masthead`, `RecipeTabs`, `Controls`, `Panel`, `IngredientRow`, `ExactStamp`, `ShoppingList`, `NewRecipeModal`, `PrintArea`. A árvore actual já é limpa.

3. **Tailwind v4 setup**:
   ```css
   /* src/styles.css */
   @import "tailwindcss";

   @theme {
     --color-paper:       #f4ecdc;
     --color-paper-2:     #faf4e6;
     --color-paper-deep:  #ece1c6;
     --color-dry-bg:      #ede2c8;
     --color-fresh-bg:    #e2ebdf;
     --color-hacks-bg:    #efe6d2;
     --color-ink:         #2a1d12;
     --color-ink-soft:    #6b5640;
     --color-ink-faint:   #9a8870;
     --color-sienna:      #b04826;
     --color-sage:        #5b6e3f;

     --font-display: "Newsreader", "Iowan Old Style", Georgia, serif;
     --font-body:    "Manrope", system-ui, sans-serif;
     --font-mono:    "JetBrains Mono", ui-monospace, monospace;
   }

   /* Manter as poucas regras que Tailwind não dá bem:
      - paper-grain via SVG noise overlay
      - exact-stamp rotation
      - print styles (#print-area)
      - range slider thumb / track */
   ```

4. **Impressão**: o truque de clonar `.list-card` para um `#print-area` antes de `window.print()` (e cleanup no `afterprint`) deve ser preservado tal e qual. É a solução que finalmente funcionou cross-browser sem páginas em branco. Está em `app.jsx` — mover para `PrintArea.tsx`.

5. **Persistência online**: substituir as chamadas a `localStorage` por chamadas API com **optimistic updates** + debounce (300ms) nas edições de preço. O store em `lib/store.ts` deve manter o estado em memória e sincronizar com o servidor.

6. **Speakers do servidor**: O `recipes.js` deixa de ser estático no client — passa a vir de `GET /api/recipes`. A receita base é seed-ada no DB pelo `server/seed.ts` na primeira execução.

---

## Comandos esperados

```bash
# dev (terminal único, com vite proxy → server)
pnpm install
pnpm dev               # vite (5173) + server (3000) via concurrently

# build
pnpm build             # tsc -b && vite build → client/dist
pnpm start             # node --env-file=.env server/index.ts

# scripts
pnpm db:seed           # popula receita base no SQLite
pnpm db:reset          # apaga ./data/pao.db e seed do zero
pnpm db:backup         # cp ./data/pao.db ./data/backups/pao-$(date +%F).db
```

`package.json` mínimo:
```json
{
  "type": "module",
  "engines": { "node": ">=22.0.0" },
  "scripts": {
    "dev": "concurrently -k -n vite,server -c blue,green \"vite\" \"node --watch --env-file=.env server/index.ts\"",
    "build": "tsc -b && vite build",
    "start": "node --env-file=.env server/index.ts",
    "db:seed": "node --env-file=.env server/seed.ts",
    "db:reset": "rm -f data/pao.db && pnpm db:seed"
  }
}
```

---

## Deploy — pao.brasume.com

1. **Servidor**: Node 22 a correr o build. PM2 ou systemd.
2. **Proxy**: Caddy (recomendado pela simplicidade):
   ```
   pao.brasume.com {
     reverse_proxy localhost:3000
     encode gzip zstd
   }
   ```
   Caddy trata do certificado Let's Encrypt automaticamente.
3. **Backup do SQLite**: cron diário a copiar `data/pao.db` para um S3/Backblaze ou simplesmente para `data/backups/`. Usar `VACUUM INTO` para snapshots consistentes:
   ```sql
   VACUUM INTO '/data/backups/pao-2026-05-14.db';
   ```
4. **Variáveis (`.env`)**:
   ```
   PORT=3000
   NODE_ENV=production
   DB_PATH=./data/pao.db
   ```

---

## Critérios de aceitação

- [ ] Página servida em `pao.brasume.com` com HTTPS
- [ ] Estética visual idêntica ao protótipo HTML
- [ ] Tabs de receitas, slider de pães, painéis editáveis, lista de compras imprimível — todas as features actuais
- [ ] CRUD de receitas personalizadas via API
- [ ] Overrides de preço/embalagem persistem em SQLite, não em localStorage
- [ ] Botão "Imprimir" gera **exactamente uma página** (já resolvido no protótipo, manter a estratégia)
- [ ] Migração one-shot de `localStorage` antigo → server
- [ ] Backup do SQLite documentado no README

---

## Apêndice A — defaults da receita base

Receita `pao-sg-mm` ("Pão sem glúten"), `weekly_consumption: 2`:

### Mistura Seca
| key | name | grams/pão | package_price | package_grams | exact |
|---|---|---|---|---|---|
| arroz | Farinha de arroz bio | 90 | 1.09 | 500 | – |
| amendoa | Farinha de amêndoa bio | 45 | 3.99 | 200 | – |
| aveia | Farinha de aveia s/glúten bio | 38 | 3.58 | 1000 | – |
| araruta | Farinha de araruta bio | 30 | 3.06 | 211 | – |
| avela | Avelã moída bio | 28 | 5.29 | 200 | ✓ |
| sarraceno | Farinha de trigo sarraceno bio | 24 | 6.09 | 1000 | ✓ |
| sal | Sal marinho | 5 | 3.99 | 1000 | – |

### Frescos
| key | name | grams/pão | unit | is_free | package_price | package_grams |
|---|---|---|---|---|---|---|
| mm | Massa mãe activa 100% hid. | 80 | g | ✓ | – | – |
| agua | Água filtrada morna | 220 | ml | ✓ | – | – |
| coco | Óleo de coco bio | 15 | g | – | 4.39 | 200 |
| geleia | Geleia de arroz bio | 12 | g | – | 5.89 | 520 |

### Hacks (`optional: true`)
| key | name | grams/pão | package_price | package_grams | note |
|---|---|---|---|---|---|
| psyllium | Psyllium husk | 5 | 6.99 | 125 | dá elasticidade · sem ele reduz água p/ 160–180ml |
| fermento | Fermento seco s/glúten | 2 | 1.49 | 20 | segurança se a massa mãe estiver fraca |

---

## Apêndice B — Decisões a confirmar com o utilizador

1. **Auth**: para já assumir single-user. Se o utilizador quiser partilhar com pessoas, adicionar magic-link via email mais tarde (Resend + JWT) — schema já preparado.
2. **i18n**: tudo em PT-PT por agora. Se precisar de EN, extrair strings para `client/src/i18n/`.
3. **PWA**: vale a pena? Útil para usar no telemóvel na loja com a lista de compras. Adicionar `vite-plugin-pwa` se sim.
4. **Receitas adicionais**: o protótipo já tem arquitectura multi-receita. Quando ele criar mais (centeio, integral, etc.), basta usar o botão "+ nova receita" no client — sem trabalho adicional no servidor.
