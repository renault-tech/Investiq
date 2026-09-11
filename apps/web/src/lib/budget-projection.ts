/** Extrapola o gasto atual pelo dia do mês corrido — se já passaram 60% dos
 * dias e 60% do orçamento foi gasto, a projeção fecha em 100%; se passou
 * 60% dos dias e já gastou 90%, projeta estouro. Mesma lógica em
 * SummaryCards (resumo do card) e ProjectionCard (sugestão de ação). */
export function projectMonthlyPct(spent: number, totalBudget: number, now = new Date()): number | null {
  if (totalBudget <= 0) return null;
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  if (dayOfMonth <= 0) return null;
  return (spent / (dayOfMonth / daysInMonth) / totalBudget) * 100;
}

export function projectMonthlyValue(spent: number, now = new Date()): number {
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  if (dayOfMonth <= 0) return spent;
  return spent / (dayOfMonth / daysInMonth);
}
