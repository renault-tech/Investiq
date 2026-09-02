/** Layout de cards persistido por painel — ordem, largura e o que está oculto.
 *
 * Antes cada tela que tinha cards resolvia isso sozinha (a Visão Geral tinha
 * ordem e ocultar, mais ninguém tinha nada) e a largura era fixa no código,
 * então um card que só mostra um número ocupava o mesmo espaço de um gráfico.
 * Centralizar aqui é o que permite arrastar e redimensionar em qualquer
 * painel sem reescrever a mesma lógica de storage em cada um.
 *
 * A largura é medida em colunas de um grid de 12: 3 = um quarto, 4 = um
 * terço, 6 = metade, 12 = a linha inteira. Passos livres (5, 7...) também
 * funcionam, mas os presets cobrem o que faz sentido visualmente.
 */

export const GRID_COLUMNS = 12;

/** Larguras oferecidas no controle de redimensionar, em colunas. */
export const SPAN_PRESETS = [3, 4, 6, 8, 12] as const;

export const SPAN_LABELS: Record<number, string> = {
  3: "¼",
  4: "⅓",
  6: "½",
  8: "⅔",
  12: "1",
};

export interface DashboardLayout {
  /** Ordem de exibição por id de card. Ids desconhecidos são ignorados na
   *  renderização, então um card removido do código não quebra o layout
   *  salvo de quem já usava a tela. */
  order: string[];
  hidden: string[];
  /** Largura em colunas por id; ausente = o padrão declarado pelo card. */
  spans: Record<string, number>;
}

export const EMPTY_LAYOUT: DashboardLayout = { order: [], hidden: [], spans: {} };

function storageKey(dashboardId: string): string {
  return `investiq-layout-${dashboardId}`;
}

/** Lê o layout salvo, tolerando storage indisponível, JSON corrompido e o
 *  formato antigo (que só tinha order/hidden e vivia noutra chave). */
export function loadLayout(dashboardId: string, legacyKey?: string): DashboardLayout {
  const read = (key: string): unknown => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const parsed = (read(storageKey(dashboardId)) ?? (legacyKey ? read(legacyKey) : null)) as
    | Partial<DashboardLayout>
    | null;
  if (!parsed || typeof parsed !== "object") return EMPTY_LAYOUT;

  return {
    order: Array.isArray(parsed.order) ? parsed.order.filter((id) => typeof id === "string") : [],
    hidden: Array.isArray(parsed.hidden) ? parsed.hidden.filter((id) => typeof id === "string") : [],
    spans:
      parsed.spans && typeof parsed.spans === "object"
        ? Object.fromEntries(
            Object.entries(parsed.spans).filter(
              ([, value]) => typeof value === "number" && value >= 1 && value <= GRID_COLUMNS
            )
          )
        : {},
  };
}

export function saveLayout(dashboardId: string, layout: DashboardLayout): void {
  try {
    localStorage.setItem(storageKey(dashboardId), JSON.stringify(layout));
  } catch {
    /* modo privado ou storage cheio — o layout só não persiste entre sessões */
  }
}

/** Ordem final dos cards: o que estiver salvo primeiro (na ordem escolhida),
 *  depois os que ainda não existiam quando o usuário mexeu no layout — assim
 *  um card novo aparece em vez de sumir por não estar na lista salva. */
export function resolveOrder(savedOrder: string[], availableIds: string[]): string[] {
  const available = new Set(availableIds);
  const ordered = savedOrder.filter((id) => available.has(id));
  const seen = new Set(ordered);
  return ordered.concat(availableIds.filter((id) => !seen.has(id)));
}

/** Move `draggedId` para a posição de `targetId`, preservando o resto. */
export function reorder(order: string[], draggedId: string, targetId: string): string[] {
  if (draggedId === targetId) return order;
  const next = order.slice();
  const from = next.indexOf(draggedId);
  if (from === -1) return order;
  next.splice(from, 1);
  const to = next.indexOf(targetId);
  if (to === -1) return order;
  next.splice(to, 0, draggedId);
  return next;
}
