import { apiClient } from "./api-client";
import { coerceNumbers, coerceNumbersInList } from "./coerce";

export interface MonthlyTaxResult {
  month: string;
  asset_class: "stock_br" | "fii";
  total_sales: number;
  gross_result: number;
  exempt: boolean;
  loss_carried_in: number;
  taxable_base: number;
  tax_rate: number;
  tax_due: number;
  loss_carried_out: number;
}

export interface TaxApuration {
  year: number;
  months: MonthlyTaxResult[];
  total_tax_due_year: number;
  loss_carry_forward_stock_br: number;
  loss_carry_forward_fii: number;
  disclaimer: string;
}

export interface DarfItem {
  month: string;
  asset_class: "stock_br" | "fii";
  codigo_receita: string;
  competencia: string;
  valor: number;
  vencimento: string;
}

export interface DarfList {
  year: number;
  items: DarfItem[];
  disclaimer: string;
}

export interface DividendByAsset {
  ticker: string;
  total: number;
}

export interface PositionSnapshot {
  ticker: string;
  asset_type: string;
  quantity: number;
  avg_cost: number;
  total_cost: number;
}

export interface InformeRendimentos {
  year: number;
  dividends_total: number;
  dividends_by_asset: DividendByAsset[];
  sales_stock_br_total: number;
  sales_fii_total: number;
  positions_snapshot: PositionSnapshot[];
  snapshot_date: string;
  disclaimer: string;
}

const MONTHLY_NUMERIC = [
  "total_sales", "gross_result", "loss_carried_in", "taxable_base", "tax_rate", "tax_due", "loss_carried_out",
] as const;
const APURATION_NUMERIC = ["total_tax_due_year", "loss_carry_forward_stock_br", "loss_carry_forward_fii"] as const;
const DARF_NUMERIC = ["valor"] as const;
const DIVIDEND_NUMERIC = ["total"] as const;
const POSITION_NUMERIC = ["quantity", "avg_cost", "total_cost"] as const;
const INFORME_NUMERIC = ["dividends_total", "sales_stock_br_total", "sales_fii_total"] as const;

export async function getTaxApuration(year: number): Promise<TaxApuration> {
  const res = await apiClient.get<TaxApuration>("/taxes/apuracao", { params: { year } });
  return {
    ...coerceNumbers(res.data, APURATION_NUMERIC),
    months: coerceNumbersInList(res.data.months, MONTHLY_NUMERIC),
  };
}

export async function getDarfList(year: number): Promise<DarfList> {
  const res = await apiClient.get<DarfList>("/taxes/darf", { params: { year } });
  return { ...res.data, items: coerceNumbersInList(res.data.items, DARF_NUMERIC) };
}

export async function getInformeRendimentos(year: number): Promise<InformeRendimentos> {
  const res = await apiClient.get<InformeRendimentos>("/taxes/informe", { params: { year } });
  return {
    ...coerceNumbers(res.data, INFORME_NUMERIC),
    dividends_by_asset: coerceNumbersInList(res.data.dividends_by_asset, DIVIDEND_NUMERIC),
    positions_snapshot: coerceNumbersInList(res.data.positions_snapshot, POSITION_NUMERIC),
  };
}
