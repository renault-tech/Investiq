import { describe, it, expect } from "vitest";
import {
  DEFAULT_REPORT_OPTIONS,
  isValidSelection,
  monthLabel,
  recentMonths,
  reportFileName,
  reportQueryParams,
  type ReportOptions,
} from "./report-export";

const base: ReportOptions = { ...DEFAULT_REPORT_OPTIONS, month: "2026-08" };

describe("reportQueryParams", () => {
  it("omite as listas vazias — no backend, ausente significa 'todas'", () => {
    const params = reportQueryParams(base);
    expect(params.account_ids).toBeUndefined();
    expect(params.portfolio_ids).toBeUndefined();
    expect(params).toMatchObject({
      month: "2026-08",
      format: "pdf",
      include_finance: "true",
      include_investments: "true",
      include_charts: "true",
    });
  });

  it("junta os ids selecionados por vírgula", () => {
    const params = reportQueryParams({ ...base, accountIds: ["a", "b"], portfolioIds: ["p"] });
    expect(params.account_ids).toBe("a,b");
    expect(params.portfolio_ids).toBe("p");
  });

  it("envia os flags como string, que é o que a query aceita", () => {
    const params = reportQueryParams({ ...base, includeInvestments: false, includeCharts: false });
    expect(params.include_investments).toBe("false");
    expect(params.include_charts).toBe("false");
  });
});

describe("reportFileName", () => {
  it("descreve o escopo, para dois relatórios do mesmo mês não colidirem", () => {
    expect(reportFileName(base)).toBe("relatorio-completo-2026-08.pdf");
    expect(reportFileName({ ...base, includeInvestments: false })).toBe(
      "relatorio-financas-2026-08.pdf"
    );
    expect(reportFileName({ ...base, includeFinance: false })).toBe(
      "relatorio-investimentos-2026-08.pdf"
    );
  });

  it("usa a extensão do formato escolhido", () => {
    expect(reportFileName({ ...base, format: "xlsx" })).toBe("relatorio-completo-2026-08.xlsx");
  });
});

describe("isValidSelection", () => {
  it("exige ao menos uma seção — senão o documento sai vazio", () => {
    expect(isValidSelection(base)).toBe(true);
    expect(isValidSelection({ ...base, includeInvestments: false })).toBe(true);
    expect(isValidSelection({ ...base, includeFinance: false })).toBe(true);
    expect(isValidSelection({ ...base, includeFinance: false, includeInvestments: false })).toBe(false);
  });
});

describe("recentMonths", () => {
  it("lista do mais recente para o mais antigo", () => {
    const months = recentMonths(3, new Date(2026, 7, 18));
    expect(months).toEqual(["2026-08", "2026-07", "2026-06"]);
  });

  it("atravessa a virada de ano", () => {
    expect(recentMonths(3, new Date(2026, 1, 10))).toEqual(["2026-02", "2026-01", "2025-12"]);
  });

  it("não escorrega de mês em datas que o mês anterior não tem", () => {
    // Partindo de 31/03, subtrair um mês de uma data com dia 31 caía em
    // 03/03 (fevereiro não tem 31), repetindo março na lista.
    expect(recentMonths(3, new Date(2026, 2, 31))).toEqual(["2026-03", "2026-02", "2026-01"]);
  });
});

describe("monthLabel", () => {
  it("capitaliza só a inicial — 'Agosto de 2026', não 'Agosto De 2026'", () => {
    expect(monthLabel("2026-08")).toBe("Agosto de 2026");
    expect(monthLabel("2026-01")).toBe("Janeiro de 2026");
  });
});
