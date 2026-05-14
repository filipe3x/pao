import type { Recipe } from "../types";

interface RecipeRow {
  id: string;
  name: string;
  subtitle: string | null;
  weekly_consumption: number;
  is_custom: number;
}

interface SectionRow {
  recipe_id: string;
  section_id: "seca" | "frescos" | "hacks";
  name: string;
  kicker: string | null;
  tone: "dry" | "fresh" | "hacks";
  optional: number;
  sort_index: number;
}

interface IngredientRow {
  recipe_id: string;
  section_id: "seca" | "frescos" | "hacks";
  ingredient_key: string;
  name: string;
  grams: number;
  unit: string | null;
  package_price: number | null;
  package_grams: number | null;
  is_free: number;
  is_exact: number;
  note: string | null;
  sort_index: number;
}

interface RecipeDetail extends RecipeRow {
  sections: SectionRow[];
  ingredients: IngredientRow[];
}

function rowToRecipe(detail: RecipeDetail): Recipe {
  const sections = [...detail.sections]
    .sort((a, b) => a.sort_index - b.sort_index)
    .map((s) => {
      const ingredients = detail.ingredients
        .filter((i) => i.section_id === s.section_id)
        .sort((a, b) => a.sort_index - b.sort_index)
        .map((i) => ({
          key: i.ingredient_key,
          name: i.name,
          grams: i.grams,
          unit: i.unit === "ml" ? ("ml" as const) : undefined,
          packagePrice: i.package_price ?? undefined,
          packageGrams: i.package_grams ?? undefined,
          free: i.is_free === 1,
          exact: i.is_exact === 1,
          note: i.note ?? undefined
        }));
      return {
        id: s.section_id,
        name: s.name,
        kicker: s.kicker ?? "",
        tone: s.tone,
        optional: s.optional === 1,
        ingredients
      };
    });
  return {
    id: detail.id,
    name: detail.name,
    subtitle: detail.subtitle ?? undefined,
    weeklyConsumption: detail.weekly_consumption,
    custom: detail.is_custom === 1,
    sections
  };
}

export async function listRecipes(): Promise<RecipeRow[]> {
  const r = await fetch("/api/recipes");
  if (!r.ok) throw new Error(`listRecipes: ${r.status}`);
  return r.json();
}

export async function getRecipe(id: string): Promise<Recipe> {
  const r = await fetch(`/api/recipes/${encodeURIComponent(id)}`);
  if (!r.ok) throw new Error(`getRecipe(${id}): ${r.status}`);
  const detail = (await r.json()) as RecipeDetail;
  return rowToRecipe(detail);
}

export async function fetchAllRecipes(): Promise<Recipe[]> {
  const list = await listRecipes();
  const details = await Promise.all(list.map((row) => getRecipe(row.id)));
  return details;
}

// Admin lock — preparado para Fase 3.
export async function adminUnlock(password: string): Promise<string> {
  const r = await fetch("/api/admin/unlock", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password })
  });
  if (!r.ok) throw new Error("invalid_password");
  const { token } = (await r.json()) as { token: string };
  return token;
}
