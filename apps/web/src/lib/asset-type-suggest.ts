/** Palpite da classe de um ticker pelo formato — só para pré-selecionar o
 *  campo no cadastro (a pessoa pode trocar). Antes o padrão fixo era "Ação
 *  B3" e um FII como HGLG11 entrava como ação: a alocação mostrava "Ações
 *  100%" e a apuração de IR aplicava a regra errada.
 *
 *  Final 11 na B3 é ambíguo (FII, ETF ou unit): ETFs e units conhecidos são
 *  listados; o resto do final 11 é tratado como FII, que é o caso mais comum. */
const B3_ETFS = new Set([
  "BOVA11", "BOVV11", "BOVB11", "BOVX11", "SMAL11", "SMAC11", "IVVB11", "SPXI11", "HASH11", "QBTC11",
  "ETHE11", "BITH11", "NASD11", "XINA11", "EURP11", "ACWI11", "GOLD11", "DIVO11", "FIND11", "MATB11",
  "ECOO11", "ISUS11", "PIBB11", "BRAX11", "BBSD11", "IMAB11", "IRFM11", "B5P211", "FIXA11", "DEBB11",
  "WRLD11", "TECK11", "NFTS11", "META11", "USTK11", "SPXB11", "BOVS11", "XFIX11", "AGRI11", "GENB11",
]);
const B3_UNITS = new Set([
  "TAEE11", "SANB11", "KLBN11", "ALUP11", "BPAC11", "ENGI11", "SAPR11", "TIET11", "IGTI11", "SULA11",
  "BRBI11", "AESB11", "CPLE11", "ITSA11", "RNEW11", "PPLA11", "BIDI11", "STBP11", "SMFT11",
]);

export type SuggestedAssetType = "stock_br" | "fii" | "etf" | "stock_us" | "crypto";

export function suggestAssetType(rawTicker: string): SuggestedAssetType | null {
  const ticker = rawTicker.trim().toUpperCase();
  if (!ticker) return null;
  if (/-(USD|BRL|USDT)$/.test(ticker)) return "crypto";
  if (/^[A-Z]{4}\d{1,2}F?$/.test(ticker)) {
    if (!ticker.endsWith("11")) return "stock_br";
    if (B3_ETFS.has(ticker)) return "etf";
    if (B3_UNITS.has(ticker)) return "stock_br";
    return "fii";
  }
  if (/^[A-Z]{1,5}(\.[A-Z])?$/.test(ticker)) return "stock_us";
  return null;
}
