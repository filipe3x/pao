import { Router, type Request, type Response } from "express";
import { getDb } from "../db.js";
import { requireAdmin } from "./admin.js";

export const recipesRouter = Router();

// ── GET — público ────────────────────────────────────────────────

recipesRouter.get("/", (_req, res) => {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM recipes ORDER BY is_custom, name").all();
  res.json(rows);
});

recipesRouter.get("/:id", (req, res) => {
  const db = getDb();
  const recipe = db.prepare("SELECT * FROM recipes WHERE id = ?").get(req.params.id);
  if (!recipe) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const sections = db
    .prepare("SELECT * FROM sections WHERE recipe_id = ? ORDER BY sort_index")
    .all(req.params.id);
  const ingredients = db
    .prepare("SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY sort_index")
    .all(req.params.id);
  res.json({ ...recipe, sections, ingredients });
});

// ── Tudo o que muta os defaults globais exige admin destrancado. ───
recipesRouter.use(requireAdmin);

// PATCH /api/recipes/:id — actualiza meta (nome, subtitle, weekly_consumption)
recipesRouter.patch("/:id", (req, res) => {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM recipes WHERE id = ?").get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const { name, subtitle, weeklyConsumption } = (req.body ?? {}) as {
    name?: string;
    subtitle?: string;
    weeklyConsumption?: number;
  };
  const fields: string[] = [];
  const values: (string | number)[] = [];
  if (typeof name === "string" && name.trim()) {
    fields.push("name = ?");
    values.push(name.trim());
  }
  if (typeof subtitle === "string") {
    fields.push("subtitle = ?");
    values.push(subtitle);
  }
  if (typeof weeklyConsumption === "number" && weeklyConsumption > 0) {
    fields.push("weekly_consumption = ?");
    values.push(weeklyConsumption);
  }
  if (fields.length === 0) {
    res.status(400).json({ error: "no_fields" });
    return;
  }
  fields.push("updated_at = ?");
  values.push(Date.now());
  values.push(req.params.id);
  db.prepare(`UPDATE recipes SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

// PATCH /api/recipes/:id/ingredients/:key — edita ingrediente existente
recipesRouter.patch("/:id/ingredients/:key", (req, res) => {
  const db = getDb();
  const id = String(req.params.id);
  const key = String(req.params.key);
  const existing = db
    .prepare("SELECT recipe_id FROM ingredients WHERE recipe_id = ? AND ingredient_key = ?")
    .get(id, key);
  if (!existing) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const patch = (req.body ?? {}) as Partial<{
    name: string;
    grams: number;
    unit: "ml" | null;
    packagePrice: number;
    packageGrams: number;
    isFree: boolean;
    isExact: boolean;
    note: string | null;
  }>;
  const map: Record<string, string> = {
    name: "name",
    grams: "grams",
    unit: "unit",
    packagePrice: "package_price",
    packageGrams: "package_grams",
    isFree: "is_free",
    isExact: "is_exact",
    note: "note"
  };
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [k, col] of Object.entries(map)) {
    if (!(k in patch)) continue;
    let v = (patch as Record<string, unknown>)[k];
    if (k === "isFree" || k === "isExact") v = v ? 1 : 0;
    fields.push(`${col} = ?`);
    values.push(v as string | number | null);
  }
  if (fields.length === 0) {
    res.status(400).json({ error: "no_fields" });
    return;
  }
  values.push(id, key);
  db.prepare(
    `UPDATE ingredients SET ${fields.join(", ")} WHERE recipe_id = ? AND ingredient_key = ?`
  ).run(...values);
  bumpUpdatedAt(id);
  res.json({ ok: true });
});

// POST /api/recipes/:id/ingredients — adiciona ingrediente a uma secção
recipesRouter.post("/:id/ingredients", (req: Request, res: Response) => {
  const db = getDb();
  const id = String(req.params.id);
  const recipe = db.prepare("SELECT id FROM recipes WHERE id = ?").get(id);
  if (!recipe) {
    res.status(404).json({ error: "recipe_not_found" });
    return;
  }
  const body = (req.body ?? {}) as {
    sectionId?: "seca" | "frescos" | "hacks";
    ingredientKey?: string;
    name?: string;
    grams?: number;
    unit?: "ml";
    packagePrice?: number;
    packageGrams?: number;
    isFree?: boolean;
    isExact?: boolean;
    note?: string | null;
  };
  if (!body.sectionId || !body.name || typeof body.grams !== "number") {
    res.status(400).json({ error: "missing_fields" });
    return;
  }
  const section = db
    .prepare("SELECT 1 FROM sections WHERE recipe_id = ? AND section_id = ?")
    .get(id, body.sectionId);
  if (!section) {
    res.status(400).json({ error: "section_not_found" });
    return;
  }
  const key =
    body.ingredientKey?.trim() ||
    "i-" + Math.random().toString(36).slice(2, 9);
  const nextSort = (db
    .prepare("SELECT COALESCE(MAX(sort_index), -1) + 1 AS n FROM ingredients WHERE recipe_id = ? AND section_id = ?")
    .get(id, body.sectionId) as { n: number }).n;

  db.prepare(
    `INSERT INTO ingredients
       (recipe_id, section_id, ingredient_key, name, grams, unit,
        package_price, package_grams, is_free, is_exact, note, sort_index)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    body.sectionId,
    key,
    body.name,
    body.grams,
    body.unit ?? null,
    body.packagePrice ?? 0,
    body.packageGrams ?? 1000,
    body.isFree ? 1 : 0,
    body.isExact ? 1 : 0,
    body.note ?? null,
    nextSort
  );
  bumpUpdatedAt(id);
  res.status(201).json({ ok: true, ingredientKey: key });
});

// DELETE /api/recipes/:id/ingredients/:key
recipesRouter.delete("/:id/ingredients/:key", (req, res) => {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM ingredients WHERE recipe_id = ? AND ingredient_key = ?")
    .run(req.params.id, req.params.key);
  if (result.changes === 0) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  bumpUpdatedAt(req.params.id);
  res.json({ ok: true });
});

function bumpUpdatedAt(recipeId: string): void {
  getDb().prepare("UPDATE recipes SET updated_at = ? WHERE id = ?").run(Date.now(), recipeId);
}
