export const statusDefinitions = {
  success: { label: "Éxito", symbol: "✓" },
  warning: { label: "Advertencia", symbol: "!" },
  danger: { label: "Error", symbol: "×" },
  neutral: { label: "Información", symbol: "i" },
} as const;

export type StatusTone = keyof typeof statusDefinitions;
