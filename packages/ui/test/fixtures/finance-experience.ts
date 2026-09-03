import type {
  FinanceExperienceModel,
  FinanceExperienceState,
} from "@/models/finance-experience.js";

export const syntheticFinanceExperienceModel = {
  context: {
    heading: "Tus finanzas, de un vistazo",
    period: "Julio de 2026",
  },
  insight: {
    eyebrow: "Perspectiva del mes",
    title: "Tu progreso se mantiene en buen camino",
    description: "Revisa tus cuentas y observa cómo avanzan tus objetivos.",
    actionLabel: "Ver resumen",
  },
  accounts: [
    {
      id: "cuenta-principal",
      label: "Cuenta principal",
      detail: "Disponible para tus gastos cotidianos",
      valueText: "Saldo disponible",
      status: "ready",
    },
    {
      id: "rendimiento",
      label: "Cuenta con rendimiento",
      detail: "Saldo suministrado del periodo",
      valueText: "18 unidades",
      status: "ready",
    },
  ],
  activity: [
    {
      id: "deposito",
      label: "Aportación mensual",
      detail: "Hoy",
      valueText: "Registrada",
      status: "ready",
    },
  ],
  charts: [
    {
      id: "synthetic-savings",
      title: "Ahorro",
      seriesMeaning: "Variación del ahorro suministrada por periodo.",
      visual: "bars",
      status: "ready",
      points: [
        { label: "Enero", plotValue: 10, valueText: "10 unidades" },
        { label: "Julio", plotValue: 18, valueText: "18 unidades" },
      ],
    },
    {
      id: "synthetic-yield",
      title: "Rendimiento",
      seriesMeaning: "Retorno suministrado del periodo.",
      visual: "area",
      status: "ready",
      points: [
        { label: "Abril", plotValue: 7, valueText: "7 unidades" },
        { label: "Julio", plotValue: 12, valueText: "12 unidades" },
      ],
    },
    {
      id: "synthetic-budget",
      title: "Presupuesto disponible",
      seriesMeaning: "Variación del presupuesto suministrada por periodo.",
      visual: "line",
      status: "ready",
      points: [
        { label: "Junio", plotValue: 9, valueText: "9 unidades" },
        { label: "Julio", plotValue: 11, valueText: "11 unidades" },
      ],
    },
  ],
} as const satisfies FinanceExperienceModel;

export const syntheticReadyFinanceExperience = {
  status: "ready",
  model: syntheticFinanceExperienceModel,
} as const satisfies FinanceExperienceState;
