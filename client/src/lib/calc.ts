import type { Ingredient, PriceOverride, Recipe } from "../types";

export interface PriceInfo {
  packagePrice: number;
  packageGrams: number;
  pricePerKg: number;
}

export function priceInfo(ing: Ingredient, override?: PriceOverride): PriceInfo {
  const packagePrice = override?.price != null ? override.price : ing.packagePrice ?? 0;
  const packageGrams = override?.grams != null ? override.grams : ing.packageGrams ?? 1000;
  const pricePerKg = packageGrams > 0 ? (packagePrice * 1000) / packageGrams : 0;
  return { packagePrice, packageGrams, pricePerKg };
}

export interface Totals {
  dryG: number;
  totalCost: number;
  perLoaf: number;
}

export function computeTotals(
  recipe: Recipe,
  loaves: number,
  prices: Record<string, PriceOverride>,
  includeHacks: boolean
): Totals {
  const allSec = recipe.sections.filter((s) => s.id !== "hacks" || includeHacks);
  let dryG = 0;
  let totalCost = 0;
  for (const s of allSec) {
    for (const i of s.ingredients) {
      if (i.unit !== "ml" && s.id === "seca") {
        dryG += i.grams * loaves;
      }
      if (!i.free) {
        const { pricePerKg } = priceInfo(i, prices[i.key]);
        totalCost += ((i.grams * loaves) / 1000) * pricePerKg;
      }
    }
  }
  return { dryG, totalCost, perLoaf: loaves > 0 ? totalCost / loaves : 0 };
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

const BLANK_SECTIONS = (): Recipe["sections"] => [
  { id: "seca", name: "Mistura Seca", kicker: "prepara-se em avanço · dura semanas", tone: "dry", ingredients: [] },
  { id: "frescos", name: "Frescos", kicker: "junta-se no dia", tone: "fresh", ingredients: [] },
  { id: "hacks", name: "Hacks", kicker: "opcionais · usar conforme a massa pede", tone: "hacks", optional: true, ingredients: [] }
];

export function cloneRecipe(src: Recipe, newName: string): Recipe {
  return {
    id: "r-" + uid(),
    name: newName,
    subtitle: src.subtitle,
    weeklyConsumption: src.weeklyConsumption ?? 2,
    custom: true,
    sections: src.sections.map((s) => ({
      ...s,
      ingredients: s.ingredients.map((i) => ({ ...i }))
    }))
  };
}

export function blankRecipe(newName: string): Recipe {
  return {
    id: "r-" + uid(),
    name: newName,
    subtitle: "receita personalizada",
    weeklyConsumption: 2,
    custom: true,
    sections: BLANK_SECTIONS()
  };
}
