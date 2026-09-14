import { beforeEach, describe, expect, it } from "vitest";
import {
  EMPTY_LAYOUT,
  LAYOUT_VERSION,
  loadLayout,
  resolveOrder,
  saveLayout,
} from "./dashboard-layout";

const KEY = "investiq-layout-overview";

describe("dashboard-layout", () => {
  beforeEach(() => localStorage.clear());

  it("descarta layout gravado antes do versionamento", () => {
    // Formato antigo: sem `version`. Deixar isto passar era o que travava o
    // design novo para quem já tinha arrastado um card uma vez.
    localStorage.setItem(KEY, JSON.stringify({ order: ["health", "net"], hidden: [], spans: {} }));
    expect(loadLayout("overview")).toEqual(EMPTY_LAYOUT);
  });

  it("descarta layout de uma versão anterior do padrão", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ order: ["health", "net"], hidden: [], spans: {}, version: LAYOUT_VERSION - 1 })
    );
    expect(loadLayout("overview")).toEqual(EMPTY_LAYOUT);
  });

  it("mantém o layout do usuário quando a versão bate", () => {
    saveLayout("overview", { order: ["health", "net"], hidden: ["alloc"], spans: { net: 8 } });
    expect(loadLayout("overview")).toEqual({
      order: ["health", "net"],
      hidden: ["alloc"],
      spans: { net: 8 },
    });
  });

  it("carimba a versão atual ao salvar", () => {
    saveLayout("overview", EMPTY_LAYOUT);
    expect(JSON.parse(localStorage.getItem(KEY) as string).version).toBe(LAYOUT_VERSION);
  });

  it("acrescenta cards novos ao fim da ordem salva", () => {
    expect(resolveOrder(["net", "flow"], ["net", "flow", "health"])).toEqual(["net", "flow", "health"]);
  });
});
