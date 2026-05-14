export const fmtEur = (n: number): string =>
  "€" + (Math.round(n * 100) / 100).toFixed(2).replace(".", ",");

export const fmtG = (g: number): string => {
  if (g >= 1000) {
    return (g / 1000).toFixed(g % 1000 === 0 ? 0 : 2).replace(".", ",") + " kg";
  }
  return Math.round(g) + " g";
};

export const fmtMl = (ml: number): string => {
  if (ml >= 1000) return (ml / 1000).toFixed(2).replace(".", ",") + " L";
  return Math.round(ml) + " ml";
};

export const fmtPkg = (n: number): string => n.toFixed(1).replace(".", ",");
