const { useState, useEffect, useMemo, useCallback, useRef } = React;

const STORAGE_KEY = 'calc-pao-v1';

const uid = () => Math.random().toString(36).slice(2, 9);

// ── Recipe templates ───────────────────────────────────────────────────
const BLANK_SECTIONS = () => [
  { id: 'seca',    name: 'Mistura Seca', kicker: 'prepara-se em avanço · dura semanas', tone: 'dry',   ingredients: [] },
  { id: 'frescos', name: 'Frescos',      kicker: 'junta-se no dia',                       tone: 'fresh', ingredients: [] },
  { id: 'hacks',   name: 'Hacks',        kicker: 'opcionais · usar conforme a massa pede', tone: 'hacks', optional: true, ingredients: [] },
];

function cloneRecipe(src, newName) {
  return {
    id: 'r-' + uid(),
    name: newName,
    subtitle: src.subtitle,
    weeklyConsumption: src.weeklyConsumption || 2,
    custom: true,
    sections: src.sections.map(s => ({
      ...s,
      ingredients: s.ingredients.map(i => ({ ...i })),
    })),
  };
}
function blankRecipe(newName) {
  return {
    id: 'r-' + uid(),
    name: newName,
    subtitle: 'receita personalizada',
    weeklyConsumption: 2,
    custom: true,
    sections: BLANK_SECTIONS(),
  };
}

// ── Persistence ─────────────────────────────────────────
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    // Migrate legacy shape: prices[recipeId][key] = number (€/kg)
    //                =>   prices[recipeId][key] = { price, grams: 1000 }
    // (1000g default keeps the migration mathematically identical)
    if (s && s.prices) {
      for (const rid of Object.keys(s.prices)) {
        const bucket = s.prices[rid];
        if (!bucket || typeof bucket !== 'object') continue;
        for (const k of Object.keys(bucket)) {
          const v = bucket[k];
          if (typeof v === 'number') {
            bucket[k] = { price: v, grams: 1000 };
          }
        }
      }
    }
    if (!Array.isArray(s.customRecipes)) s.customRecipes = [];
    return s;
  } catch (e) { return null; }
}
function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {}
}

// ── Resolve effective price + package for an ingredient ──────────────
function priceInfo(ing, override) {
  const packagePrice = override && override.price != null ? override.price : (ing.packagePrice ?? 0);
  const packageGrams = override && override.grams != null ? override.grams : (ing.packageGrams ?? 1000);
  const pricePerKg = packageGrams > 0 ? (packagePrice * 1000 / packageGrams) : 0;
  return { packagePrice, packageGrams, pricePerKg };
}

// ── Format helpers ──────────────────────────────────────
const fmtEur = (n) => '€' + (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');
const fmtG = (g) => {
  if (g >= 1000) return (g / 1000).toFixed(g % 1000 === 0 ? 0 : 2).replace('.', ',') + ' kg';
  return Math.round(g) + ' g';
};
const fmtMl = (ml) => {
  if (ml >= 1000) return (ml / 1000).toFixed(2).replace('.', ',') + ' L';
  return Math.round(ml) + ' ml';
};

// ── Exact stamp ─────────────────────────────────────────
function ExactStamp({ small }) {
  return (
    <span className="exact-stamp" title="Valor confirmado do rótulo do produto original">
      <svg viewBox="0 0 12 12" fill="none">
        <path d="M2 6L5 9L10 3" stroke="#5b6e3f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      exacto
    </span>
  );
}

// ── Ingredient row ──────────────────────────────────────
function IngredientRow({ ing, loaves, priceOverride, onPriceChange, editable, onEdit, onRemove }) {
  const totalG = ing.grams * loaves;
  const { packagePrice, packageGrams, pricePerKg } = priceInfo(ing, priceOverride);
  const cost = ing.free ? 0 : (totalG / 1000) * pricePerKg;
  const fmt = ing.unit === 'ml' ? fmtMl : fmtG;

  const setField = (field, raw) => {
    const v = parseFloat(raw);
    if (isNaN(v) || v < 0) return;
    if (field === 'grams' && v < 1) return;
    onPriceChange({ price: packagePrice, grams: packageGrams, [field]: v });
  };

  return (
    <li className={'ing' + (editable ? ' editable' : '')}>
      <div className="ing-name">
        {editable ? (
          <input
            className="ed-name"
            type="text"
            defaultValue={ing.name}
            placeholder="nome do ingrediente"
            key={`n-${ing.key}-${ing.name}`}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== ing.name) onEdit({ name: v });
              else e.target.value = ing.name;
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
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
                min="0"
                step="1"
                defaultValue={ing.grams}
                key={`gr-${ing.key}-${ing.grams}`}
                onBlur={(e) => {
                  const n = parseFloat(e.target.value);
                  if (!isNaN(n) && n >= 0 && n !== ing.grams) onEdit({ grams: n });
                  else e.target.value = ing.grams;
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
              />
              {ing.unit || 'g'}/pão
            </>
          ) : (
            <>{ing.grams}{ing.unit || 'g'}/pão</>
          )}
        </span>
      </div>
      {ing.note && <div className="ing-note">— {ing.note}</div>}
      <div className="ing-row-2">
        {ing.free ? (
          <>
            <span className="ing-free">{ing.unit === 'ml' ? 'da torneira' : 'custo zero'}</span>
            <span></span>
            <span className="ing-cost">{fmtEur(0)}</span>
          </>
        ) : (
          <>
            <div className="ing-price-block">
              <span className="est">embalagem</span>
              <input
                className="in-price"
                type="number"
                step="0.10"
                min="0"
                defaultValue={packagePrice.toFixed(2)}
                key={`p-${ing.key}-${packagePrice}`}
                onBlur={(e) => setField('price', e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                aria-label={`Preço da embalagem de ${ing.name}`}
              />
              <span className="u">€</span>
              <span className="x">×</span>
              <input
                className="in-grams"
                type="number"
                step="10"
                min="1"
                defaultValue={packageGrams}
                key={`g-${ing.key}-${packageGrams}`}
                onBlur={(e) => setField('grams', e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                aria-label={`Tamanho da embalagem de ${ing.name}`}
              />
              <span className="u">g</span>
              <span className="per-kg">· {fmtEur(pricePerKg)}/kg</span>
            </div>
            <span></span>
            <span className="ing-cost">{fmtEur(cost)}</span>
          </>
        )}
      </div>
    </li>
  );
}

// ── Panel ────────────────────────────────────────────────
function Panel({ section, loaves, prices, setPrice, dim, headerExtra, editable, onIngEdit, onIngRemove, onIngAdd }) {
  const ingredients = section.ingredients;
  const totalG = ingredients.reduce((a, i) => a + (i.unit === 'ml' ? 0 : i.grams * loaves), 0);
  const totalCost = ingredients.reduce((a, i) => {
    if (i.free) return a;
    const { pricePerKg } = priceInfo(i, prices[i.key]);
    return a + (i.grams * loaves / 1000) * pricePerKg;
  }, 0);

  return (
    <section className={`panel ${section.tone}${dim ? ' off' : ''}`}>
      <div className="panel-head">
        <div className="h-left">
          <h2>{section.name}</h2>
          <div className="panel-kicker">{section.kicker}</div>
        </div>
        <div className="h-right">
          {headerExtra || (
            <>
              <div className="panel-sub-label">{section.id === 'frescos' ? 'subtotal' : 'subtotal'}</div>
              <div className="panel-sub">{fmtEur(totalCost)}</div>
              {section.id === 'seca' && (
                <div className="panel-kicker" style={{marginTop: 4}}>{fmtG(totalG)}</div>
              )}
            </>
          )}
        </div>
      </div>
      <ul className="ing-list">
        {ingredients.map(ing => (
          <IngredientRow
            key={ing.key}
            ing={ing}
            loaves={loaves}
            priceOverride={prices[ing.key]}
            onPriceChange={(v) => setPrice(ing.key, v)}
            editable={editable}
            onEdit={(patch) => onIngEdit && onIngEdit(section.id, ing.key, patch)}
            onRemove={() => onIngRemove && onIngRemove(section.id, ing.key)}
          />
        ))}
        {editable && (
          <li className="ing-add-row">
            <button className="ing-add-btn" onClick={() => onIngAdd && onIngAdd(section.id)}>
              <span aria-hidden="true">+</span> adicionar ingrediente
            </button>
          </li>
        )}
        {!editable && ingredients.length === 0 && (
          <li className="ing-empty">— sem ingredientes</li>
        )}
      </ul>
      {section.id === 'seca' && (
        <div className="panel-foot">
          <ExactStamp />
          <span>marca os ingredientes com valor declarado no rótulo do produto original — os únicos com certeza científica.</span>
        </div>
      )}
    </section>
  );
}

// ── Shopping list ────────────────────────────────────────
function ShoppingList({ recipe, loaves, prices, includeHacks, onClose }) {
  const allSections = recipe.sections.filter(s => s.id !== 'hacks' || includeHacks);
  const fmtPkg = (n) => n.toFixed(1).replace('.', ',');

  const rows = allSections.map(section => {
    const buyables = section.ingredients.filter(i => !i.free).map(i => {
      const totalG = i.grams * loaves;
      const { packagePrice, packageGrams } = priceInfo(i, prices[i.key]);
      // packages needed, rounded UP to the nearest tenth
      const pkgs = packageGrams > 0 ? Math.ceil((totalG / packageGrams) * 10) / 10 : 0;
      const cost = pkgs * packagePrice;
      return { i, totalG, packagePrice, packageGrams, pkgs, cost };
    });
    return { section, buyables };
  });

  const grandTotal = rows.flatMap(r => r.buyables).reduce((a, r) => a + r.cost, 0);

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="list-card">
        <button className="close" onClick={onClose} aria-label="Fechar">×</button>
        <div className="list-head">
          <div className="kicker">Lista de Compras</div>
          <h2>{recipe.name}</h2>
          <div className="meta">para {loaves} {loaves === 1 ? 'pão' : 'pães'} · embalagens arredondadas à décima superior</div>
        </div>

        {rows.map(({ section, buyables }) => {
          if (buyables.length === 0) return null;
          return (
            <div className="list-section" key={section.id}>
              <h3>{section.name}</h3>
              {buyables.map(({ i, totalG, packagePrice, packageGrams, pkgs, cost }) => (
                <div className="list-row" key={i.key}>
                  <span className="lr-name">{i.name}</span>
                  <span className="lr-need">precisa <b>{fmtG(totalG)}</b></span>
                  <span className="lr-pkg">
                    <b className="lr-pkg-n">{fmtPkg(pkgs)}</b>
                    <span className="lr-pkg-of"> emb. de {fmtG(packageGrams)} a {fmtEur(packagePrice)}</span>
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
          <button className="btn ghost" onClick={onClose}>Fechar</button>
          <button className="btn primary" onClick={() => {
            // Clone the list-card to a top-level #print-area to avoid
            // any parent display:none / fixed-positioning blank-page issues.
            const card = document.querySelector('.overlay .list-card');
            if (!card) { window.print(); return; }
            let area = document.getElementById('print-area');
            if (!area) {
              area = document.createElement('div');
              area.id = 'print-area';
              document.body.appendChild(area);
            }
            area.innerHTML = '';
            area.appendChild(card.cloneNode(true));
            const cleanup = () => {
              if (area && area.parentNode) area.parentNode.removeChild(area);
              window.removeEventListener('afterprint', cleanup);
            };
            window.addEventListener('afterprint', cleanup);
            window.print();
            // Safari fallback: afterprint not always fired reliably
            setTimeout(cleanup, 2000);
          }}>Imprimir</button>
        </div>
      </div>
    </div>
  );
}

// ── New Recipe Modal ─────────────────────────────────────
function NewRecipeModal({ recipes, onCreate, onClose }) {
  const [name, setName] = useState('');
  const [sourceId, setSourceId] = useState('__blank');
  const inputRef = useRef(null);

  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);

  const submit = (e) => {
    e && e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const src = recipes.find(r => r.id === sourceId);
    const newRecipe = src ? cloneRecipe(src, n) : blankRecipe(n);
    onCreate(newRecipe);
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="list-card new-recipe-card">
        <button className="close" onClick={onClose} aria-label="Fechar">×</button>
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
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. Pão de centeio integral"
            />
          </div>

          <div className="field">
            <label className="f-label">Começar a partir de</label>
            <div className="source-picker">
              <button
                type="button"
                className={'src-opt' + (sourceId === '__blank' ? ' active' : '')}
                onClick={() => setSourceId('__blank')}
              >
                <span className="src-title">Em branco</span>
                <span className="src-sub">3 secções vazias — adicionar tudo</span>
              </button>
              {recipes.map(r => (
                <button
                  key={r.id}
                  type="button"
                  className={'src-opt' + (sourceId === r.id ? ' active' : '')}
                  onClick={() => setSourceId(r.id)}
                >
                  <span className="src-title">Clonar: {r.name}</span>
                  <span className="src-sub">{r.sections.reduce((a, s) => a + s.ingredients.length, 0)} ingredientes copiados</span>
                </button>
              ))}
            </div>
          </div>

          <div className="list-actions">
            <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn primary" disabled={!name.trim()}>Criar receita</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── App ─────────────────────────────────────────────────
function App() {
  const builtins = window.RECIPES;
  const saved = loadState();
  const [customRecipes, setCustomRecipes] = useState(saved?.customRecipes || []);
  const [recipeId, setRecipeId] = useState(saved?.recipeId || builtins[0].id);
  const [loaves, setLoaves] = useState(saved?.loaves || 12);
  const [prices, setPrices] = useState(saved?.prices || {});
  const [includeHacks, setIncludeHacks] = useState(saved?.includeHacks ?? false);
  const [showList, setShowList] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const recipes = useMemo(() => [...builtins, ...customRecipes], [builtins, customRecipes]);
  const recipe = recipes.find(r => r.id === recipeId) || recipes[0];
  const recipePrices = prices[recipe.id] || {};
  const isCustom = !!recipe.custom;

  // Persist
  useEffect(() => {
    saveState({ recipeId, loaves, prices, includeHacks, customRecipes });
  }, [recipeId, loaves, prices, includeHacks, customRecipes]);

  const setPrice = useCallback((key, value) => {
    setPrices(prev => ({
      ...prev,
      [recipe.id]: { ...(prev[recipe.id] || {}), [key]: value }
    }));
  }, [recipe.id]);

  // ── Custom recipe mutators ──────────────────────────
  const mutateRecipe = useCallback((id, fn) => {
    setCustomRecipes(prev => prev.map(r => r.id === id ? fn(r) : r));
  }, []);

  const onIngEdit = useCallback((sectionId, ingKey, patch) => {
    mutateRecipe(recipe.id, (r) => ({
      ...r,
      sections: r.sections.map(s => s.id !== sectionId ? s : ({
        ...s,
        ingredients: s.ingredients.map(i => i.key === ingKey ? { ...i, ...patch } : i),
      })),
    }));
  }, [recipe.id, mutateRecipe]);

  const onIngRemove = useCallback((sectionId, ingKey) => {
    mutateRecipe(recipe.id, (r) => ({
      ...r,
      sections: r.sections.map(s => s.id !== sectionId ? s : ({
        ...s,
        ingredients: s.ingredients.filter(i => i.key !== ingKey),
      })),
    }));
    setPrices(prev => {
      const bucket = { ...(prev[recipe.id] || {}) };
      delete bucket[ingKey];
      return { ...prev, [recipe.id]: bucket };
    });
  }, [recipe.id, mutateRecipe]);

  const onIngAdd = useCallback((sectionId) => {
    mutateRecipe(recipe.id, (r) => ({
      ...r,
      sections: r.sections.map(s => s.id !== sectionId ? s : ({
        ...s,
        ingredients: [
          ...s.ingredients,
          {
            key: 'i-' + uid(),
            name: 'Novo ingrediente',
            grams: 10,
            packagePrice: 1.00,
            packageGrams: 1000,
          },
        ],
      })),
    }));
  }, [recipe.id, mutateRecipe]);

  const createRecipe = (newRecipe) => {
    setCustomRecipes(prev => [...prev, newRecipe]);
    setRecipeId(newRecipe.id);
    setShowNew(false);
  };

  const deleteRecipe = () => {
    if (!isCustom) return;
    if (!window.confirm(`Eliminar a receita "${recipe.name}"?`)) return;
    setCustomRecipes(prev => prev.filter(r => r.id !== recipe.id));
    setPrices(prev => {
      const copy = { ...prev };
      delete copy[recipe.id];
      return copy;
    });
    setRecipeId(builtins[0].id);
  };

  const resetPrices = () => {
    if (window.confirm('Repor todos os preços às estimativas iniciais?')) {
      setPrices(prev => ({ ...prev, [recipe.id]: {} }));
    }
  };

  // Totals
  const totals = useMemo(() => {
    const allSec = recipe.sections.filter(s => s.id !== 'hacks' || includeHacks);
    let dryG = 0, totalCost = 0;
    for (const s of allSec) {
      for (const i of s.ingredients) {
        if (i.unit !== 'ml') {
          if (s.id === 'seca') dryG += i.grams * loaves;
        }
        if (!i.free) {
          const { pricePerKg } = priceInfo(i, recipePrices[i.key]);
          totalCost += (i.grams * loaves / 1000) * pricePerKg;
        }
      }
    }
    return { dryG, totalCost, perLoaf: totalCost / loaves };
  }, [recipe, loaves, recipePrices, includeHacks]);

  const weeks = Math.round(loaves / (recipe.weeklyConsumption || 2));
  const expensive = totals.perLoaf > 2.5;
  const pct = ((loaves - 1) / 29) * 100;

  const dry = recipe.sections.find(s => s.id === 'seca');
  const fresh = recipe.sections.find(s => s.id === 'frescos');
  const hacks = recipe.sections.find(s => s.id === 'hacks');

  return (
    <div className="app">
      {/* Header */}
      <header className="masthead">
        <div>
          <div className="kicker">Caderno de receitas · v1</div>
          <h1 className="title">Calculadora do <em>Pão</em></h1>
        </div>
        <div className="masthead-meta">
          calcula misturas e custos<br/>
          <b>biológico · artesanal · sem glúten</b>
        </div>
      </header>

      {/* Recipe tabs */}
      <div className="recipe-tabs">
        {recipes.map(r => (
          <button
            key={r.id}
            className={'recipe-tab' + (r.id === recipeId ? ' active' : '') + (r.custom ? ' custom' : '')}
            onClick={() => setRecipeId(r.id)}
          >
            <span className="dot"></span>
            {r.name}
          </button>
        ))}
        <button className="recipe-tab add" onClick={() => setShowNew(true)}>
          <span aria-hidden="true">+</span> nova receita
        </button>
      </div>

      {/* Controls */}
      <div className="controls">
        <div className="slider-block">
          <div className="slider-label">
            <span className="lbl">Quantos pães</span>
            <span className="ctx">≈ {weeks} {weeks === 1 ? 'semana' : 'semanas'} de stock</span>
          </div>
          <div className="loaves-display">
            <span className="loaves-num">{loaves}</span>
            <span className="loaves-unit">{loaves === 1 ? 'pão' : 'pães'}</span>
          </div>
          <input
            className="range"
            type="range"
            min="1" max="30" step="1"
            value={loaves}
            onChange={(e) => setLoaves(parseInt(e.target.value, 10))}
            style={{ '--pct': pct + '%' }}
          />
          <div className="range-scale">
            <span>1</span><span>10</span><span>20</span><span>30</span>
          </div>
        </div>

        <div className="kpis" style={{margin: 0, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, minWidth: 360}}>
          <div className="kpi">
            <div className="k-label">Mistura seca</div>
            <div className="k-value">{(totals.dryG / 1000).toFixed(2).replace('.', ',')}<span className="k-unit"> kg</span></div>
            <div className="k-foot">para {loaves} pães</div>
          </div>
          <div className="kpi">
            <div className="k-label">Custo total</div>
            <div className="k-value">{fmtEur(totals.totalCost)}</div>
            <div className="k-foot">estimativa</div>
          </div>
          <div className="kpi" style={{gridColumn: '1 / -1'}}>
            <div className="k-label">Custo por pão</div>
            <div className={'k-value'}>{fmtEur(totals.perLoaf)}</div>
            <div className="k-foot">{expensive ? '⚠ acima de €2,50/pão' : 'dentro do orçamento'}</div>
          </div>
        </div>
      </div>

      {/* Panels */}
      <div className="panels">
        {dry && (
          <Panel
            section={dry} loaves={loaves} prices={recipePrices} setPrice={setPrice}
            editable={isCustom}
            onIngEdit={onIngEdit} onIngRemove={onIngRemove} onIngAdd={onIngAdd}
          />
        )}
        {fresh && (
          <Panel
            section={fresh} loaves={loaves} prices={recipePrices} setPrice={setPrice}
            editable={isCustom}
            onIngEdit={onIngEdit} onIngRemove={onIngRemove} onIngAdd={onIngAdd}
          />
        )}

        {hacks && (
          <section className={'panel hacks' + (includeHacks ? '' : ' off')}>
            <div className="panel-head">
              <div className="h-left">
                <h2>{hacks.name}</h2>
                <div className="panel-kicker">{hacks.kicker}</div>
              </div>
              <div className="h-right">
                <button
                  className="hacks-toggle"
                  aria-pressed={includeHacks}
                  onClick={() => setIncludeHacks(v => !v)}
                >
                  <span className="switch"></span>
                  {includeHacks ? 'incluído' : 'incluir'}
                </button>
              </div>
            </div>
            <ul className="ing-list">
              {hacks.ingredients.map(ing => (
                <IngredientRow
                  key={ing.key}
                  ing={ing}
                  loaves={includeHacks ? loaves : 0}
                  priceOverride={recipePrices[ing.key]}
                  onPriceChange={(v) => setPrice(ing.key, v)}
                  editable={isCustom}
                  onEdit={(patch) => onIngEdit('hacks', ing.key, patch)}
                  onRemove={() => onIngRemove('hacks', ing.key)}
                />
              ))}
              {isCustom && (
                <li className="ing-add-row">
                  <button className="ing-add-btn" onClick={() => onIngAdd('hacks')}>
                    <span aria-hidden="true">+</span> adicionar ingrediente
                  </button>
                </li>
              )}
              {!isCustom && hacks.ingredients.length === 0 && (
                <li className="ing-empty">— sem hacks</li>
              )}
            </ul>
          </section>
        )}
      </div>

      {/* Footer */}
      <div className="action-row">
        <div className="left">
          <span className="save-dot"></span>guardado automaticamente · {Object.keys(recipePrices).length} preço{Object.keys(recipePrices).length === 1 ? '' : 's'} editado{Object.keys(recipePrices).length === 1 ? '' : 's'}
        </div>
        <div style={{display: 'flex', gap: 10, flexWrap: 'wrap'}}>
          {isCustom && (
            <button className="btn ghost danger" onClick={deleteRecipe}>Eliminar receita</button>
          )}
          <button className="btn ghost" onClick={resetPrices}>Repor preços</button>
          <button className="btn primary" onClick={() => setShowList(true)}>
            Lista de compras
          </button>
        </div>
      </div>

      {showList && (
        <ShoppingList
          recipe={recipe}
          loaves={loaves}
          prices={recipePrices}
          includeHacks={includeHacks}
          onClose={() => setShowList(false)}
        />
      )}

      {showNew && (
        <NewRecipeModal
          recipes={recipes}
          onCreate={createRecipe}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
