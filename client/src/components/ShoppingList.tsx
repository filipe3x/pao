import type { PriceOverride, Recipe } from "../types";
import { priceInfo } from "../lib/calc";
import { fmtEur, fmtG, fmtPkg } from "../lib/format";

interface Props {
  recipe: Recipe;
  loaves: number;
  prices: Record<string, PriceOverride>;
  includeHacks: boolean;
  onClose: () => void;
}

export function ShoppingList({ recipe, loaves, prices, includeHacks, onClose }: Props) {
  const allSections = recipe.sections.filter((s) => s.id !== "hacks" || includeHacks);

  const rows = allSections.map((section) => {
    const buyables = section.ingredients
      .filter((i) => !i.free)
      .map((i) => {
        const totalG = i.grams * loaves;
        const { packagePrice, packageGrams } = priceInfo(i, prices[i.key]);
        const pkgs = packageGrams > 0 ? Math.ceil((totalG / packageGrams) * 10) / 10 : 0;
        const cost = pkgs * packagePrice;
        return { i, totalG, packagePrice, packageGrams, pkgs, cost };
      });
    return { section, buyables };
  });

  const grandTotal = rows.flatMap((r) => r.buyables).reduce((a, r) => a + r.cost, 0);

  const handlePrint = () => {
    const card = document.querySelector(".overlay .list-card");
    if (!card) {
      window.print();
      return;
    }
    let area = document.getElementById("print-area");
    if (!area) {
      area = document.createElement("div");
      area.id = "print-area";
      document.body.appendChild(area);
    }
    area.innerHTML = "";
    area.appendChild(card.cloneNode(true));
    const cleanup = () => {
      if (area && area.parentNode) area.parentNode.removeChild(area);
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    // Safari fallback — afterprint pode não disparar.
    window.setTimeout(cleanup, 2000);
  };

  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="list-card">
        <button className="close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
        <div className="list-head">
          <div className="kicker">Lista de Compras</div>
          <h2>{recipe.name}</h2>
          <div className="meta">
            para {loaves} {loaves === 1 ? "pão" : "pães"} · embalagens arredondadas à décima superior
          </div>
        </div>

        {rows.map(({ section, buyables }) => {
          if (buyables.length === 0) return null;
          return (
            <div className="list-section" key={section.id}>
              <h3>{section.name}</h3>
              {buyables.map(({ i, totalG, packagePrice, packageGrams, pkgs, cost }) => (
                <div className="list-row" key={i.key}>
                  <span className="lr-name">{i.name}</span>
                  <span className="lr-need">
                    precisa <b>{fmtG(totalG)}</b>
                  </span>
                  <span className="lr-pkg">
                    <b className="lr-pkg-n">{fmtPkg(pkgs)}</b>
                    <span className="lr-pkg-of">
                      {" "}
                      emb. de {fmtG(packageGrams)} a {fmtEur(packagePrice)}
                    </span>
                  </span>
                  <span className="lr-cost">{fmtEur(cost)}</span>
                </div>
              ))}
            </div>
          );
        })}

        <div className="list-total">
          <span className="lbl">Total estimado</span>
          <span className="v">{fmtEur(grandTotal)}</span>
        </div>

        <div className="list-actions">
          <button className="btn ghost" onClick={onClose}>
            Fechar
          </button>
          <button className="btn primary" onClick={handlePrint}>
            Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
