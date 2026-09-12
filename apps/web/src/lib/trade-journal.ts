import type { InvestmentTransaction } from "./portfolio-api";

/** Uma operação fechada: par compra/venda casado por FIFO. `action` é a
 * ponta que fechou o trade (a mais recente das duas). P&L já desconta
 * taxas das duas pontas, proporcional à quantidade casada. */
export interface ClosedTrade {
  key: string;
  ticker: string;
  action: "buy" | "sell";
  quantity: number;
  pnl: number;
  date: string;
}

interface Lot {
  quantity: number;
  unitPrice: number;
  feePerUnit: number;
}

/** FIFO puro sobre compra/venda — ignora dividendo/desdobramento/
 * bonificação (não afetam quantidade comprada a preço de mercado, só o
 * preço médio contábil, fora do escopo de "P&L realizado por operação").
 * Venda antes de compra (a descoberto) é tratada como lote pendente,
 * casado pela primeira compra seguinte — não deveria ocorrer em carteira
 * de longo prazo, mas trata pra não quebrar se acontecer. */
export function computeClosedTrades(ticker: string, transactions: InvestmentTransaction[]): ClosedTrade[] {
  const sorted = transactions
    .filter((t) => t.transaction_type === "buy" || t.transaction_type === "sell")
    .slice()
    .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));

  const buyLots: Lot[] = [];
  const sellLots: Lot[] = [];
  const closed: ClosedTrade[] = [];

  for (const t of sorted) {
    const feePerUnit = t.quantity > 0 ? t.fees / t.quantity : 0;
    if (t.transaction_type === "buy") {
      let remaining = t.quantity;
      while (remaining > 0 && sellLots.length > 0) {
        const lot = sellLots[0];
        const matched = Math.min(remaining, lot.quantity);
        const pnl = (lot.unitPrice - t.unit_price) * matched - (lot.feePerUnit + feePerUnit) * matched;
        closed.push({ key: `${t.id}-${closed.length}`, ticker, action: "buy", quantity: matched, pnl, date: t.transaction_date });
        lot.quantity -= matched;
        remaining -= matched;
        if (lot.quantity <= 0) sellLots.shift();
      }
      if (remaining > 0) buyLots.push({ quantity: remaining, unitPrice: t.unit_price, feePerUnit });
    } else {
      let remaining = t.quantity;
      while (remaining > 0 && buyLots.length > 0) {
        const lot = buyLots[0];
        const matched = Math.min(remaining, lot.quantity);
        const pnl = (t.unit_price - lot.unitPrice) * matched - (lot.feePerUnit + feePerUnit) * matched;
        closed.push({ key: `${t.id}-${closed.length}`, ticker, action: "sell", quantity: matched, pnl, date: t.transaction_date });
        lot.quantity -= matched;
        remaining -= matched;
        if (lot.quantity <= 0) buyLots.shift();
      }
      if (remaining > 0) sellLots.push({ quantity: remaining, unitPrice: t.unit_price, feePerUnit });
    }
  }

  return closed;
}
