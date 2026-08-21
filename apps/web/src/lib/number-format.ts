/** Números no padrão brasileiro — leitura e escrita.
 *
 * O problema que isso resolve: `toFixed()` e `parseFloat()` são fixos no
 * padrão en-US (ponto decimal). Numa interface em português isso gera duas
 * classes de bug, ambas silenciosas:
 *
 * 1. **Exibição.** Uma quantidade de 15,6 cotas saía como "15.6000" na
 *    tabela de posições. O leitor brasileiro lê o ponto como separador de
 *    milhar — "quinze mil e seiscentos". Pior: 15600 saía "15600.0000",
 *    sem agrupamento nenhum.
 *
 * 2. **Entrada.** `parseFloat("1.234,56")` devolve **1.234** — para no
 *    primeiro caractere inválido. Um lançamento de R$ 1.234,56 virava
 *    R$ 1,23 sem erro nenhum, direto no banco.
 *
 * Toda leitura e escrita de número passa por aqui.
 */

/** Interpreta número digitado por um usuário brasileiro.
 *
 * Aceita as formas que aparecem na prática — "1.234,56", "15,6", "15.6",
 * "R$ 1.234,56", "1 234,56" — e devolve `null` quando não há número, para
 * o chamador distinguir "vazio" de "zero".
 *
 * A regra de desempate segue o padrão BR: com os dois separadores, o
 * **último** é o decimal; com só vírgula, ela é o decimal ("15,600" = 15,6,
 * não 15600). Só ponto é ambíguo, então o ponto é tratado como decimal
 * quando separa 1 ou 2 casas ("15.6" = 15,6) e como milhar quando separa
 * exatamente 3 ("15.600" = 15600), que é como as duas notações realmente
 * aparecem digitadas.
 */
export function parseBRNumber(raw: string | number | null | undefined): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (raw == null) return null;

  let s = String(raw).trim();
  if (!s) return null;

  // Parênteses contábeis: (1.234,56) é negativo.
  let negative = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    negative = true;
    s = s.slice(1, -1);
  }

  // Fora dígitos e separadores, só o sinal importa.
  s = s.replace(/[^\d,.\-+]/g, "");
  if (s.startsWith("-")) {
    negative = !negative;
  }
  s = s.replace(/[-+]/g, "");
  if (!s) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    // Os dois presentes: o que vem por último é o decimal.
    const [decimalSep, groupSep] = lastComma > lastDot ? [",", "."] : [".", ","];
    s = s.split(groupSep).join("").replace(decimalSep, ".");
  } else if (lastComma >= 0) {
    // Só vírgula — decimal, sempre. É o padrão brasileiro.
    s = s.split(",").join(".");
  } else if (lastDot >= 0) {
    // Só ponto — ambíguo. Um único ponto separando exatamente 3 casas é
    // milhar ("15.600"); qualquer outro arranjo é decimal ("15.6", "1.2345").
    const parts = s.split(".");
    const isThousands = parts.length > 1 && parts.slice(1).every((p) => p.length === 3);
    s = isThousands ? parts.join("") : `${parts.slice(0, -1).join("")}.${parts[parts.length - 1]}`;
  }

  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

/** `parseBRNumber` com piso — para campos onde vazio equivale a zero. */
export function parseBRNumberOr(raw: string | number | null | undefined, fallback: number): number {
  const parsed = parseBRNumber(raw);
  return parsed == null ? fallback : parsed;
}

/** Aceita apenas o que pode fazer parte de um número em digitação.
 *
 * Usada no `onChange` dos campos: deixa o usuário digitar "1.234," sem que o
 * estado rejeite o passo intermediário, mas barra letras e símbolos.
 */
export function sanitizeNumericInput(raw: string, { allowNegative = false } = {}): string {
  let s = raw.replace(allowNegative ? /[^\d,.\-]/g : /[^\d,.]/g, "");
  if (allowNegative) {
    // Sinal só na frente, e só um.
    const isNegative = s.startsWith("-");
    s = (isNegative ? "-" : "") + s.replace(/-/g, "");
  }
  return s;
}

/** Quantidade de ativo — até `maxDecimals` casas, sem zeros à direita.
 *
 * Cripto precisa de 8 casas; ação inteira não deve exibir "100,0000". O
 * agrupamento de milhar entra sempre, porque é justamente a sua ausência
 * que fazia "15600" ser lido errado.
 */
export function formatQuantity(value: number, maxDecimals = 8): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

/** Percentual em padrão BR: 15,6% — nunca "15.6%". */
export function formatPercent(value: number, decimals = 1, { signed = false } = {}): string {
  if (!Number.isFinite(value)) return "—";
  const sign = signed && value >= 0 ? "+" : "";
  return `${sign}${value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

/** Percentual a partir de fração (0,156 -> "15,6%"). */
export function formatPercentFromFraction(fraction: number, decimals = 1, opts?: { signed?: boolean }): string {
  return formatPercent(fraction * 100, decimals, opts);
}

/** Número genérico em padrão BR, com casas fixas. */
export function formatDecimal(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
