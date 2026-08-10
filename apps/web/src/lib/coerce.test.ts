import { describe, expect, it } from "vitest";
import { coerceNumbers, coerceNumbersInList } from "./coerce";

describe("coerceNumbers", () => {
  it("converte Decimal-como-string em número", () => {
    const out = coerceNumbers({ price: "38.92" as unknown as number }, ["price"]);
    expect(out.price).toBe(38.92);
    // O ponto do exercício: sem a coerção isso estoura em runtime.
    expect(() => out.price.toFixed(1)).not.toThrow();
  });

  it("preserva null (campo opcional continua opcional)", () => {
    const out = coerceNumbers({ target: null as number | null }, ["target"]);
    expect(out.target).toBeNull();
  });

  it("preserva undefined", () => {
    const out = coerceNumbers({ target: undefined as number | undefined }, ["target"]);
    expect(out.target).toBeUndefined();
  });

  it("deixa número intacto", () => {
    expect(coerceNumbers({ v: 3 }, ["v"]).v).toBe(3);
  });

  it("não toca em chaves não listadas", () => {
    const out = coerceNumbers({ ticker: "4", price: "10" as unknown as number }, ["price"]);
    expect(out.ticker).toBe("4"); // continua string, não vira 4
    expect(out.price).toBe(10);
  });

  it("não muta o objeto original", () => {
    const original = { price: "1.5" as unknown as number };
    coerceNumbers(original, ["price"]);
    expect(original.price).toBe("1.5");
  });
});

describe("coerceNumbersInList", () => {
  it("converte em toda a lista", () => {
    const out = coerceNumbersInList(
      [{ v: "1" as unknown as number }, { v: "2.5" as unknown as number }],
      ["v"]
    );
    expect(out.map((o) => o.v)).toEqual([1, 2.5]);
  });

  it("lista vazia não quebra", () => {
    expect(coerceNumbersInList([] as { v: number }[], ["v"])).toEqual([]);
  });
});
