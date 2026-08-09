// Paleta categórica fixa (validada p/ CVD e contraste em light #FFF e dark #0F172A).
// Ordem fixa — nunca ciclar: a fatia N usa sempre CATEGORICAL[N].
export const CATEGORICAL = [
  "#2563EB", // azul
  "#059669", // esmeralda
  "#7C3AED", // violeta
  "#D97706", // âmbar
  "#0891B2", // ciano
  "#DB2777", // rosa
] as const;

export const MAX_SLICES = 6; // além disso, agregar em "Outros"

export const ASSET_TYPE_LABELS: Record<string, string> = {
  stock: "Ações",
  stock_br: "Ações BR",
  stock_us: "Ações EUA",
  fii: "FIIs",
  reit: "REITs",
  etf: "ETFs",
  crypto: "Cripto",
  commodity: "Commodities",
  fixed_income_br: "Renda Fixa",
  other: "Outros",
};

export function assetTypeLabel(type: string): string {
  return ASSET_TYPE_LABELS[type] ?? type;
}

/** Arredonda para reais inteiros acima de mil — desejável em eixo de gráfico,
 * onde os centavos são ruído. Para extrato, saldo e qualquer número que o
 * usuário vá conferir contra o banco, use formatBRLExact. */
export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  });
}

/** Sempre com centavos. R$ 1.234,50 não pode virar "R$ 1.235" num livro-caixa. */
export function formatBRLExact(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatBRLCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(value) >= 1_000) return `R$ ${(value / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return formatBRL(value);
}

export function formatPct(fraction: number): string {
  return `${(fraction * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}
