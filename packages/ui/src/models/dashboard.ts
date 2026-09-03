import type { MoneyDto } from "@camircode/twofree-core/money.js";

export type FormattedMoney = Readonly<{
  currency: string;
  text: string;
}>;

export type DashboardMoney = Readonly<{
  exact: MoneyDto;
  formatted: FormattedMoney;
}>;

export type DashboardUnavailableBalance = Readonly<{
  status: "unavailable";
  reason: "not-calculated";
}>;

export type DashboardBalance = DashboardMoney | DashboardUnavailableBalance;

export type DashboardDataPoint = Readonly<{
  label: string;
  value: DashboardMoney;
  progress?: Readonly<{
    percent: number;
    text: string;
  }>;
}>;

export type DashboardTrendOrAllocation = Readonly<{
  kind: "trend" | "allocation";
  label: string;
  summary: string;
  values: readonly DashboardDataPoint[];
}>;

export type DashboardActivity = Readonly<{
  id: string;
  label: string;
  date: string;
  displayDate?: string;
  detail?: string;
  type?: "income" | "expense";
  value: DashboardMoney;
}>;

export type DashboardModel = Readonly<{
  balance: DashboardBalance;
  trendOrAllocation: DashboardTrendOrAllocation;
  activity: readonly DashboardActivity[];
}>;

export type DashboardState =
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "locked" }>
  | Readonly<{ status: "empty" }>
  | Readonly<{ status: "error"; message: string }>
  | Readonly<{ status: "ready"; model: DashboardModel }>;

export type { MoneyDto } from "@camircode/twofree-core/money.js";
