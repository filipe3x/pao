import { getDb, initSchema } from "./db.js";

// Seed da receita base "Pão sem glúten" — Apêndice A do HANDOFF.md.
// A Fase 3 vai preencher esta função com os dados reais; este stub deixa o script
// utilizável (npm run db:seed) desde já e cria a estrutura.

const NOW = Date.now();

const BASE_RECIPE = {
  id: "pao-sg-mm",
  name: "Pão sem glúten",
  subtitle: "Massa-mãe · sem glúten · alta hidratação",
  weekly_consumption: 2
};

const SECTIONS = [
  { section_id: "seca",    name: "Mistura seca", kicker: "Farinhas e sal", tone: "dry",    optional: 0, sort_index: 0 },
  { section_id: "frescos", name: "Frescos",      kicker: "Hidratação",     tone: "fresh",  optional: 0, sort_index: 1 },
  { section_id: "hacks",   name: "Hacks",        kicker: "Opcionais",      tone: "hacks",  optional: 1, sort_index: 2 }
];

function seed(): void {
  const db = getDb();
  initSchema(db);

  const existing = db.prepare("SELECT id FROM recipes WHERE id = ?").get(BASE_RECIPE.id);
  if (existing) {
    console.log(`[seed] receita base já existe (${BASE_RECIPE.id}) — skip.`);
    return;
  }

  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO recipes (id, name, subtitle, weekly_consumption, is_custom, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`
    ).run(BASE_RECIPE.id, BASE_RECIPE.name, BASE_RECIPE.subtitle, BASE_RECIPE.weekly_consumption, NOW, NOW);

    const insSec = db.prepare(
      `INSERT INTO sections (recipe_id, section_id, name, kicker, tone, optional, sort_index)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const s of SECTIONS) {
      insSec.run(BASE_RECIPE.id, s.section_id, s.name, s.kicker, s.tone, s.optional, s.sort_index);
    }

    db.exec("COMMIT");
    console.log(`[seed] receita base criada (sem ingredientes — Fase 3 preenche).`);
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

seed();
