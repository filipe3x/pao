import type { Recipe } from "../types";

interface Props {
  recipes: Recipe[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function RecipeTabs({ recipes, activeId, onSelect, onNew }: Props) {
  return (
    <div className="recipe-tabs">
      {recipes.map((r) => (
        <button
          key={r.id}
          className={
            "recipe-tab" + (r.id === activeId ? " active" : "") + (r.custom ? " custom" : "")
          }
          onClick={() => onSelect(r.id)}
        >
          <span className="dot" />
          {r.name}
        </button>
      ))}
      <button className="recipe-tab add" onClick={onNew}>
        <span aria-hidden="true">+</span> nova receita
      </button>
    </div>
  );
}
