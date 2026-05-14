import type { Ingredient, PriceOverride, Section } from "../types";
import { priceInfo } from "../lib/calc";
import { fmtEur, fmtG } from "../lib/format";
import { ExactStamp } from "./ExactStamp";
import { IngredientRow } from "./IngredientRow";

interface Props {
  section: Section;
  loaves: number;
  prices: Record<string, PriceOverride>;
  setPrice: (key: string, override: PriceOverride) => void;
  dim?: boolean;
  headerExtra?: React.ReactNode;
  editable?: boolean;
  onIngEdit?: (sectionId: Section["id"], key: string, patch: Partial<Ingredient>) => void;
  onIngRemove?: (sectionId: Section["id"], key: string) => void;
  onIngAdd?: (sectionId: Section["id"]) => void;
}

export function Panel({
  section,
  loaves,
  prices,
  setPrice,
  dim,
  headerExtra,
  editable,
  onIngEdit,
  onIngRemove,
  onIngAdd
}: Props) {
  const ingredients = section.ingredients;
  const totalG = ingredients.reduce((a, i) => a + (i.unit === "ml" ? 0 : i.grams * loaves), 0);
  const totalCost = ingredients.reduce((a, i) => {
    if (i.free) return a;
    const { pricePerKg } = priceInfo(i, prices[i.key]);
    return a + ((i.grams * loaves) / 1000) * pricePerKg;
  }, 0);

  return (
    <section className={`panel ${section.tone}${dim ? " off" : ""}`}>
      <div className="panel-head">
        <div className="h-left">
          <h2>{section.name}</h2>
          <div className="panel-kicker">{section.kicker}</div>
        </div>
        <div className="h-right">
          {headerExtra ?? (
            <>
              <div className="panel-sub-label">subtotal</div>
              <div className="panel-sub">{fmtEur(totalCost)}</div>
              {section.id === "seca" && (
                <div className="panel-kicker" style={{ marginTop: 4 }}>{fmtG(totalG)}</div>
              )}
            </>
          )}
        </div>
      </div>
      <ul className="ing-list">
        {ingredients.map((ing) => (
          <IngredientRow
            key={ing.key}
            ing={ing}
            loaves={loaves}
            priceOverride={prices[ing.key]}
            onPriceChange={(v) => setPrice(ing.key, v)}
            editable={!!editable}
            onEdit={(patch) => onIngEdit?.(section.id, ing.key, patch)}
            onRemove={() => onIngRemove?.(section.id, ing.key)}
          />
        ))}
        {editable && (
          <li className="ing-add-row">
            <button className="ing-add-btn" onClick={() => onIngAdd?.(section.id)}>
              <span aria-hidden="true">+</span> adicionar ingrediente
            </button>
          </li>
        )}
        {!editable && ingredients.length === 0 && <li className="ing-empty">— sem ingredientes</li>}
      </ul>
      {section.id === "seca" && (
        <div className="panel-foot">
          <ExactStamp />
          <span>
            marca os ingredientes com valor declarado no rótulo do produto original — os únicos com certeza
            científica.
          </span>
        </div>
      )}
    </section>
  );
}
