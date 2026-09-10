/** Cores de destaque disponíveis nas Configurações. Cada opção tem um tom
 * para o tema claro e outro para o escuro — a mesma diferença de saturação
 * que o verde padrão do design system já tem entre os dois temas (globals.css),
 * para manter o contraste de texto branco sobre botões preenchidos. */
export interface AccentOption {
  id: string;
  label: string;
  light: string;
  dark: string;
}

export const ACCENT_PALETTE: AccentOption[] = [
  // Tem que bater com o fallback de --accent em globals.css: sem isso, quem
  // escolhe "Verde" explicitamente vê um verde diferente de quem nunca
  // escolheu nada.
  { id: "green", label: "Verde", light: "#12B981", dark: "#7DF9C4" },
  { id: "blue", label: "Azul", light: "#2563EB", dark: "#6C9BFF" },
  { id: "purple", label: "Roxo", light: "#7C3AED", dark: "#A78BFA" },
  { id: "pink", label: "Rosa", light: "#DB2777", dark: "#F472B6" },
  { id: "orange", label: "Laranja", light: "#D97706", dark: "#FBA94C" },
  { id: "cyan", label: "Ciano", light: "#0891B2", dark: "#4DD4E8" },
];

export const DEFAULT_ACCENT_ID = "green";

export function getAccentOption(id: string): AccentOption {
  return ACCENT_PALETTE.find((a) => a.id === id) ?? ACCENT_PALETTE[0];
}
