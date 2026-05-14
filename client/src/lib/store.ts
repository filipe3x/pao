import { useSyncExternalStore } from "react";
import type { PersistedState, PricesByRecipe, Recipe } from "../types";

const STORAGE_KEY = "calc-pao-v2";
const LEGACY_KEY = "calc-pao-v1";

const DEFAULT_STATE: PersistedState = {
  recipeId: "",
  loaves: 12,
  prices: {},
  includeHacks: false,
  customRecipes: []
};

function migrateLegacyPrices(prices: PricesByRecipe): PricesByRecipe {
  // v1 guardava `prices[rid][key]` como número (€/kg). v2 é { price, grams }.
  const out: PricesByRecipe = {};
  for (const rid of Object.keys(prices)) {
    const bucket = prices[rid];
    if (!bucket || typeof bucket !== "object") continue;
    out[rid] = {};
    for (const k of Object.keys(bucket)) {
      const v = (bucket as Record<string, unknown>)[k];
      if (typeof v === "number") {
        out[rid][k] = { price: v, grams: 1000 };
      } else if (v && typeof v === "object" && "price" in v && "grams" in v) {
        out[rid][k] = v as { price: number; grams: number };
      }
    }
  }
  return out;
}

function loadInitial(): PersistedState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const rawV2 = window.localStorage.getItem(STORAGE_KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as Partial<PersistedState>;
      return {
        ...DEFAULT_STATE,
        ...parsed,
        prices: migrateLegacyPrices(parsed.prices ?? {}),
        customRecipes: Array.isArray(parsed.customRecipes) ? parsed.customRecipes : []
      };
    }
    const rawV1 = window.localStorage.getItem(LEGACY_KEY);
    if (rawV1) {
      const parsed = JSON.parse(rawV1) as Partial<PersistedState>;
      const migrated: PersistedState = {
        ...DEFAULT_STATE,
        ...parsed,
        prices: migrateLegacyPrices(parsed.prices ?? {}),
        customRecipes: Array.isArray(parsed.customRecipes) ? parsed.customRecipes : []
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      window.localStorage.removeItem(LEGACY_KEY);
      return migrated;
    }
  } catch {
    /* fallthrough */
  }
  return DEFAULT_STATE;
}

interface StoreShape {
  state: PersistedState;
  recipes: Recipe[];      // defaults (do servidor) + customRecipes (local)
  defaults: Recipe[];     // só os defaults
  loadingDefaults: boolean;
  defaultsError: string | null;
  adminToken: string | null;
}

const ADMIN_TOKEN_KEY = "pao-admin-token";

function loadAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

let store: StoreShape = {
  state: loadInitial(),
  recipes: [],
  defaults: [],
  loadingDefaults: true,
  defaultsError: null,
  adminToken: loadAdminToken()
};

const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store.state));
  } catch {
    /* ignore quota errors */
  }
}

function recomputeRecipes(): void {
  store = { ...store, recipes: [...store.defaults, ...store.state.customRecipes] };
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): StoreShape {
  return store;
}

export function useStore<T>(selector: (s: StoreShape) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(store),
    () => selector(store)
  );
}

// ── Actions ────────────────────────────────────────────────────────

export function setDefaults(recipes: Recipe[]): void {
  store = { ...store, defaults: recipes, loadingDefaults: false, defaultsError: null };
  recomputeRecipes();
  if (!store.state.recipeId && recipes.length > 0) {
    store = { ...store, state: { ...store.state, recipeId: recipes[0].id } };
    persist();
  }
  emit();
}

export function setDefaultsError(err: string): void {
  store = { ...store, loadingDefaults: false, defaultsError: err };
  emit();
}

export function setRecipeId(id: string): void {
  store = { ...store, state: { ...store.state, recipeId: id } };
  persist();
  emit();
}

export function setLoaves(loaves: number): void {
  store = { ...store, state: { ...store.state, loaves } };
  persist();
  emit();
}

export function setIncludeHacks(v: boolean): void {
  store = { ...store, state: { ...store.state, includeHacks: v } };
  persist();
  emit();
}

export function setPriceOverride(
  recipeId: string,
  key: string,
  override: { price: number; grams: number }
): void {
  const next = {
    ...store.state.prices,
    [recipeId]: { ...(store.state.prices[recipeId] ?? {}), [key]: override }
  };
  store = { ...store, state: { ...store.state, prices: next } };
  persist();
  emit();
}

export function resetPrices(recipeId: string): void {
  const next = { ...store.state.prices, [recipeId]: {} };
  store = { ...store, state: { ...store.state, prices: next } };
  persist();
  emit();
}

export function addCustomRecipe(recipe: Recipe): void {
  const list = [...store.state.customRecipes, recipe];
  store = { ...store, state: { ...store.state, customRecipes: list, recipeId: recipe.id } };
  recomputeRecipes();
  persist();
  emit();
}

export function removeCustomRecipe(id: string): void {
  const list = store.state.customRecipes.filter((r) => r.id !== id);
  const prices = { ...store.state.prices };
  delete prices[id];
  const fallback = store.defaults[0]?.id ?? "";
  store = {
    ...store,
    state: { ...store.state, customRecipes: list, prices, recipeId: fallback }
  };
  recomputeRecipes();
  persist();
  emit();
}

export function mutateCustomRecipe(id: string, fn: (r: Recipe) => Recipe): void {
  const list = store.state.customRecipes.map((r) => (r.id === id ? fn(r) : r));
  store = { ...store, state: { ...store.state, customRecipes: list } };
  recomputeRecipes();
  persist();
  emit();
}

export function setAdminToken(token: string | null): void {
  if (typeof window !== "undefined") {
    if (token) window.sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    else window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  }
  store = { ...store, adminToken: token };
  emit();
}
