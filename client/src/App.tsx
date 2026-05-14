import { useCallback, useEffect, useMemo, useState } from "react";
import type { Ingredient, PriceOverride, Recipe, Section } from "./types";
import { computeTotals, uid } from "./lib/calc";
import {
  adminAddIngredient,
  adminPatchIngredient,
  adminRemoveIngredient,
  fetchAllRecipes,
  type AdminIngredientPatch
} from "./lib/api";
import {
  addCustomRecipe,
  mutateCustomRecipe,
  removeCustomRecipe,
  resetPrices as resetPricesAction,
  setDefaults,
  setDefaultsError,
  setIncludeHacks,
  setLoaves,
  setPriceOverride,
  setRecipeId,
  useStore
} from "./lib/store";
import { Masthead } from "./components/Masthead";
import { RecipeTabs } from "./components/RecipeTabs";
import { Controls } from "./components/Controls";
import { Panel } from "./components/Panel";
import { IngredientRow } from "./components/IngredientRow";
import { ShoppingList } from "./components/ShoppingList";
import { NewRecipeModal } from "./components/NewRecipeModal";
import { AdminLockButton } from "./components/AdminLockButton";

export function App() {
  const recipes = useStore((s) => s.recipes);
  const loading = useStore((s) => s.loadingDefaults);
  const error = useStore((s) => s.defaultsError);
  const state = useStore((s) => s.state);
  const adminToken = useStore((s) => s.adminToken);

  const [showList, setShowList] = useState(false);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAllRecipes()
      .then((rs) => {
        if (!cancelled) setDefaults(rs);
      })
      .catch((e) => {
        if (!cancelled) setDefaultsError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const recipe: Recipe | undefined = recipes.find((r) => r.id === state.recipeId) ?? recipes[0];

  const recipePrices = useMemo<Record<string, PriceOverride>>(
    () => (recipe ? state.prices[recipe.id] ?? {} : {}),
    [recipe, state.prices]
  );

  const isCustom = !!recipe?.custom;
  const isAdminEditingDefault = !isCustom && !!adminToken;
  const editable = isCustom || isAdminEditingDefault;

  const refreshDefaults = useCallback(async () => {
    try {
      const all = await fetchAllRecipes();
      setDefaults(all);
    } catch (e) {
      console.error("refreshDefaults", e);
    }
  }, []);

  const totals = useMemo(
    () => (recipe ? computeTotals(recipe, state.loaves, recipePrices, state.includeHacks) : { dryG: 0, totalCost: 0, perLoaf: 0 }),
    [recipe, state.loaves, recipePrices, state.includeHacks]
  );

  const setPrice = useCallback(
    (key: string, override: PriceOverride) => {
      if (recipe) setPriceOverride(recipe.id, key, override);
    },
    [recipe]
  );

  const onIngEdit = useCallback(
    async (sectionId: Section["id"], ingKey: string, patch: Partial<Ingredient>) => {
      if (!recipe) return;
      if (isAdminEditingDefault && adminToken) {
        const wire: AdminIngredientPatch = {};
        if ("name" in patch) wire.name = patch.name;
        if ("grams" in patch) wire.grams = patch.grams;
        if ("unit" in patch) wire.unit = patch.unit ?? null;
        if ("packagePrice" in patch) wire.packagePrice = patch.packagePrice;
        if ("packageGrams" in patch) wire.packageGrams = patch.packageGrams;
        if ("free" in patch) wire.isFree = patch.free;
        if ("exact" in patch) wire.isExact = patch.exact;
        if ("note" in patch) wire.note = patch.note ?? null;
        try {
          await adminPatchIngredient(adminToken, recipe.id, ingKey, wire);
          await refreshDefaults();
        } catch (e) {
          console.error("admin patch failed", e);
        }
        return;
      }
      if (!isCustom) return;
      mutateCustomRecipe(recipe.id, (r) => ({
        ...r,
        sections: r.sections.map((s) =>
          s.id !== sectionId
            ? s
            : { ...s, ingredients: s.ingredients.map((i) => (i.key === ingKey ? { ...i, ...patch } : i)) }
        )
      }));
    },
    [recipe, isCustom, isAdminEditingDefault, adminToken, refreshDefaults]
  );

  const onIngRemove = useCallback(
    async (sectionId: Section["id"], ingKey: string) => {
      if (!recipe) return;
      if (isAdminEditingDefault && adminToken) {
        try {
          await adminRemoveIngredient(adminToken, recipe.id, ingKey);
          await refreshDefaults();
        } catch (e) {
          console.error("admin remove failed", e);
        }
        return;
      }
      if (!isCustom) return;
      mutateCustomRecipe(recipe.id, (r) => ({
        ...r,
        sections: r.sections.map((s) =>
          s.id !== sectionId ? s : { ...s, ingredients: s.ingredients.filter((i) => i.key !== ingKey) }
        )
      }));
    },
    [recipe, isCustom, isAdminEditingDefault, adminToken, refreshDefaults]
  );

  const onIngAdd = useCallback(
    async (sectionId: Section["id"]) => {
      if (!recipe) return;
      if (isAdminEditingDefault && adminToken) {
        try {
          await adminAddIngredient(adminToken, recipe.id, {
            sectionId,
            name: "Novo ingrediente",
            grams: 10,
            packagePrice: 1.0,
            packageGrams: 1000
          });
          await refreshDefaults();
        } catch (e) {
          console.error("admin add failed", e);
        }
        return;
      }
      if (!isCustom) return;
      mutateCustomRecipe(recipe.id, (r) => ({
        ...r,
        sections: r.sections.map((s) =>
          s.id !== sectionId
            ? s
            : {
                ...s,
                ingredients: [
                  ...s.ingredients,
                  {
                    key: "i-" + uid(),
                    name: "Novo ingrediente",
                    grams: 10,
                    packagePrice: 1.0,
                    packageGrams: 1000
                  }
                ]
              }
        )
      }));
    },
    [recipe, isCustom, isAdminEditingDefault, adminToken, refreshDefaults]
  );

  if (loading) {
    return <div className="app-status">A carregar receitas…</div>;
  }
  if (error) {
    return (
      <div className="app-status error">
        Não foi possível carregar as receitas.
        <br />
        <span style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}>{error}</span>
      </div>
    );
  }
  if (!recipe) {
    return <div className="app-status">Sem receitas disponíveis.</div>;
  }

  const dry = recipe.sections.find((s) => s.id === "seca");
  const fresh = recipe.sections.find((s) => s.id === "frescos");
  const hacks = recipe.sections.find((s) => s.id === "hacks");
  const editedCount = Object.keys(recipePrices).length;

  return (
    <div className="app">
      <Masthead />

      <RecipeTabs
        recipes={recipes}
        activeId={recipe.id}
        onSelect={setRecipeId}
        onNew={() => setShowNew(true)}
      />

      <Controls
        loaves={state.loaves}
        setLoaves={setLoaves}
        recipe={recipe}
        totals={totals}
      />

      <div className="panels">
        {dry && (
          <Panel
            section={dry}
            loaves={state.loaves}
            prices={recipePrices}
            setPrice={setPrice}
            editable={editable}
            onIngEdit={onIngEdit}
            onIngRemove={onIngRemove}
            onIngAdd={onIngAdd}
          />
        )}
        {fresh && (
          <Panel
            section={fresh}
            loaves={state.loaves}
            prices={recipePrices}
            setPrice={setPrice}
            editable={editable}
            onIngEdit={onIngEdit}
            onIngRemove={onIngRemove}
            onIngAdd={onIngAdd}
          />
        )}

        {hacks && (
          <section className={"panel hacks" + (state.includeHacks ? "" : " off")}>
            <div className="panel-head">
              <div className="h-left">
                <h2>{hacks.name}</h2>
                <div className="panel-kicker">{hacks.kicker}</div>
              </div>
              <div className="h-right">
                <button
                  className="hacks-toggle"
                  aria-pressed={state.includeHacks}
                  onClick={() => setIncludeHacks(!state.includeHacks)}
                >
                  <span className="switch" />
                  {state.includeHacks ? "incluído" : "incluir"}
                </button>
              </div>
            </div>
            <ul className="ing-list">
              {hacks.ingredients.map((ing) => (
                <IngredientRow
                  key={ing.key}
                  ing={ing}
                  loaves={state.includeHacks ? state.loaves : 0}
                  priceOverride={recipePrices[ing.key]}
                  onPriceChange={(v) => setPrice(ing.key, v)}
                  editable={editable}
                  onEdit={(patch) => onIngEdit("hacks", ing.key, patch)}
                  onRemove={() => onIngRemove("hacks", ing.key)}
                />
              ))}
              {editable && (
                <li className="ing-add-row">
                  <button className="ing-add-btn" onClick={() => onIngAdd("hacks")}>
                    <span aria-hidden="true">+</span> adicionar ingrediente
                  </button>
                </li>
              )}
              {!editable && hacks.ingredients.length === 0 && <li className="ing-empty">— sem hacks</li>}
            </ul>
          </section>
        )}
      </div>

      <div className="action-row">
        <div className="left">
          <span className="save-dot" />
          guardado automaticamente · {editedCount} preço{editedCount === 1 ? "" : "s"} editado
          {editedCount === 1 ? "" : "s"}
        </div>
        <div className="action-row-actions">
          <AdminLockButton />
          {isCustom && (
            <button
              className="btn ghost danger"
              onClick={() => {
                if (window.confirm(`Eliminar a receita "${recipe.name}"?`)) removeCustomRecipe(recipe.id);
              }}
            >
              Eliminar receita
            </button>
          )}
          <button
            className="btn ghost"
            onClick={() => {
              if (window.confirm("Repor todos os preços às estimativas iniciais?")) resetPricesAction(recipe.id);
            }}
          >
            Repor preços
          </button>
          <button className="btn primary" onClick={() => setShowList(true)}>
            Lista de compras
          </button>
        </div>
      </div>

      {showList && (
        <ShoppingList
          recipe={recipe}
          loaves={state.loaves}
          prices={recipePrices}
          includeHacks={state.includeHacks}
          onClose={() => setShowList(false)}
        />
      )}

      {showNew && (
        <NewRecipeModal
          recipes={recipes}
          onCreate={(r) => {
            addCustomRecipe(r);
            setShowNew(false);
          }}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}
