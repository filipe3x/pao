import { Router } from "express";
import { getDb } from "../db.js";
import { requireAdmin } from "./admin.js";

export const recipesRouter = Router();

recipesRouter.get("/", (_req, res) => {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM recipes ORDER BY is_custom, name").all();
  res.json(rows);
});

recipesRouter.get("/:id", (req, res) => {
  const db = getDb();
  const recipe = db.prepare("SELECT * FROM recipes WHERE id = ?").get(req.params.id);
  if (!recipe) return res.status(404).json({ error: "not_found" });
  const sections = db
    .prepare("SELECT * FROM sections WHERE recipe_id = ? ORDER BY sort_index")
    .all(req.params.id);
  const ingredients = db
    .prepare("SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY sort_index")
    .all(req.params.id);
  res.json({ ...recipe, sections, ingredients });
});

// Edição de defaults globais — exige admin lock destrancado.
// As rotas PATCH/POST/DELETE concretas ficam para a Fase 3.
recipesRouter.use(requireAdmin);
