import { useId } from "react";

import type { FinanceSafeState as FinanceSafeStateModel } from "../models/finance-experience.js";

const safeStateDefinitions = {
  locked: { label: "Bloqueado", symbol: "!", message: "La autenticación es necesaria." },
  loading: { label: "Cargando", symbol: "…", message: "Cargando información disponible." },
  empty: { label: "Sin datos", symbol: "—", message: "No hay datos financieros disponibles." },
  error: { label: "Error", symbol: "×", message: "No se pudo mostrar la información." },
  unavailable: {
    label: "No disponible",
    symbol: "—",
    message: "La información financiera no está disponible.",
  },
} as const;

export type FinanceSafeStateProps = Readonly<{
  state: FinanceSafeStateModel;
}>;

export function FinanceSafeState({ state }: FinanceSafeStateProps) {
  const stateId = useId();
  const definition = safeStateDefinitions[state.status];
  const message = state.message ?? definition.message;
  const role = state.status === "error" ? "alert" : "status";

  return (
    <section
      aria-labelledby={`${stateId}-label ${stateId}-message`}
      aria-live={role === "alert" ? "assertive" : "polite"}
      className={`ui-finance-safe-state ui-finance-safe-state--${state.status}`}
      data-finance-state={state.status}
      data-state-label={definition.label}
      role={role}
    >
      <span aria-hidden="true" className="ui-finance-safe-state__marker" data-state-marker>
        {definition.symbol}
      </span>
      <div>
        <strong id={`${stateId}-label`}>{definition.label}</strong>
        <p data-state-message id={`${stateId}-message`}>
          {message}
        </p>
      </div>
    </section>
  );
}
