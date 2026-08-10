/** Coerção de Decimal-como-string vindo da API.
 *
 * O backend usa `Decimal` do Python e o Pydantic serializa Decimal como
 * **string** no JSON (`"38.92"`, não `38.92`) para não perder precisão. Os
 * tipos TypeScript declaram esses campos como `number`, então o compilador
 * não acusa nada — e o erro só aparece em runtime, na cara do usuário, como
 * `x.toFixed is not a function` derrubando a tela inteira.
 *
 * Esse bug já apareceu em Investimentos, Visão geral e Relatórios. A correção
 * é converter uma vez na fronteira (a função de API), para o componente poder
 * confiar no tipo declarado, em vez de espalhar `Number(...)` por toda parte
 * e esquecer de um.
 */

/** Converte as chaves indicadas de string para número, preservando null. */
export function coerceNumbers<T extends object>(obj: T, keys: readonly (keyof T)[]): T {
  const out = { ...obj };
  for (const key of keys) {
    const value = out[key];
    if (value !== null && value !== undefined && typeof value !== "number") {
      out[key] = Number(value) as T[keyof T];
    }
  }
  return out;
}

/** Mesma coisa para uma lista. */
export function coerceNumbersInList<T extends object>(
  list: T[],
  keys: readonly (keyof T)[]
): T[] {
  return list.map((item) => coerceNumbers(item, keys));
}
