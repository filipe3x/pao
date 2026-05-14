export type SectionId = "seca" | "frescos" | "hacks";
export type SectionTone = "dry" | "fresh" | "hacks";

export interface Ingredient {
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

export interface Section {
  id: SectionId;
  name: string;
  kicker: string;
  tone: SectionTone;
  optional?: boolean;
  ingredients: Ingredient[];
}

export interface Recipe {
  id: string;
  name: string;
  subtitle?: string;
  weeklyConsumption?: number;
  custom?: boolean;
  sections: Section[];
}

export interface PriceOverride {
  price: number;
  grams: number;
}

export type PricesByRecipe = Record<string, Record<string, PriceOverride>>;

export interface PersistedState {
  recipeId: string;
  loaves: number;
  prices: PricesByRecipe;
  includeHacks: boolean;
  customRecipes: Recipe[];
}
