import { IconoirProvider as BaseIconoirProvider } from "iconoir-react";
import { useId, type ButtonHTMLAttributes, type ReactNode } from "react";

export type UiIconoirProviderProps = Readonly<{
  children: ReactNode;
}>;

export type IconoirProviderProps = UiIconoirProviderProps;

export function IconoirProvider({ children }: IconoirProviderProps) {
  return (
    <BaseIconoirProvider
      iconProps={{
        color: "currentColor",
        height: "1.25em",
        strokeWidth: 1.75,
        width: "1.25em",
      }}
    >
      {children}
    </BaseIconoirProvider>
  );
}

export const UiIconoirProvider = IconoirProvider;

export type NamedIconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-describedby" | "aria-label" | "children"
> &
  Readonly<{
    icon: ReactNode;
    label: string;
  }>;

export function NamedIconButton({
  icon,
  label,
  type = "button",
  ...buttonProps
}: NamedIconButtonProps) {
  const assistiveLabelId = useId();

  return (
    <button
      {...buttonProps}
      aria-describedby={assistiveLabelId}
      aria-label={label}
      className={
        buttonProps.className ? `ui-icon-control ${buttonProps.className}` : "ui-icon-control"
      }
      data-icon-control="true"
      type={type}
    >
      <span aria-hidden="true" className="ui-icon-control__icon" data-icon-control-icon>
        {icon}
      </span>
      <span className="ui-visually-hidden" data-assistive-label="true" id={assistiveLabelId}>
        {label}
      </span>
    </button>
  );
}
