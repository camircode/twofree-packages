import type { DashboardModel, DashboardState } from "@/models/dashboard.js";
export const spanishDashboardMoney = {
  exact: { currency: "USD", coefficient: "123456789012345678901234567890", scale: 2 },
  formatted: { currency: "USD", text: "$1,234.56" },
} as const;
export const spanishDashboardModel = {
  balance: spanishDashboardMoney,
  trendOrAllocation: {
    kind: "allocation",
    label: "Distribución de gastos",
    summary: "La vivienda concentra la mayor parte del presupuesto disponible este mes.",
    values: [
      {
        label: "Vivienda y servicios esenciales",
        value: spanishDashboardMoney,
        progress: { percent: 68, text: "68 % del total" },
      },
      {
        label: "Alimentación y compras del hogar",
        value: {
          exact: { currency: "USD", coefficient: "25000", scale: 2 },
          formatted: { currency: "USD", text: "$250.00" },
        },
        progress: { percent: 21, text: "21 % del total" },
      },
      {
        label: "Ahorro para objetivos familiares y proyectos a largo plazo",
        value: {
          exact: { currency: "USD", coefficient: "12500", scale: 2 },
          formatted: { currency: "USD", text: "$125.00" },
        },
        progress: { percent: 11, text: "11 % del total" },
      },
    ],
  },
  activity: [
    {
      id: "supermercado",
      label: "Supermercado del barrio",
      date: "2026-07-20",
      value: spanishDashboardMoney,
    },
    {
      id: "transporte",
      label: "Suscripción de transporte",
      date: "2026-07-18",
      value: {
        exact: { currency: "USD", coefficient: "9500", scale: 2 },
        formatted: { currency: "USD", text: "$95.00" },
      },
    },
  ],
} as const satisfies DashboardModel;

export const spanishDashboardStates = {
  loading: { status: "loading" },
  empty: { status: "empty" },
  error: { status: "error", message: "No se pudo cargar la información del panel." },
  ready: { status: "ready", model: spanishDashboardModel },
} as const satisfies Readonly<Record<"loading" | "empty" | "error" | "ready", DashboardState>>;
