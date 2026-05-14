import { useEffect, useRef, useState } from "react";
import type { Recipe } from "../types";
import { blankRecipe, cloneRecipe } from "../lib/calc";

interface Props {
  recipes: Recipe[];
  onCreate: (r: Recipe) => void;
  onClose: () => void;
}

export function NewRecipeModal({ recipes, onCreate, onClose }: Props) {
  const [name, setName] = useState("");
  const [sourceId, setSourceId] = useState("__blank");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const n = name.trim();
    if (!n) return;
    const src = recipes.find((r) => r.id === sourceId);
    onCreate(src ? cloneRecipe(src, n) : blankRecipe(n));
  };

  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="list-card new-recipe-card">
        <button className="close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
        <div className="list-head">
          <div className="kicker">Caderno de receitas</div>
          <h2>Nova receita</h2>
          <div className="meta">começa em branco ou parte de uma receita existente</div>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label className="f-label">Nome</label>
            <input
              ref={inputRef}
              className="f-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="ex. Pão de centeio integral"
            />
          </div>

          <div className="field">
            <label className="f-label">Começar a partir de</label>
            <div className="source-picker">
              <button
                type="button"
                className={"src-opt" + (sourceId === "__blank" ? " active" : "")}
                onClick={() => setSourceId("__blank")}
              >
                <span className="src-title">Em branco</span>
                <span className="src-sub">3 secções vazias — adicionar tudo</span>
              </button>
              {recipes.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={"src-opt" + (sourceId === r.id ? " active" : "")}
                  onClick={() => setSourceId(r.id)}
                >
                  <span className="src-title">Clonar: {r.name}</span>
                  <span className="src-sub">
                    {r.sections.reduce((a, s) => a + s.ingredients.length, 0)} ingredientes copiados
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="list-actions">
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn primary" disabled={!name.trim()}>
              Criar receita
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
