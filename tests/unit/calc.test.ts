import { describe, it, expect } from "vitest";
import { computeTotals, priceInfo } from "../../client/src/lib/calc";
import type { Recipe } from "../../client/src/types";

describe("priceInfo", () => {
  it("computes €/kg from package price + grams", () => {
    const { pricePerKg } = priceInfo(
      { key: "x", name: "x", grams: 100, packagePrice: 5, packageGrams: 500 }
    );
    expect(pricePerKg).toBe(10);
  });
  it("override beats package price", () => {
    const out = priceInfo(
      { key: "x", name: "x", grams: 100, packagePrice: 5, packageGrams: 500 },
      { price: 2, grams: 200 }
    );
    expect(out.packagePrice).toBe(2);
    expect(out.packageGrams).toBe(200);
    expect(out.pricePerKg).toBe(10);
  });
  it("zero grams → zero €/kg (no div by zero)", () => {
    const { pricePerKg } = priceInfo({ key: "x", name: "x", grams: 100, packagePrice: 5, packageGrams: 0 });
    expect(pricePerKg).toBe(0);
  });
});

const RECIPE: Recipe = {
  id: "r",
  name: "test",
  sections: [
    {
      id: "seca",
      name: "Seca",
      kicker: "",
      tone: "dry",
      ingredients: [
        { key: "a", name: "a", grams: 100, packagePrice: 2, packageGrams: 1000 },
        { key: "b", name: "b", grams: 50, packagePrice: 4, packageGrams: 1000 }
      ]
    },
    {
      id: "frescos",
      name: "Frescos",
      kicker: "",
      tone: "fresh",
      ingredients: [{ key: "agua", name: "Água", grams: 200, unit: "ml", free: true }]
    },
    {
      id: "hacks",
      name: "Hacks",
      kicker: "",
      tone: "hacks",
      optional: true,
      ingredients: [{ key: "h", name: "h", grams: 10, packagePrice: 10, packageGrams: 100 }]
    }
  ]
};

describe("computeTotals", () => {
  it("sums only seca for dryG (ml excluded)", () => {
    const t = computeTotals(RECIPE, 1, {}, false);
    expect(t.dryG).toBe(150);
  });
  it("computes totalCost without hacks by default", () => {
    const t = computeTotals(RECIPE, 1, {}, false);
    // a: 100g * 2€/kg / 1000 = 0.2; b: 50g * 4€/kg / 1000 = 0.2; agua: free
    expect(t.totalCost).toBeCloseTo(0.4, 6);
  });
  it("includes hacks when toggled", () => {
    const t = computeTotals(RECIPE, 1, {}, true);
    // hacks: 10g at 100€/kg = 1€
    expect(t.totalCost).toBeCloseTo(1.4, 6);
  });
  it("scales with loaves", () => {
    const t = computeTotals(RECIPE, 10, {}, false);
    expect(t.dryG).toBe(1500);
    expect(t.totalCost).toBeCloseTo(4, 6);
    expect(t.perLoaf).toBeCloseTo(0.4, 6);
  });
  it("uses overrides", () => {
    const t = computeTotals(RECIPE, 1, { a: { price: 5, grams: 500 } }, false);
    // a now 10€/kg → 100g * 10€/kg /1000 = 1€ ; b unchanged 0.2
    expect(t.totalCost).toBeCloseTo(1.2, 6);
  });
});
