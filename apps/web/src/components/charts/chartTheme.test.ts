import { describe, it, expect } from "vitest";
import { formatBRL, formatBRLCompact, formatPct, assetTypeLabel } from "./chartTheme";

// Intl.NumberFormat("pt-BR", {style:"currency"}) separates "R$" from the
// amount with a non-breaking space (U+00A0), not a regular space.
const NBSP = " ";

describe("formatBRL", () => {
  it("formats positive values with two decimals", () => {
    expect(formatBRL(1234.5)).toBe(`R$${NBSP}1.235`);
  });

  it("keeps decimals for sub-thousand values", () => {
    expect(formatBRL(42.5)).toBe(`R$${NBSP}42,50`);
  });

  it("formats negative values with two decimals (below the 1000 compacting threshold)", () => {
    expect(formatBRL(-100)).toBe(`-R$${NBSP}100,00`);
  });
});

describe("formatBRLCompact", () => {
  it("compacts millions", () => {
    expect(formatBRLCompact(2_500_000)).toBe("R$ 2,5 mi");
  });

  it("compacts thousands", () => {
    expect(formatBRLCompact(15_000)).toBe("R$ 15 mil");
  });

  it("falls back to full format under a thousand", () => {
    expect(formatBRLCompact(500)).toBe(`R$${NBSP}500,00`);
  });
});

describe("formatPct", () => {
  it("converts a fraction to a percentage string", () => {
    expect(formatPct(0.1533)).toBe("15,3%");
  });

  it("handles zero", () => {
    expect(formatPct(0)).toBe("0%");
  });
});

describe("assetTypeLabel", () => {
  it("translates known asset types to PT-BR", () => {
    expect(assetTypeLabel("fii")).toBe("FIIs");
    expect(assetTypeLabel("stock")).toBe("Ações");
  });

  it("falls back to the raw type when unknown", () => {
    expect(assetTypeLabel("mystery_type")).toBe("mystery_type");
  });
});
