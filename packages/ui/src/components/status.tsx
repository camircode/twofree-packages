import { useId, type ReactNode } from "react";

import { statusDefinitions, type StatusTone } from "../styles/status.js";

export type StatusMessageProps = Readonly<{
  tone: StatusTone;
  children: ReactNode;
}>;

export function StatusMessage({ tone, children }: StatusMessageProps) {
  const definition = statusDefinitions[tone];
  const role = tone === "danger" ? "alert" : "status";
  const statusId = useId();

  return (
    <p
      className={`ui-status ui-status--${tone}`}
      data-status-tone={tone}
      aria-labelledby={`${statusId}-label ${statusId}-message`}
      aria-live={role === "alert" ? "assertive" : "polite"}
      role={role}
    >
      <span className="ui-status__marker" data-status-marker aria-hidden="true">
        {definition.symbol}
      </span>
      <span className="ui-status__label" id={`${statusId}-label`}>
        {definition.label}
      </span>
      <span id={`${statusId}-message`}>{children}</span>
    </p>
  );
}
