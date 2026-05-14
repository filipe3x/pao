import type { Ingredient, PriceOverride } from "../types";
import { priceInfo } from "../lib/calc";
import { fmtEur, fmtG, fmtMl } from "../lib/format";
import { ExactStamp } from "./ExactStamp";

interface Props {
  ing: Ingredient;
  loaves: number;
  priceOverride?: PriceOverride;
  onPriceChange: (v: PriceOverride) => void;
  editable: boolean;
  onEdit?: (patch: Partial<Ingredient>) => void;
  onRemove?: () => void;
}

export function IngredientRow({ ing, loaves, priceOverride, onPriceChange, editable, onEdit, onRemove }: Props) {
  const totalG = ing.grams * loaves;
  const { packagePrice, packageGrams, pricePerKg } = priceInfo(ing, priceOverride);
  const cost = ing.free ? 0 : ((totalG / 1000) * pricePerKg);
  const fmt = ing.unit === "ml" ? fmtMl : fmtG;

  const setField = (field: "price" | "grams", raw: string) => {
    const v = parseFloat(raw);
    if (isNaN(v) || v < 0) return;
    const next: PriceOverride = { price: packagePrice, grams: packageGrams, [field]: v } as PriceOverride;
    onPriceChange(next);
  };

  return (
    <li className={"ing" + (editable ? " editable" : "")}>
      <div className="ing-name">
        {editable ? (
          <input
            className="ed-name"
            type="text"
            defaultValue={ing.name}
            placeholder="nome do ingrediente"
            key={`n-${ing.key}-${ing.name}`}
            onBlur={(e) => {
              const v = e.currentTarget.value.trim();
              if (v && v !== ing.name) onEdit?.({ name: v });
              else e.currentTarget.value = ing.name;
            }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          />
        ) : (
          <span>{ing.name}</span>
        )}
        {ing.exact && <ExactStamp />}
        {editable && (
          <button className="ing-remove" onClick={onRemove} title="Remover" aria-label="Remover ingrediente">×</button>
        )}
      </div>
      <div className="ing-total">
        {fmt(totalG)}
        <span className="per">
          {editable ? (
            <>
              <input
                className="ed-grams"
                type="number"
                min={0}
                step={1}
                defaultValue={ing.grams}
                key={`gr-${ing.key}-${ing.grams}`}
                onBlur={(e) => {
                  const n = parseFloat(e.currentTarget.value);
                  if (!isNaN(n) && n >= 0 && n !== ing.grams) onEdit?.({ grams: n });
                  else e.currentTarget.value = String(ing.grams);
                }}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              />
              {ing.unit || "g"}/pão
            </>
          ) : (
            <>{ing.grams}{ing.unit || "g"}/pão</>
          )}
        </span>
      </div>
      {ing.note && <div className="ing-note">— {ing.note}</div>}
      <div className="ing-row-2">
        {ing.free ? (
          <>
            <span className="ing-free">{ing.unit === "ml" ? "da torneira" : "custo zero"}</span>
            <span />
            <span className="ing-cost">{fmtEur(0)}</span>
          </>
        ) : (
          <>
            <div className="ing-price-block">
              <span className="est">embalagem</span>
              <input
                className="in-price"
                type="number"
                step={0.1}
                min={0}
                defaultValue={packagePrice.toFixed(2)}
                key={`p-${ing.key}-${packagePrice}`}
                onBlur={(e) => setField("price", e.currentTarget.value)}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                aria-label={`Preço da embalagem de ${ing.name}`}
              />
              <span className="u">€</span>
              <span className="x">×</span>
              <input
                className="in-grams"
                type="number"
                step={10}
                min={1}
                defaultValue={packageGrams}
                key={`g-${ing.key}-${packageGrams}`}
                onBlur={(e) => setField("grams", e.currentTarget.value)}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                aria-label={`Tamanho da embalagem de ${ing.name}`}
              />
              <span className="u">g</span>
              <span className="per-kg">· {fmtEur(pricePerKg)}/kg</span>
            </div>
            <span />
            <span className="ing-cost">{fmtEur(cost)}</span>
          </>
        )}
      </div>
    </li>
  );
}
