import { useId } from "react";

import { StatusMessage } from "./status.js";
import type {
  DashboardActivity,
  DashboardBalance,
  DashboardDataPoint,
  DashboardMoney,
  DashboardModel,
  DashboardState,
} from "../models/dashboard.js";

export type { DashboardBalance, DashboardModel, DashboardState } from "../models/dashboard.js";

export type FinanceDashboardProps = Readonly<{
  compact?: boolean;
  state: DashboardState;
  title?: string;
}>;

function MoneyDisplay({ value }: { value: DashboardMoney }) {
  return (
    <span className="ui-money" data-currency={value.formatted.currency}>
      <span className="ui-money__currency">{value.formatted.currency}</span>
      <span className="ui-money__text">{value.formatted.text}</span>
    </span>
  );
}

function isUnavailableBalance(
  balance: DashboardBalance,
): balance is Extract<DashboardBalance, { status: "unavailable" }> {
  return "status" in balance && balance.status === "unavailable";
}

function BalanceDisplay({ balance }: { balance: DashboardBalance }) {
  if (isUnavailableBalance(balance)) {
    return (
      <div className="ui-dashboard__balance-unavailable" data-balance-state="unavailable">
        <strong>No disponible</strong>
        <span>No calculado: requiere configuración para mostrar un saldo real.</span>
      </div>
    );
  }

  return <MoneyDisplay value={balance} />;
}

function ProgressVisual({
  point,
  labelId,
  decorative = false,
}: {
  point: DashboardDataPoint;
  labelId?: string;
  decorative?: boolean;
}) {
  if (!point.progress) {
    return <span className="ui-dashboard__progress-empty">Sin progreso indicado</span>;
  }

  return (
    <div className="ui-dashboard__progress">
      <progress
        max={100}
        value={point.progress.percent}
        aria-hidden={decorative || undefined}
        aria-labelledby={decorative ? undefined : labelId}
      />
      <span>{point.progress.text}</span>
    </div>
  );
}

function DataPoint({
  point,
  index,
  headingId,
  showProgress,
}: {
  point: DashboardDataPoint;
  index: number;
  headingId: string;
  showProgress: boolean;
}) {
  const labelId = `${headingId}-label-${index}`;

  return (
    <tr>
      <th id={labelId} scope="row">
        {point.label}
      </th>
      <td>
        <MoneyDisplay value={point.value} />
      </td>
      {showProgress ? (
        <td>
          <ProgressVisual point={point} labelId={labelId} />
        </td>
      ) : null}
    </tr>
  );
}

function TrendOrAllocation({ model, headingId }: { model: DashboardModel; headingId: string }) {
  const data = model.trendOrAllocation;
  const showProgress = data.values.some((point) => point.progress !== undefined);
  const isAllocation = data.kind === "allocation";
  const tableCaption = isAllocation
    ? data.label.includes("moneda")
      ? "Valores por moneda"
      : "Valores por categoría"
    : "Valores por periodo";

  return (
    <section className="ui-dashboard__data" aria-labelledby={headingId}>
      <div className="ui-dashboard__section-heading">
        <div>
          <h2 id={headingId}>{data.label}</h2>
        </div>
      </div>
      <p className="ui-dashboard__summary">{data.summary}</p>
      {data.values.length ? (
        <>
          <div className="ui-dashboard__desktop-data" data-dashboard-layout="desktop">
            <table>
              <caption>{tableCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">Concepto</th>
                  <th scope="col">Importe</th>
                  {showProgress ? <th scope="col">Progreso</th> : null}
                </tr>
              </thead>
              <tbody>
                {data.values.map((point, index) => (
                  <DataPoint
                    key={point.label}
                    headingId={headingId}
                    index={index}
                    point={point}
                    showProgress={showProgress}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div
            className="ui-dashboard__compact-data"
            data-dashboard-layout="compact"
            data-testid="dashboard-compact-data"
          >
            <ul aria-label={`${data.label}: valores compactos`}>
              {data.values.map((point, index) => (
                <li key={point.label}>
                  <div className="ui-dashboard__compact-value">
                    <span id={`${headingId}-compact-label-${index}`}>{point.label}</span>
                    <MoneyDisplay value={point.value} />
                  </div>
                  {showProgress ? <ProgressVisual point={point} decorative /> : null}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <p className="ui-dashboard__empty-data">
          Aún no hay movimientos registrados para mostrar por moneda.
        </p>
      )}
    </section>
  );
}

function ActivityRow({ item }: { item: DashboardActivity }) {
  return (
    <li data-type={item.type}>
      <span className="ui-dashboard__activity-mark" aria-hidden="true">
        •
      </span>
      <div className="ui-dashboard__activity-details">
        <span className="ui-dashboard__activity-label">{item.label}</span>
        {item.detail ? <span className="ui-dashboard__activity-detail">{item.detail}</span> : null}
        <time dateTime={item.date}>{item.displayDate ?? item.date}</time>
      </div>
      <MoneyDisplay value={item.value} />
    </li>
  );
}

function ReadyDashboard({
  compact,
  model,
  title,
  headingPrefix,
}: {
  compact: boolean;
  model: DashboardModel;
  title: string;
  headingPrefix: string;
}) {
  return (
    <>
      {compact ? null : (
        <header className="ui-dashboard__heading">
          <h1>{title}</h1>
          <p>Revise la actividad registrada y mantenga sus decisiones financieras visibles.</p>
        </header>
      )}
      <div className="ui-dashboard__overview">
        <section className="ui-dashboard__balance" aria-labelledby={`${headingPrefix}-balance`}>
          <div className="ui-dashboard__section-heading">
            <div>
              <h2 id={`${headingPrefix}-balance`}>Saldo disponible</h2>
            </div>
          </div>
          <BalanceDisplay balance={model.balance} />
          {compact || isUnavailableBalance(model.balance) ? null : (
            <p className="ui-dashboard__balance-note">El saldo refleja los datos proporcionados.</p>
          )}
        </section>
        <TrendOrAllocation model={model} headingId={`${headingPrefix}-data`} />
      </div>
      <section className="ui-dashboard__activity" aria-labelledby={`${headingPrefix}-activity`}>
        <div className="ui-dashboard__section-heading">
          <div>
            <h2 id={`${headingPrefix}-activity`}>Actividad reciente</h2>
          </div>
        </div>
        {model.activity.length ? (
          <ul aria-label="Movimientos recientes">
            {model.activity.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </ul>
        ) : (
          <p className="ui-dashboard__empty-data">
            Aún no hay movimientos. Registre el primero para comenzar a construir su historial.
          </p>
        )}
      </section>
    </>
  );
}

export function FinanceDashboard({
  compact = false,
  state,
  title = "Resumen financiero",
}: FinanceDashboardProps) {
  const headingPrefix = useId();

  if (state.status === "loading") {
    return <StatusMessage tone="neutral">Cargando su resumen financiero.</StatusMessage>;
  }

  if (state.status === "locked") {
    return (
      <StatusMessage tone="neutral">
        Inicie sesión para consultar sus datos financieros.
      </StatusMessage>
    );
  }

  if (state.status === "empty") {
    return (
      <StatusMessage tone="neutral">
        Todavía no hay cuentas ni movimientos en este espacio.
      </StatusMessage>
    );
  }

  if (state.status === "error") {
    return <StatusMessage tone="danger">{state.message}</StatusMessage>;
  }

  return (
    <div className="ui-dashboard" data-compact={compact || undefined}>
      <ReadyDashboard
        compact={compact}
        model={state.model}
        title={title}
        headingPrefix={headingPrefix}
      />
    </div>
  );
}
