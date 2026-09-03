import { extent } from "d3-array";
import { scaleBand, scaleLinear, scalePoint } from "d3-scale";
import { area, curveMonotoneX, line } from "d3-shape";
import { useId, type ReactNode } from "react";

import { ChartTextEquivalent, chartDescriptionId } from "./chart-text-equivalent.js";
import { FinanceSafeState } from "./finance-safe-state.js";
import type {
  FinanceAccount,
  FinanceActivityItem,
  FinanceChartPoint,
  FinanceChartSeries,
  FinanceExperienceModel,
  FinanceExperienceState,
} from "../models/finance-experience.js";

export type FinanceExperienceProps = Readonly<{ state: FinanceExperienceState }>;

const chartWidth = 320;
const chartHeight = 180;
const chartPadding = 20;
type ReadySeries = Extract<FinanceChartSeries, { status: "ready" }>;

function ChartMarks({ series }: { series: ReadySeries }) {
  const labels = series.points.map((point) => point.label);
  const [minimum, maximum] = extent(series.points, (point) => point.plotValue);
  const low = minimum ?? 0;
  const high = maximum ?? 1;
  const y = scaleLinear<number, number>()
    .domain(low === high ? [low - 1, high + 1] : [low, high])
    .range([chartHeight - chartPadding, chartPadding]);

  if (series.visual === "bars") {
    const x = scaleBand<string>()
      .domain(labels)
      .range([chartPadding, chartWidth - chartPadding])
      .padding(0.22);
    const baseline = y(low);

    return (
      <g aria-hidden="true" data-chart-mark-kind="bars">
        {series.points.map((point) => {
          const top = y(point.plotValue);
          const barY = point.plotValue >= low ? top : baseline;
          return (
            <rect
              data-chart-mark="bar"
              height={point.plotValue >= low ? baseline - top : top - baseline}
              key={point.label}
              rx="12"
              width={x.bandwidth()}
              x={x(point.label)}
              y={barY}
            />
          );
        })}
      </g>
    );
  }

  const x = scalePoint<string>()
    .domain(labels)
    .range([chartPadding, chartWidth - chartPadding]);
  const path =
    series.visual === "area"
      ? area<FinanceChartPoint>()
          .x((point) => x(point.label) ?? chartPadding)
          .y0(y(low))
          .y1((point) => y(point.plotValue))
          .curve(curveMonotoneX)(series.points)
      : line<FinanceChartPoint>()
          .x((point) => x(point.label) ?? chartPadding)
          .y((point) => y(point.plotValue))
          .curve(curveMonotoneX)(series.points);

  return (
    <g aria-hidden="true" data-chart-mark-kind={series.visual}>
      {path ? (
        <path
          data-chart-mark={series.visual}
          d={path}
          fill={series.visual === "line" ? "none" : undefined}
        />
      ) : null}
      {series.points.map((point) => (
        <circle
          cx={x(point.label)}
          cy={y(point.plotValue)}
          data-chart-mark="point"
          key={point.label}
          r="5"
        />
      ))}
    </g>
  );
}

function ChartGraphic({ series }: { series: ReadySeries }) {
  const titleId = `${series.id}-graphic-title`;
  return (
    <svg
      aria-describedby={chartDescriptionId(series.id)}
      aria-labelledby={titleId}
      className="ui-finance-experience__chart-svg"
      role="img"
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
    >
      <title id={titleId}>{series.title}</title>
      <ChartMarks series={series} />
    </svg>
  );
}

function FinanceChartCard({ series }: { series: FinanceChartSeries }) {
  const ready = series.status === "ready";
  return (
    <article className="ui-finance-experience__chart-card" data-chart-status={series.status}>
      {ready ? <ChartGraphic series={series} /> : null}
      {ready ? (
        <ChartTextEquivalent
          chartId={series.id}
          points={series.points}
          seriesMeaning={series.seriesMeaning}
          title={series.title}
        />
      ) : (
        <ChartTextEquivalent
          chartId={series.id}
          message={series.message}
          seriesMeaning={series.seriesMeaning}
          status={series.status}
          title={series.title}
        />
      )}
    </article>
  );
}

function AccountCard({ account }: { account: FinanceAccount }) {
  return (
    <article className="ui-finance-experience__account-card">
      <div className="ui-finance-experience__card-heading">
        <h3>{account.label}</h3>
        <span data-account-status={account.status} role="status">
          {account.status === "ready" ? "Disponible" : "No disponible"}
        </span>
      </div>
      <p>{account.detail}</p>
      {account.status === "ready" ? (
        <strong>{account.valueText}</strong>
      ) : (
        <p role="status">{account.message}</p>
      )}
    </article>
  );
}

function ActivityCard({ item }: { item: FinanceActivityItem }) {
  return (
    <li className="ui-finance-experience__activity-item">
      <div>
        <strong>{item.label}</strong>
        <span>{item.detail}</span>
      </div>
      <span role="status">{item.status === "ready" ? item.valueText : item.message}</span>
    </li>
  );
}

function FinanceSlot({
  children,
  id,
  slot,
  title,
}: Readonly<{ children: ReactNode; id: string; slot: string; title: string }>) {
  return (
    <section
      aria-labelledby={id}
      className="ui-finance-experience__section"
      data-finance-slot={slot}
      role="region"
    >
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

function ReadyFinanceExperience({ model }: { model: FinanceExperienceModel }) {
  const insightId = useId();
  const accountsId = useId();
  const chartsId = useId();
  const activityId = useId();

  return (
    <div className="ui-finance-experience" data-finance-state="ready">
      <header className="ui-finance-experience__context" data-finance-slot="context">
        <div>
          <p className="ui-finance-experience__eyebrow">Resumen financiero · Demo</p>
          <h1>{model.context.heading}</h1>
          <p>Vista general de su patrimonio</p>
        </div>
        <button
          aria-label={`Periodo: ${model.context.period}`}
          className="ui-finance-experience__period"
          type="button"
        >
          <span>Periodo</span>
          <strong>{model.context.period}</strong>
        </button>
      </header>
      <section
        aria-labelledby={insightId}
        className="ui-finance-experience__insight"
        data-finance-slot="insight"
        role="region"
      >
        <p className="ui-finance-experience__eyebrow">{model.insight.eyebrow}</p>
        <h2 id={insightId}>{model.insight.title}</h2>
        <p>{model.insight.description}</p>
        <button type="button">{model.insight.actionLabel}</button>
      </section>
      <div className="ui-finance-experience__body" data-finance-slot="finance">
        <FinanceSlot id={accountsId} slot="accounts" title="Cuentas">
          <div className="ui-finance-experience__account-list">
            {model.accounts.map((account) => (
              <AccountCard account={account} key={account.id} />
            ))}
          </div>
        </FinanceSlot>
        <FinanceSlot id={chartsId} slot="charts" title="Visualizaciones">
          <div className="ui-finance-experience__chart-list">
            {model.charts.map((series) => (
              <FinanceChartCard key={series.id} series={series} />
            ))}
          </div>
        </FinanceSlot>
        <FinanceSlot id={activityId} slot="activity" title="Actividad reciente">
          <ul aria-label="Actividad reciente" className="ui-finance-experience__activity-list">
            {model.activity.map((item) => (
              <ActivityCard item={item} key={item.id} />
            ))}
          </ul>
        </FinanceSlot>
      </div>
    </div>
  );
}

function LockedFinanceExperience({
  state,
}: {
  state: Extract<FinanceExperienceState, { status: "locked" }>;
}) {
  const contextId = useId();
  const insightId = useId();
  const accountsId = useId();
  const chartsId = useId();
  const activityId = useId();

  return (
    <div
      aria-live="polite"
      className="ui-finance-experience"
      data-finance-state="locked"
      role="status"
    >
      <header
        aria-labelledby={contextId}
        className="ui-finance-experience__context"
        data-finance-slot="context"
      >
        <div>
          <p className="ui-finance-experience__eyebrow">Espacio financiero</p>
          <h1 id={contextId}>Resumen financiero</h1>
          <p>Una vista clara para cuidar su información financiera.</p>
        </div>
        <button
          aria-label="Periodo protegido"
          className="ui-finance-experience__period ui-finance-experience__period--locked"
          disabled
          type="button"
        >
          <span>Periodo</span>
          <strong>Protegido</strong>
        </button>
      </header>
      <section
        aria-labelledby={insightId}
        className="ui-finance-experience__insight"
        data-finance-slot="insight"
        role="region"
      >
        <p className="ui-finance-experience__eyebrow">Perspectiva segura</p>
        <h2 id={insightId}>Tu resumen estará disponible cuando accedas</h2>
        <p>{state.message}</p>
        <FinanceSafeState state={{ status: "unavailable", message: state.message }} />
      </section>
      <div className="ui-finance-experience__body" data-finance-slot="finance">
        <FinanceSlot id={accountsId} slot="accounts" title="Cuentas">
          <article className="ui-finance-experience__account-card" data-finance-state="unavailable">
            <div className="ui-finance-experience__card-heading">
              <h3>Resumen de cuentas</h3>
              <span role="status">No disponible</span>
            </div>
            <p>{state.message}</p>
          </article>
        </FinanceSlot>
        <FinanceSlot id={chartsId} slot="charts" title="Visualizaciones">
          <article className="ui-finance-experience__chart-card" data-chart-status="unavailable">
            <h3>Progreso financiero</h3>
            <p role="status">Las visualizaciones aparecerán cuando exista una sesión protegida.</p>
          </article>
        </FinanceSlot>
      </div>
      <FinanceSlot id={activityId} slot="activity" title="Actividad reciente">
        <ul aria-label="Actividad reciente" className="ui-finance-experience__activity-list">
          <li className="ui-finance-experience__activity-item">
            <div>
              <strong>Actividad financiera</strong>
              <span>Sin información disponible</span>
            </div>
            <span role="status">Accede para consultar</span>
          </li>
        </ul>
      </FinanceSlot>
    </div>
  );
}

export function FinanceExperience({ state }: FinanceExperienceProps) {
  if (state.status === "locked") return <LockedFinanceExperience state={state} />;
  if (state.status !== "ready") {
    return (
      <div className="ui-finance-experience" data-finance-state={state.status}>
        <FinanceSafeState state={state} />
      </div>
    );
  }
  return <ReadyFinanceExperience model={state.model} />;
}
