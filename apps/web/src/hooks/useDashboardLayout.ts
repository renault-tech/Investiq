"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DashboardLayout,
  EMPTY_LAYOUT,
  GRID_COLUMNS,
  loadLayout,
  reorder,
  resolveOrder,
  saveLayout,
} from "@/lib/dashboard-layout";

export interface DashboardCardSpec {
  id: string;
  label: string;
  /** Largura padrão em colunas de 12, usada enquanto o usuário não redimensiona. */
  defaultSpan: number;
  /** Menor largura que ainda deixa o conteúdo legível (um gráfico não cabe
   *  em ¼ de tela). O controle de tamanho não oferece nada abaixo disso. */
  minSpan?: number;
}

/** Estado de layout de um painel: ordem, ocultos e largura de cada card.
 *
 * Só carrega do storage depois da montagem — ler no primeiro render faria o
 * HTML do servidor (que não tem localStorage) divergir do cliente e o React
 * descartaria a árvore hidratada inteira.
 */
export function useDashboardLayout(
  dashboardId: string,
  cards: DashboardCardSpec[],
  legacyStorageKey?: string
) {
  const [layout, setLayout] = useState<DashboardLayout>(EMPTY_LAYOUT);
  const [loaded, setLoaded] = useState(false);
  const [dragged, setDragged] = useState<string | null>(null);

  useEffect(() => {
    setLayout(loadLayout(dashboardId, legacyStorageKey));
    setLoaded(true);
  }, [dashboardId, legacyStorageKey]);

  useEffect(() => {
    if (loaded) saveLayout(dashboardId, layout);
  }, [dashboardId, layout, loaded]);

  const availableIds = useMemo(() => cards.map((c) => c.id), [cards]);
  const specById = useMemo(
    () => Object.fromEntries(cards.map((c) => [c.id, c])) as Record<string, DashboardCardSpec>,
    [cards]
  );

  const order = useMemo(
    () => resolveOrder(layout.order, availableIds),
    [layout.order, availableIds]
  );

  const isHidden = useCallback((id: string) => layout.hidden.includes(id), [layout.hidden]);

  const spanOf = useCallback(
    (id: string) => {
      const spec = specById[id];
      const saved = layout.spans[id];
      const span = saved ?? spec?.defaultSpan ?? 4;
      return Math.min(GRID_COLUMNS, Math.max(spec?.minSpan ?? 1, span));
    },
    [layout.spans, specById]
  );

  const handleDragStart = useCallback((id: string) => setDragged(id), []);
  const handleDrop = useCallback(
    (targetId: string) => {
      setDragged((current) => {
        if (current) {
          setLayout((prev) => ({ ...prev, order: reorder(order, current, targetId) }));
        }
        return null;
      });
    },
    [order]
  );

  const hide = useCallback(
    (id: string) => setLayout((prev) => ({ ...prev, hidden: prev.hidden.concat(id) })),
    []
  );
  const restore = useCallback(
    (id: string) =>
      setLayout((prev) => ({ ...prev, hidden: prev.hidden.filter((x) => x !== id) })),
    []
  );
  const setSpan = useCallback(
    (id: string, span: number) =>
      setLayout((prev) => ({ ...prev, spans: { ...prev.spans, [id]: span } })),
    []
  );
  const reset = useCallback(() => setLayout(EMPTY_LAYOUT), []);

  const hiddenCards = useMemo(
    () => cards.filter((c) => layout.hidden.includes(c.id)),
    [cards, layout.hidden]
  );

  return {
    order,
    isHidden,
    hiddenCards,
    spanOf,
    dragged,
    handleDragStart,
    handleDrop,
    hide,
    restore,
    setSpan,
    reset,
    specById,
  };
}
