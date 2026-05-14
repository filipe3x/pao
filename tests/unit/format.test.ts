import { describe, it, expect } from "vitest";
import { fmtEur, fmtG, fmtMl, fmtPkg } from "../../client/src/lib/format";

describe("fmtEur", () => {
  it("formats integer euros", () => {
    expect(fmtEur(1)).toBe("€1,00");
  });
  it("rounds to two decimals with comma", () => {
    expect(fmtEur(1.235)).toBe("€1,24");
  });
  it("handles zero", () => {
    expect(fmtEur(0)).toBe("€0,00");
  });
});

describe("fmtG", () => {
  it("uses grams below 1kg", () => {
    expect(fmtG(250)).toBe("250 g");
  });
  it("rounds grams", () => {
    expect(fmtG(250.6)).toBe("251 g");
  });
  it("uses kg without decimals when exact", () => {
    expect(fmtG(2000)).toBe("2 kg");
  });
  it("uses kg with two decimals when not exact", () => {
    expect(fmtG(1234)).toBe("1,23 kg");
  });
});

describe("fmtMl", () => {
  it("uses ml below 1L", () => {
    expect(fmtMl(220)).toBe("220 ml");
  });
  it("uses L above 1000", () => {
    expect(fmtMl(2500)).toBe("2,50 L");
  });
});

describe("fmtPkg", () => {
  it("rounds to one decimal", () => {
    expect(fmtPkg(1.234)).toBe("1,2");
  });
});
