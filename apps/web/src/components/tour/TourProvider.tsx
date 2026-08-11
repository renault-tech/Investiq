"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { tutorialForPath, type TourStep } from "@/lib/tutorials";
import { TourBalloon } from "./TourBalloon";

interface TourContextValue {
  /** Reabre o tour da tela atual, mesmo que já tenha sido visto. */
  startTour: () => void;
  /** Marca todas as telas como vistas — o "pular tudo" do balão. */
  dismissAll: () => void;
}

const TourContext = createContext<TourContextValue>({
  startTour: () => {},
  dismissAll: () => {},
});

export const useTour = () => useContext(TourContext);

const SEEN_KEY = "investiq-tour-seen";
const DISMISSED_KEY = "investiq-tour-dismissed";

function readSeen(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tutorial = tutorialForPath(pathname);

  const [seen, setSeen] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(true);
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Ler localStorage só depois de montar: no servidor ele não existe, e
  // decidir a visibilidade do balão no primeiro render causaria hydration
  // mismatch com o HTML vindo do Next.
  useEffect(() => {
    setSeen(readSeen());
    setDismissed(window.localStorage.getItem(DISMISSED_KEY) === "1");
    setHydrated(true);
  }, []);

  const route = tutorial?.route;

  useEffect(() => {
    if (!hydrated || !route || dismissed) return;
    // Abre sozinho só na primeira visita da tela; depois disso o usuário
    // reabre pela Central de ajuda se quiser.
    setStepIndex(seen.includes(route) ? null : 0);
  }, [hydrated, route, dismissed, seen]);

  const markSeen = useCallback((value: string) => {
    setSeen((prev) => {
      if (prev.includes(value)) return prev;
      const next = [...prev, value];
      try {
        window.localStorage.setItem(SEEN_KEY, JSON.stringify(next));
      } catch {
        // Modo privado do Safari rejeita escrita: o tour só reaparece na
        // próxima visita, o que é melhor do que derrubar a tela.
      }
      return next;
    });
  }, []);

  const close = useCallback(() => {
    setStepIndex(null);
    if (route) markSeen(route);
  }, [route, markSeen]);

  const dismissAll = useCallback(() => {
    setStepIndex(null);
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // idem
    }
  }, []);

  const startTour = useCallback(() => {
    setDismissed(false);
    try {
      window.localStorage.removeItem(DISMISSED_KEY);
    } catch {
      // idem
    }
    setStepIndex(0);
  }, []);

  const steps: TourStep[] = tutorial?.steps ?? [];
  const activeStep = stepIndex !== null ? steps[stepIndex] : undefined;

  const value = useMemo(() => ({ startTour, dismissAll }), [startTour, dismissAll]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {activeStep && (
        <TourBalloon
          step={activeStep}
          index={stepIndex!}
          total={steps.length}
          screenLabel={tutorial!.label}
          onBack={() => setStepIndex((i) => Math.max(0, (i ?? 0) - 1))}
          onNext={() => {
            if (stepIndex! + 1 >= steps.length) close();
            else setStepIndex(stepIndex! + 1);
          }}
          onClose={close}
          onDismissAll={dismissAll}
        />
      )}
    </TourContext.Provider>
  );
}
