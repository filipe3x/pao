import { getDb, initSchema } from "./db.js";

// Receita base "Pão sem glúten" — Apêndice A do HANDOFF.md.

const NOW = Date.now();

interface SeedIngredient {
  key: string;
  name: string;
  grams: number;
  unit?: "ml";
  packagePrice?: number;
  packageGrams?: number;
  free?: boolean;
  exact?: boolean;
  note?: string;
}
interface SeedSection {
  id: "seca" | "frescos" | "hacks";
  name: string;
  kicker: string;
  tone: "dry" | "fresh" | "hacks";
  optional?: boolean;
  ingredients: SeedIngredient[];
}
interface SeedRecipe {
  id: string;
  name: string;
  subtitle: string;
  weeklyConsumption: number;
  sections: SeedSection[];
}

const BASE: SeedRecipe = {
  id: "pao-sg-mm",
  name: "Pão sem glúten",
  subtitle: "Massa mãe · biológico · máquina panificadora",
  weeklyConsumption: 2,
  sections: [
    {
      id: "seca",
      name: "Mistura Seca",
      kicker: "prepara-se em avanço · dura semanas",
      tone: "dry",
      ingredients: [
        { key: "arroz",     name: "Farinha de arroz bio",           grams: 90, packagePrice: 1.09, packageGrams: 500 },
        { key: "amendoa",   name: "Farinha de amêndoa bio",         grams: 45, packagePrice: 3.99, packageGrams: 200 },
        { key: "aveia",     name: "Farinha de aveia s/glúten bio",  grams: 38, packagePrice: 3.58, packageGrams: 1000 },
        { key: "araruta",   name: "Farinha de araruta bio",         grams: 30, packagePrice: 3.06, packageGrams: 211 },
        { key: "avela",     name: "Avelã moída bio",                grams: 28, packagePrice: 5.29, packageGrams: 200,  exact: true },
        { key: "sarraceno", name: "Farinha de trigo sarraceno bio", grams: 24, packagePrice: 6.09, packageGrams: 1000, exact: true },
        { key: "sal",       name: "Sal marinho",                    grams: 5,  packagePrice: 3.99, packageGrams: 1000 }
      ]
    },
    {
      id: "frescos",
      name: "Frescos",
      kicker: "junta-se no dia",
      tone: "fresh",
      ingredients: [
        { key: "mm",     name: "Massa mãe activa 100% hid.", grams: 80,  free: true, note: "do frasco" },
        { key: "agua",   name: "Água filtrada morna",        grams: 220, unit: "ml", free: true, note: "da torneira" },
        { key: "coco",   name: "Óleo de coco bio",           grams: 15,  packagePrice: 4.39, packageGrams: 200 },
        { key: "geleia", name: "Geleia de arroz bio",        grams: 12,  packagePrice: 5.89, packageGrams: 520 }
      ]
    },
    {
      id: "hacks",
      name: "Hacks",
      kicker: "opcionais · usar conforme a massa pede",
      tone: "hacks",
      optional: true,
      ingredients: [
        { key: "psyllium", name: "Psyllium husk",           grams: 5, packagePrice: 6.99, packageGrams: 125, note: "dá elasticidade · sem ele reduz água p/ 160–180ml" },
        { key: "fermento", name: "Fermento seco s/glúten",  grams: 2, packagePrice: 1.49, packageGrams: 20,  note: "segurança se a massa mãe estiver fraca" }
      ]
    }
  ]
};

function seedRecipe(r: SeedRecipe): void {
  const db = getDb();

  const existing = db.prepare("SELECT id FROM recipes WHERE id = ?").get(r.id);
  if (existing) {
    console.log(`[seed] ${r.id} já existe — skip.`);
    return;
  }

  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO recipes (id, name, subtitle, weekly_consumption, is_custom, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`
    ).run(r.id, r.name, r.subtitle, r.weeklyConsumption, NOW, NOW);

    const insSec = db.prepare(
      `INSERT INTO sections (recipe_id, section_id, name, kicker, tone, optional, sort_index)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const insIng = db.prepare(
      `INSERT INTO ingredients
        (recipe_id, section_id, ingredient_key, name, grams, unit, package_price, package_grams,
         is_free, is_exact, note, sort_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    r.sections.forEach((s, sIdx) => {
      insSec.run(r.id, s.id, s.name, s.kicker, s.tone, s.optional ? 1 : 0, sIdx);
      s.ingredients.forEach((i, iIdx) => {
        insIng.run(
          r.id,
          s.id,
          i.key,
          i.name,
          i.grams,
          i.unit ?? null,
          i.packagePrice ?? 0,
          i.packageGrams ?? 1000,
          i.free ? 1 : 0,
          i.exact ? 1 : 0,
          i.note ?? null,
          iIdx
        );
      });
    });

    db.exec("COMMIT");
    const total = r.sections.reduce((a, s) => a + s.ingredients.length, 0);
    console.log(`[seed] ${r.id} criada com ${r.sections.length} secções e ${total} ingredientes.`);
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

initSchema(getDb());
seedRecipe(BASE);
