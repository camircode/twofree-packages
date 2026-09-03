export type FinanceContext = Readonly<{
  heading: string;
  period: string;
}>;

export type FinanceInsight = Readonly<{
  actionLabel: string;
  description: string;
  eyebrow: string;
  title: string;
}>;

export type FinanceAccount =
  | Readonly<{
      id: string;
      label: string;
      detail: string;
      valueText: string;
      status: "ready";
    }>
  | Readonly<{
      id: string;
      label: string;
      detail: string;
      status: "unavailable";
      message: string;
      valueText?: never;
    }>;

export type FinanceActivityItem =
  | Readonly<{
      id: string;
      label: string;
      detail: string;
      valueText: string;
      status: "ready";
    }>
  | Readonly<{
      id: string;
      label: string;
      detail: string;
      status: "unavailable";
      message: string;
      valueText?: never;
    }>;

export type FinanceChartPoint = Readonly<{
  label: string;
  plotValue: number;
  valueText: string;
}>;

export type FinanceChartSeries =
  | Readonly<{
      id: string;
      title: string;
      seriesMeaning: string;
      visual: "area" | "bars" | "line";
      status: "ready";
      points: readonly FinanceChartPoint[];
    }>
  | Readonly<{
      id: string;
      title: string;
      seriesMeaning: string;
      visual: "area" | "bars" | "line";
      status: "empty" | "unavailable";
      message: string;
      points?: never;
    }>;

export type FinanceExperienceModel = Readonly<{
  accounts: readonly FinanceAccount[];
  activity: readonly FinanceActivityItem[];
  context: FinanceContext;
  charts: readonly FinanceChartSeries[];
  insight: FinanceInsight;
}>;

export type FinanceExperienceState =
  | Readonly<{ status: "locked"; message: string; model?: never }>
  | Readonly<{
      status: "loading" | "empty" | "error" | "unavailable";
      message?: string;
      model?: never;
    }>
  | Readonly<{ status: "ready"; model: FinanceExperienceModel }>;

export type FinanceSafeState = Exclude<FinanceExperienceState, { status: "ready" }>;
export type FinanceSafeExperienceState = FinanceSafeState;
