import { useId } from "react";

import type { FinanceChartPoint } from "../models/finance-experience.js";

export function chartDescriptionId(chartId: string): string {
  return `${chartId}-text-equivalent`;
}

type ChartTextEquivalentBase = Readonly<{
  chartId?: string;
  seriesMeaning: string;
  title: string;
}>;

type ChartTextEquivalentReadyProps = ChartTextEquivalentBase &
  Readonly<{ points: readonly FinanceChartPoint[]; status?: "ready" }>;

type ChartTextEquivalentUnavailableProps = ChartTextEquivalentBase &
  Readonly<{ message: string; points?: never; status: "empty" | "unavailable" }>;

export type ChartTextEquivalentProps =
  | ChartTextEquivalentReadyProps
  | ChartTextEquivalentUnavailableProps;

export function ChartTextEquivalent(props: ChartTextEquivalentProps) {
  const generatedId = useId();
  const descriptionId = props.chartId
    ? chartDescriptionId(props.chartId)
    : `${generatedId}-chart-text-equivalent`;
  const titleId = `${descriptionId}-title`;
  const status = props.status ?? "ready";
  const hasPoints = !("message" in props);

  return (
    <section
      aria-labelledby={titleId}
      className="ui-chart-text-equivalent"
      data-chart-status={status}
      data-chart-text-equivalent="true"
      id={descriptionId}
      role="region"
    >
      <h3 id={titleId}>{props.title}</h3>
      <p className="ui-chart-text-equivalent__meaning">{props.seriesMeaning}</p>
      {hasPoints ? (
        <ul aria-label={`${props.title}: valores`} className="ui-chart-text-equivalent__values">
          {props.points.map((point) => (
            <li key={point.label}>
              <span>{point.label}</span>
              <strong>{point.valueText}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ui-chart-text-equivalent__message" role="status">
          {props.message}
        </p>
      )}
    </section>
  );
}
