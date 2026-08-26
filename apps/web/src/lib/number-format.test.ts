import { describe, it, expect } from "vitest";
import {
  parseBRNumber,
  parseBRNumberOr,
  parseBRQuantity,
  parseBRQuantityOr,
  sanitizeNumericInput,
  formatQuantity,
  formatPercent,
  formatPercentFromFraction,
  formatDecimal,
} from "./number-format";

describe("parseBRNumber", () => {
  it("lê vírgula como decimal — o caso que motivou a correção", () => {
    // parseFloat("15,600") devolvia 15, e Number("15,600") devolvia NaN.
    expect(parseBRNumber("15,600")).toBe(15.6);
    expect(parseBRNumber("15,6")).toBe(15.6);
    expect(parseBRNumber("1234,5")).toBe(1234.5);
  });

  it("lê milhar com ponto e decimal com vírgula", () => {
    // parseFloat("1.234,56") devolvia 1.234 — um lançamento de mil reais
    // virava um de um real, sem erro.
    expect(parseBRNumber("1.234,56")).toBe(1234.56);
    expect(parseBRNumber("1.234.567,89")).toBe(1234567.89);
  });

  it("desempata ponto sozinho por número de casas", () => {
    expect(parseBRNumber("15.6")).toBe(15.6);
    expect(parseBRNumber("15.65")).toBe(15.65);
    expect(parseBRNumber("15.600")).toBe(15600);
    expect(parseBRNumber("1.234.567")).toBe(1234567);
    expect(parseBRNumber("0.00012345")).toBe(0.00012345);
  });

  it("aceita formato en-US quando o ponto vem depois da vírgula", () => {
    expect(parseBRNumber("1,234.56")).toBe(1234.56);
  });

  it("ignora moeda, espaços e outros ruídos", () => {
    expect(parseBRNumber("R$ 1.234,56")).toBe(1234.56);
    expect(parseBRNumber("  1 234,56 ")).toBe(1234.56);
    expect(parseBRNumber("R$1.234,56")).toBe(1234.56);
  });

  it("entende negativos, inclusive em notação contábil", () => {
    expect(parseBRNumber("-1.234,56")).toBe(-1234.56);
    expect(parseBRNumber("(1.234,56)")).toBe(-1234.56);
    expect(parseBRNumber("(R$ 50,00)")).toBe(-50);
  });

  it("devolve null para vazio, para distinguir de zero", () => {
    expect(parseBRNumber("")).toBeNull();
    expect(parseBRNumber("   ")).toBeNull();
    expect(parseBRNumber(null)).toBeNull();
    expect(parseBRNumber(undefined)).toBeNull();
    expect(parseBRNumber("abc")).toBeNull();
    expect(parseBRNumber("0")).toBe(0);
  });

  it("passa números adiante sem alterar", () => {
    expect(parseBRNumber(15.6)).toBe(15.6);
    expect(parseBRNumber(0)).toBe(0);
    expect(parseBRNumber(NaN)).toBeNull();
    expect(parseBRNumber(Infinity)).toBeNull();
  });

  it("parseBRNumberOr aplica o fallback só quando não há número", () => {
    expect(parseBRNumberOr("", 0)).toBe(0);
    expect(parseBRNumberOr("abc", 1)).toBe(1);
    expect(parseBRNumberOr("0", 1)).toBe(0);
    expect(parseBRNumberOr("15,6", 0)).toBe(15.6);
  });
});

describe("parseBRQuantity", () => {
  it("ponto é sempre milhar, nunca decimal — regra determinística, sem adivinhar por dígitos", () => {
    // Ponto único não é mais lido por heurística de casas decimais: é
    // sempre separador de milhar, mesmo em ativos cotados em dólar. Para
    // digitar uma fração de cota é preciso usar vírgula.
    expect(parseBRQuantity("41.489")).toBe(41489);
    expect(parseBRQuantity("15.6")).toBe(156);
    expect(parseBRQuantity("15.600")).toBe(15600);
  });

  it("vírgula continua sendo o único jeito de digitar decimal", () => {
    // Bug real relatado: 41,489 cotas de VWO (ETF internacional, fracionário)
    // devem ser digitadas com vírgula para não virar milhar.
    expect(parseBRQuantity("41,489")).toBe(41.489);
    expect(parseBRQuantity("15,6")).toBe(15.6);
  });

  it("continua lendo os dois separadores juntos normalmente", () => {
    expect(parseBRQuantity("1.234,56")).toBe(1234.56);
    expect(parseBRQuantity("1,234.56")).toBe(1234.56);
  });

  it("continua aceitando inteiros simples, sem separador nenhum", () => {
    expect(parseBRQuantity("100")).toBe(100);
    expect(parseBRQuantity("41489")).toBe(41489);
  });

  it("parseBRQuantityOr aplica o fallback só quando não há número", () => {
    expect(parseBRQuantityOr("", 0)).toBe(0);
    expect(parseBRQuantityOr("41,489", 0)).toBe(41.489);
    expect(parseBRQuantityOr("41.489", 0)).toBe(41489);
  });
});

describe("sanitizeNumericInput", () => {
  it("mantém o estado intermediário da digitação", () => {
    expect(sanitizeNumericInput("1.234,")).toBe("1.234,");
    expect(sanitizeNumericInput(",")).toBe(",");
  });

  it("descarta letras e símbolos", () => {
    expect(sanitizeNumericInput("R$ 1.234,56")).toBe("1.234,56");
    expect(sanitizeNumericInput("abc12")).toBe("12");
  });

  it("só aceita sinal negativo quando permitido, e sempre na frente", () => {
    expect(sanitizeNumericInput("-50", { allowNegative: true })).toBe("-50");
    expect(sanitizeNumericInput("5-0", { allowNegative: true })).toBe("50");
    expect(sanitizeNumericInput("-50")).toBe("50");
  });
});

describe("formatação em padrão BR", () => {
  it("formata quantidade com milhar e sem zeros à direita", () => {
    // Era exibido "15.6000" — lido como quinze mil e seiscentos.
    expect(formatQuantity(15.6)).toBe("15,6");
    expect(formatQuantity(15600)).toBe("15.600");
    expect(formatQuantity(100)).toBe("100");
    expect(formatQuantity(1234.5)).toBe("1.234,5");
  });

  it("preserva precisão de cripto", () => {
    // toFixed(4) truncava 0,00012345 BTC para "0.0001".
    expect(formatQuantity(0.00012345)).toBe("0,00012345");
  });

  it("formata percentual com vírgula", () => {
    expect(formatPercent(15.6)).toBe("15,6%");
    expect(formatPercent(15.6, 2)).toBe("15,60%");
    expect(formatPercent(15.6, 1, { signed: true })).toBe("+15,6%");
    expect(formatPercent(-15.6, 1, { signed: true })).toBe("-15,6%");
  });

  it("formata percentual a partir de fração", () => {
    expect(formatPercentFromFraction(0.156)).toBe("15,6%");
    expect(formatPercentFromFraction(1)).toBe("100,0%");
  });

  it("formata decimal genérico com milhar", () => {
    expect(formatDecimal(1234.5)).toBe("1.234,50");
    expect(formatDecimal(1234.5, 0)).toBe("1.235");
  });

  it("devolve travessão para valores inválidos em vez de 'NaN'", () => {
    expect(formatQuantity(NaN)).toBe("—");
    expect(formatPercent(NaN)).toBe("—");
    expect(formatDecimal(NaN)).toBe("—");
  });
});

describe("ida e volta", () => {
  it("o que é exibido pode ser digitado de volta sem perda", () => {
    for (const value of [15.6, 15600, 1234.5, 0.00012345, 1234567.89]) {
      expect(parseBRNumber(formatQuantity(value))).toBe(value);
    }
  });
});
