import type { Recipe } from "../types";
import type { Totals } from "../lib/calc";
import { fmtEur } from "../lib/format";

interface Props {
  loaves: number;
  setLoaves: (v: number) => void;
  recipe: Recipe;
  totals: Totals;
}

export function Controls({ loaves, setLoaves, recipe, totals }: Props) {
  const weeks = Math.round(loaves / (recipe.weeklyConsumption || 2));
  const expensive = totals.perLoaf > 2.5;
  const pct = ((loaves - 1) / 29) * 100;

  return (
    <div className="controls">
      <div className="slider-block">
        <div className="slider-label">
          <span className="lbl">Quantos pães</span>
          <span className="ctx">
            ≈ {weeks} {weeks === 1 ? "semana" : "semanas"} de stock
          </span>
        </div>
        <div className="loaves-display">
          <span className="loaves-num">{loaves}</span>
          <span className="loaves-unit">{loaves === 1 ? "pão" : "pães"}</span>
        </div>
        <input
          className="range"
          type="range"
          min={1}
          max={30}
          step={1}
          value={loaves}
          onChange={(e) => setLoaves(parseInt(e.currentTarget.value, 10))}
          style={{ ["--pct" as unknown as string]: pct + "%" } as React.CSSProperties}
        />
        <div className="range-scale">
          <span>1</span>
          <span>10</span>
          <span>20</span>
          <span>30</span>
        </div>
      </div>

      <div
        className="kpis"
        style={{ margin: 0, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, minWidth: 360 }}
      >
        <div className="kpi">
          <div className="k-label">Mistura seca</div>
          <div className="k-value">
            {(totals.dryG / 1000).toFixed(2).replace(".", ",")}
            <span className="k-unit"> kg</span>
          </div>
          <div className="k-foot">para {loaves} pães</div>
        </div>
        <div className="kpi">
          <div className="k-label">Custo total</div>
          <div className="k-value">{fmtEur(totals.totalCost)}</div>
          <div className="k-foot">estimativa</div>
        </div>
        <div className={"kpi" + (expensive ? " warn" : "")} style={{ gridColumn: "1 / -1" }}>
          <div className="k-label">Custo por pão</div>
          <div className="k-value">{fmtEur(totals.perLoaf)}</div>
          <div className="k-foot">{expensive ? "⚠ acima de €2,50/pão" : "dentro do orçamento"}</div>
        </div>
      </div>
    </div>
  );
}
