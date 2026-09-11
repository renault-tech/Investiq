/** Cores de destaque disponíveis nas Configurações. Cada opção tem um tom
 * para o tema claro e outro para o escuro — a mesma diferença de saturação
 * que o verde padrão do design system já tem entre os dois temas (globals.css),
 * para manter o contraste de texto branco sobre botões preenchidos.
 *
 * onLight/onDark: cor do texto/ícone POR CIMA do tom correspondente (light/
 * dark), escolhida pelo contraste WCAG AA (4.5:1) real de cada tom — não um
 * valor fixo. #04120D (escuro) vence contra a maioria, mas no tema claro
 * azul/roxo/rosa são saturados demais para passar com texto escuro (ex.:
 * roxo #7C3AED fica em 3.36:1 — abaixo do mínimo) e precisam de branco.
 * Valores calculados via luminância relativa (fórmula do WCAG 2.1). */
export interface AccentOption {
  id: string;
  label: string;
  light: string;
  dark: string;
  onLight: string;
  onDark: string;
}

const ON_DARK = "#04120D";
const ON_LIGHT_TEXT = "#FFFFFF";

export const ACCENT_PALETTE: AccentOption[] = [
  // Tem que bater com o fallback de --accent/--on-accent em globals.css: sem
  // isso, quem escolhe "Verde" explicitamente vê uma cor diferente de quem
  // nunca escolheu nada.
  { id: "green", label: "Verde", light: "#12B981", dark: "#7DF9C4", onLight: ON_DARK, onDark: ON_DARK },
  { id: "blue", label: "Azul", light: "#2563EB", dark: "#6C9BFF", onLight: ON_LIGHT_TEXT, onDark: ON_DARK },
  { id: "purple", label: "Roxo", light: "#7C3AED", dark: "#A78BFA", onLight: ON_LIGHT_TEXT, onDark: ON_DARK },
  { id: "pink", label: "Rosa", light: "#DB2777", dark: "#F472B6", onLight: ON_LIGHT_TEXT, onDark: ON_DARK },
  { id: "orange", label: "Laranja", light: "#D97706", dark: "#FBA94C", onLight: ON_DARK, onDark: ON_DARK },
  { id: "cyan", label: "Ciano", light: "#0891B2", dark: "#4DD4E8", onLight: ON_DARK, onDark: ON_DARK },
];

export const DEFAULT_ACCENT_ID = "green";

export function getAccentOption(id: string): AccentOption {
  return ACCENT_PALETTE.find((a) => a.id === id) ?? ACCENT_PALETTE[0];
}
