// Recipes data — extensible for future recipes.
// Each ingredient has: name, grams per loaf, default €/kg.
// `exact: true`  → quantidade confirmada do rótulo do produto original
// `free: true`   → custo zero (massa mãe, água)
// `unit: 'ml'`   → displayed as ml instead of g (cálculo idêntico)

window.RECIPES = [
  {
    id: 'pao-sg-mm',
    name: 'Pão sem glúten',
    subtitle: 'Massa mãe · biológico · máquina panificadora',
    badge: 'base',
    weeklyConsumption: 2, // pães/semana — usado para "stock estimado"
    sections: [
      {
        id: 'seca',
        name: 'Mistura Seca',
        kicker: 'prepara-se em avanço · dura semanas',
        tone: 'dry',
        ingredients: [
          { key: 'arroz',     name: 'Farinha de arroz bio',           grams: 90, packagePrice: 1.09, packageGrams: 500 },
          { key: 'amendoa',   name: 'Farinha de amêndoa bio',         grams: 45, packagePrice: 3.99, packageGrams: 200 },
          { key: 'aveia',     name: 'Farinha de aveia s/glúten bio',  grams: 38, packagePrice: 3.58, packageGrams: 1000 },
          { key: 'araruta',   name: 'Farinha de araruta bio',         grams: 30, packagePrice: 3.06, packageGrams: 211 },
          { key: 'avela',     name: 'Avelã moída bio',                grams: 28, packagePrice: 5.29, packageGrams: 200,  exact: true },
          { key: 'sarraceno', name: 'Farinha de trigo sarraceno bio', grams: 24, packagePrice: 6.09, packageGrams: 1000, exact: true },
          { key: 'sal',       name: 'Sal marinho',                    grams: 5,  packagePrice: 3.99, packageGrams: 1000 },
        ],
      },
      {
        id: 'frescos',
        name: 'Frescos',
        kicker: 'junta-se no dia',
        tone: 'fresh',
        ingredients: [
          { key: 'mm',     name: 'Massa mãe activa 100% hid.', grams: 80,  free: true, note: 'do frasco' },
          { key: 'agua',   name: 'Água filtrada morna',         grams: 220, unit: 'ml', free: true, note: 'da torneira' },
          { key: 'coco',   name: 'Óleo de coco bio',            grams: 15,  packagePrice: 4.39, packageGrams: 200 },
          { key: 'geleia', name: 'Geleia de arroz bio',         grams: 12,  packagePrice: 5.89, packageGrams: 520 },
        ],
      },
      {
        id: 'hacks',
        name: 'Hacks',
        kicker: 'opcionais · usar conforme a massa pede',
        tone: 'hacks',
        optional: true,
        ingredients: [
          { key: 'psyllium', name: 'Psyllium husk',           grams: 5, packagePrice: 6.99, packageGrams: 125, note: 'dá elasticidade · sem ele reduz água p/ 160–180ml' },
          { key: 'fermento', name: 'Fermento seco s/glúten',  grams: 2, packagePrice: 1.49, packageGrams: 20,  note: 'segurança se a massa mãe estiver fraca' },
        ],
      },
    ],
  },
];
