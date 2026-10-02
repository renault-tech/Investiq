import { describe, expect, it } from "vitest";
import { suggestAssetType } from "./asset-type-suggest";

describe("suggestAssetType", () => {
  it("classifica ações, FIIs, ETFs e units da B3", () => {
    expect(suggestAssetType("petr4")).toBe("stock_br");
    expect(suggestAssetType("HGLG11")).toBe("fii");
    expect(suggestAssetType("BOVA11")).toBe("etf");
    expect(suggestAssetType("TAEE11")).toBe("stock_br");
  });
  it("reconhece cripto e ações estrangeiras", () => {
    expect(suggestAssetType("BTC-USD")).toBe("crypto");
    expect(suggestAssetType("AAPL")).toBe("stock_us");
    expect(suggestAssetType("BRK.B")).toBe("stock_us");
  });
  it("não chuta nada para entrada vazia ou estranha", () => {
    expect(suggestAssetType("")).toBeNull();
    expect(suggestAssetType("^BVSP")).toBeNull();
  });
});
