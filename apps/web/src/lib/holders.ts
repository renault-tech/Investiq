/** Filtro de titular — mesmo sentinelo usado pelo backend (src/shared/holder_filter.py).
 *
 * `holder` vazio já significa "todos os titulares" (sem filtro); faltava um
 * terceiro valor para escolher explicitamente "só as minhas contas, sem
 * titular definido" quando já existe conta de outra pessoa — daí o
 * sentinelo em vez de reaproveitar null/"".
 */
export const NO_HOLDER = "__sem_titular__";

interface HasHolder {
  holder: string | null;
}

/** Opções para o <select> de titular: "Todos", cada titular nomeado, e "Eu"
 * (o sentinelo) só quando há mistura de contas com e sem titular — não faz
 * sentido oferecer "Eu" separado de "Todos" se todas as contas já são suas. */
export function buildHolderOptions(...groups: HasHolder[][]): { value: string; label: string }[] {
  const items = groups.flat();
  const named = Array.from(new Set(items.map((i) => i.holder).filter((h): h is string => !!h))).sort();
  const hasUnnamed = items.some((i) => !i.holder);

  const options = [{ value: "", label: "Todos os titulares" }];
  if (hasUnnamed && named.length > 0) {
    options.push({ value: NO_HOLDER, label: "Eu" });
  }
  for (const h of named) {
    options.push({ value: h, label: h });
  }
  return options;
}

/** Filtragem client-side equivalente ao `holder_condition` do backend —
 * usada onde o filtro não passa por uma chamada de API (ex.: portfolios na
 * Visão Geral, já carregados por inteiro). */
export function matchesHolder(itemHolder: string | null, selected: string): boolean {
  if (!selected) return true;
  if (selected === NO_HOLDER) return !itemHolder;
  return itemHolder === selected;
}
