"use client";

import {
  Bell,
  CheckCircle,
  Community,
  CreditCard,
  Database,
  EditPencil,
  GraphUp,
  Lock,
  Plus,
  Settings,
  ShieldCheck,
  Trash,
  Wallet,
} from "iconoir-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { useDialogFocus } from "./dialog-focus";
import { IconoirProvider } from "./icon-control";
import { runViewTransition } from "../motion/view-transition";

export type ProductMoney = Readonly<{ currency: string; coefficient: string; scale: number }>;
export type ProductRecordView<T> = Readonly<{
  id: string;
  value: T;
  createdAt: string;
  updatedAt: string;
}>;
export type CollectionState<T> =
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "error"; message: string; unauthorized?: boolean }>
  | Readonly<{ status: "ready"; records: readonly ProductRecordView<T>[]; preview?: boolean }>;

export type BudgetForm = Readonly<{
  category: string;
  month: string;
  limit: ProductMoney;
  actual: ProductMoney;
  riskPercent?: string;
  description?: string;
}>;
export type SavingsGoalForm = Readonly<{
  name: string;
  target: ProductMoney;
  saved: ProductMoney;
  targetDate?: string;
}>;
export type SharedGroupForm = Readonly<{ name: string }>;
export type SharedExpenseForm = Readonly<{
  groupId: string;
  description: string;
  amount: ProductMoney;
  splits: readonly Readonly<{ userId: string; weight: string }>[];
}>;
export type CreditCardForm = Readonly<{
  accountId: string;
  cutoffDay: number;
  dueDay: number;
  catAnnualPercent: string;
  annualInterestPercent: string;
  annualFee: ProductMoney;
  minimumUseFee: ProductMoney;
  minimumUseThreshold: ProductMoney;
  minimumUsePeriod: "monthly" | "annual";
  minimumUseWarningDays?: number;
  creditLimit: ProductMoney;
  creditUsed: ProductMoney;
}>;
export type ChargeCardForm = Readonly<{
  accountId: string;
  cutoffDay: number;
  dueDay: number;
  annualFee: ProductMoney;
  lateFee: ProductMoney;
  fullStatementPaymentRequired: true;
}>;
export type DebitProfileForm = Readonly<{
  accountId: string;
  freeTransferCount: number;
  freeTransferAmount: ProductMoney;
  excessTransferFee: ProductMoney;
}>;
export type YieldAccountForm = Readonly<{
  accountId: string;
  investmentCap: ProductMoney;
  belowCapAnnualPercent: string;
  aboveCapAnnualPercent: string;
  dayBasis: 360 | 365;
}>;
export type AlertRuleForm = Readonly<{
  name: string;
  source: string;
  field: string;
  comparator: "gt" | "gte" | "lt" | "lte" | "eq";
  threshold: string;
  condition?: "payment-due" | "cutoff" | "budget" | "card" | "yield";
  enabled: boolean;
}>;

export type BudgetValue = BudgetForm & Readonly<{ status?: "on-track" | "risk" | "exceeded" }>;
export type GoalValue = SavingsGoalForm;
export type GroupValue = Readonly<{
  name: string;
  members?: readonly Readonly<{ userId: string; role: string }>[];
}>;
export type ExpenseValue = Omit<SharedExpenseForm, "splits"> &
  Readonly<{
    paidByUserId?: string;
    splits: readonly Readonly<{ userId: string; amount?: ProductMoney; weight?: string }>[];
  }>;
export type CardValue = Partial<
  CreditCardForm & ChargeCardForm & DebitProfileForm & YieldAccountForm
> &
  Readonly<{ accountId: string }>;
export type AlertValue = AlertRuleForm;

const alertTemplates = {
  budget: {
    name: "Presupuesto en riesgo",
    source: "budget",
    field: "usagePercent",
    comparator: "gte",
    prompt: "Porcentaje consumido del presupuesto",
    placeholder: "80",
  },
  "payment-due": {
    name: "Pago próximo",
    source: "credit-card",
    field: "daysUntilDue",
    comparator: "lte",
    prompt: "Días de anticipación para el pago",
    placeholder: "3",
  },
  cutoff: {
    name: "Corte próximo",
    source: "credit-card",
    field: "daysUntilCutoff",
    comparator: "lte",
    prompt: "Días de anticipación para el corte",
    placeholder: "2",
  },
  card: {
    name: "Crédito utilizado",
    source: "credit-card",
    field: "creditUsed",
    comparator: "gte",
    prompt: "Monto utilizado que debe activar el aviso",
    placeholder: "10000",
  },
  yield: {
    name: "Rendimiento bajo",
    source: "yield-account",
    field: "annualPercent",
    comparator: "lt",
    prompt: "Rendimiento anual mínimo esperado (%)",
    placeholder: "8",
  },
} as const satisfies Record<
  NonNullable<AlertRuleForm["condition"]>,
  Readonly<{
    name: string;
    source: string;
    field: string;
    comparator: AlertRuleForm["comparator"];
    prompt: string;
    placeholder: string;
  }>
>;

function alertRuleSummary(rule: AlertRuleForm): string {
  switch (rule.condition) {
    case "budget":
      return `Avise cuando un presupuesto alcance ${rule.threshold}%`;
    case "payment-due":
      return `Avise ${rule.threshold} días antes de un pago`;
    case "cutoff":
      return `Avise ${rule.threshold} días antes del corte`;
    case "card":
      return `Avise cuando el crédito utilizado alcance ${rule.threshold}`;
    case "yield":
      return `Avise si el rendimiento anual baja de ${rule.threshold}%`;
    default:
      return "Aviso personalizado";
  }
}

function decimalMoney(value: FormDataEntryValue | null, currency = "MXN"): ProductMoney {
  const exact = String(value ?? "").trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(exact))
    throw new Error("Ingrese un monto decimal válido.");
  const [whole = "0", fraction = ""] = exact.split(".");
  return {
    currency,
    coefficient: `${whole}${fraction}`.replace(/^0+(?=\d)/u, "") || "0",
    scale: fraction.length,
  };
}

function exactDecimal(value: FormDataEntryValue | null, label: string): string {
  const exact = String(value ?? "").trim();
  if (!/^\d+(?:\.\d+)?$/u.test(exact)) throw new Error(`${label} debe ser un decimal exacto.`);
  return exact;
}

function formatMoney(money?: ProductMoney): string {
  if (!money) return "Sin monto";
  const negative = money.coefficient.startsWith("-");
  const digits = negative ? money.coefficient.slice(1) : money.coefficient;
  const padded = digits.padStart(money.scale + 1, "0");
  const point = padded.length - money.scale;
  const value = money.scale === 0 ? padded : `${padded.slice(0, point)}.${padded.slice(point)}`;
  return `${negative ? "−" : ""}$${value} ${money.currency}`;
}

function WorkspaceHeading({
  title,
  description,
  action,
}: Readonly<{ eyebrow: string; title: string; description: string; action?: ReactNode }>) {
  return (
    <header className="ui-product__heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

function StateFrame<T>({
  state,
  children,
  empty,
}: Readonly<{
  state: CollectionState<T>;
  children: (records: readonly ProductRecordView<T>[]) => ReactNode;
  empty: string;
}>) {
  if (state.status === "loading")
    return (
      <div className="ui-product__state" aria-busy="true">
        <span className="ui-product__pulse" />
        <strong>Cargando información segura</strong>
        <p>Consultando la API de su espacio financiero.</p>
      </div>
    );
  if (state.status === "error")
    return (
      <div className="ui-product__state" data-tone="error" role="alert">
        <Lock />
        <strong>
          {state.unauthorized ? "Su sesión necesita atención" : "No se pudo cargar esta sección"}
        </strong>
        <p>{state.message}</p>
        {state.unauthorized ? (
          <button onClick={() => window.dispatchEvent(new Event("2free:open-auth"))} type="button">
            Acceder de nuevo
          </button>
        ) : null}
      </div>
    );
  return (
    <>
      {state.preview ? (
        <p className="ui-product__preview">
          <span>Vista previa</span> Estos ejemplos no son registros de su cuenta.
        </p>
      ) : null}
      {state.records.length ? (
        children(state.records)
      ) : (
        <div className="ui-product__state">
          <CheckCircle />
          <strong>Un espacio listo para comenzar</strong>
          <p>{empty}</p>
        </div>
      )}
    </>
  );
}

function useSubmit() {
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; message: string }>();
  const [pending, setPending] = useState(false);
  async function run(form: HTMLFormElement, action: () => Promise<void>) {
    setPending(true);
    setFeedback(undefined);
    try {
      await action();
      setFeedback({ tone: "success", message: "Registro guardado correctamente." });
      form.reset();
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo guardar. El formulario conserva sus datos.",
      });
    } finally {
      setPending(false);
    }
  }
  return { feedback, pending, run };
}

function FormFeedback({
  value,
}: Readonly<{ value?: { tone: "error" | "success"; message: string } }>) {
  return value ? (
    <p className="ui-product__feedback" data-tone={value.tone} role="status">
      {value.message}
    </p>
  ) : null;
}

function ProgressiveForm({
  children,
  description,
  title,
  triggerLabel,
}: Readonly<{
  children: ReactNode;
  description: string;
  title: string;
  triggerLabel: string;
}>) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [step, setStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(1);
  const [ready, setReady] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const form = contentRef.current?.querySelector("form");
    if (!form) return;
    const labels = Array.from(form.querySelectorAll("label"));
    const count = Math.max(1, Math.ceil(labels.length / 2));
    setTotalSteps(count);
    labels.forEach((label, index) => {
      label.hidden = Math.floor(index / 2) + 1 !== step;
    });
    form.querySelectorAll<HTMLButtonElement>('button[type="submit"]').forEach((button) => {
      button.hidden = step !== count;
    });
    setReady(true);
  }, [open, step]);

  function close() {
    if (closing) return;
    const commit = () => {
      setOpen(false);
      setStep(1);
      setReady(false);
      setClosing(false);
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      commit();
      return;
    }
    setClosing(true);
    window.setTimeout(() => runViewTransition({ commit }), 180);
  }

  useDialogFocus(open, dialogRef, close);

  return (
    <>
      <button
        className="ui-product__flow-launch"
        onClick={() =>
          runViewTransition({
            commit: () => {
              setOpen(true);
              setStep(1);
              setClosing(false);
            },
          })
        }
        type="button"
      >
        <Plus />
        <span>{triggerLabel}</span>
      </button>
      {open ? (
        <div
          className="ui-product__dialog-backdrop"
          data-closing={closing || undefined}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
          role="presentation"
        >
          <section
            aria-labelledby={titleId}
            aria-describedby={`${titleId}-description`}
            aria-modal="true"
            className="ui-product__flow"
            ref={dialogRef}
            role="dialog"
            tabIndex={-1}
          >
            <header>
              <div>
                <p className="ui-product__eyebrow">
                  Paso {step} de {totalSteps}
                </p>
                <h2 id={titleId}>{title}</h2>
              </div>
              <button
                className="ui-product__flow-close"
                data-dialog-initial-focus
                onClick={close}
                type="button"
              >
                Cerrar
              </button>
            </header>
            <p className="ui-product__flow-question" id={`${titleId}-description`}>
              {description}
            </p>
            <div className="ui-product__flow-content" data-ready={ready} ref={contentRef}>
              {children}
            </div>
            <footer className="ui-product__flow-actions">
              {step > 1 ? (
                <button
                  className="ui-product__secondary"
                  onClick={() =>
                    runViewTransition({ commit: () => setStep((current) => current - 1) })
                  }
                  type="button"
                >
                  Volver
                </button>
              ) : null}
              {step < totalSteps ? (
                <button
                  onClick={() =>
                    runViewTransition({ commit: () => setStep((current) => current + 1) })
                  }
                  type="button"
                >
                  Continuar
                </button>
              ) : null}
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}

function DeleteButton({
  id,
  label,
  onDelete,
  preview,
}: Readonly<{
  id: string;
  label?: string;
  onDelete?: (id: string) => Promise<void>;
  preview?: boolean;
}>) {
  if (!onDelete || preview) return null;
  return (
    <button
      aria-label={`Eliminar ${label ?? "este registro"}`}
      className="ui-product__delete"
      onClick={() => void onDelete(id)}
      type="button"
    >
      <Trash />
    </button>
  );
}

function EditButton({
  label,
  onClick,
  preview,
}: Readonly<{ label?: string; onClick?: () => void; preview?: boolean }>) {
  if (!onClick || preview) return null;
  return (
    <button
      aria-label={`Editar ${label ?? "este registro"}`}
      className="ui-product__edit"
      onClick={onClick}
      type="button"
    >
      <EditPencil />
    </button>
  );
}

type EditableField = Readonly<{
  path: string;
  label: string;
  type: "boolean" | "date" | "money" | "number" | "text";
  value: string | boolean;
  currency?: string;
}>;

const fieldLabels: Readonly<Record<string, string>> = {
  accountId: "Cuenta vinculada",
  actual: "Monto actual",
  aboveCapAnnualPercent: "Tasa sobre límite (%)",
  annualFee: "Comisión anual",
  annualInterestPercent: "Interés anual (%)",
  belowCapAnnualPercent: "Tasa bajo límite (%)",
  catAnnualPercent: "CAT anual (%)",
  category: "Categoría",
  comparator: "Comparador",
  condition: "Condición",
  costBasis: "Costo base",
  creditLimit: "Límite de crédito",
  creditUsed: "Crédito utilizado",
  cutoffDay: "Día de corte",
  dayBasis: "Base anual",
  description: "Descripción",
  dueDay: "Día límite",
  enabled: "Regla activa",
  excessTransferFee: "Comisión excedente",
  faceValue: "Valor nominal",
  field: "Campo observado",
  freeTransferAmount: "Monto gratuito",
  freeTransferCount: "Transferencias gratuitas",
  fullStatementPaymentRequired: "Pago total requerido",
  groupId: "Grupo",
  investmentCap: "Límite de inversión",
  lateFee: "Comisión por atraso",
  limit: "Límite",
  maturityDate: "Vencimiento",
  minimumUseFee: "Comisión por uso mínimo",
  minimumUsePeriod: "Periodo de uso mínimo",
  minimumUseThreshold: "Umbral de uso mínimo",
  month: "Mes",
  name: "Nombre",
  purchaseCost: "Costo de compra",
  quantity: "Cantidad",
  riskPercent: "Riesgo desde (%)",
  saved: "Ahorrado",
  securityType: "Tipo de instrumento",
  series: "Serie",
  source: "Fuente",
  symbol: "Símbolo",
  target: "Meta",
  targetDate: "Fecha objetivo",
  threshold: "Umbral",
};

function moneyDecimal(value: ProductMoney): string {
  const digits = value.coefficient.padStart(value.scale + 1, "0");
  return value.scale ? `${digits.slice(0, -value.scale)}.${digits.slice(-value.scale)}` : digits;
}

function editFields(value: Readonly<Record<string, unknown>>): readonly EditableField[] {
  return Object.entries(value).flatMap<EditableField>(([path, entry]) => {
    if (
      [
        "id",
        "status",
        "members",
        "paidByUserId",
        "movements",
        "limitHistory",
        "purchases",
        "splits",
      ].includes(path)
    )
      return [];
    const label = fieldLabels[path] ?? path;
    if (
      entry &&
      typeof entry === "object" &&
      !Array.isArray(entry) &&
      "coefficient" in entry &&
      "scale" in entry
    ) {
      const money = entry as ProductMoney;
      return [
        {
          path,
          label,
          type: "money" as const,
          value: moneyDecimal(money),
          currency: money.currency,
        },
      ];
    }
    if (typeof entry === "boolean")
      return [{ path, label, type: "boolean" as const, value: entry }];
    if (typeof entry === "number")
      return [{ path, label, type: "number" as const, value: String(entry) }];
    if (typeof entry !== "string") return [];
    const date = /Date$/u.test(path);
    return [
      {
        path,
        label,
        type: date ? ("date" as const) : ("text" as const),
        value: date ? entry.slice(0, 10) : entry,
      },
    ];
  });
}

function EditProductDialog<T extends Readonly<Record<string, unknown>>>({
  record,
  onClose,
  onUpdate,
}: Readonly<{
  record?: ProductRecordView<T>;
  onClose: () => void;
  onUpdate: (id: string, value: T) => Promise<void>;
}>) {
  const submit = useSubmit();
  const dialogRef = useRef<HTMLFormElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useDialogFocus(Boolean(record), dialogRef, onClose);

  if (!record) return null;
  const fields = editFields(record.value);
  return (
    <div
      className="ui-product__dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <form
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="ui-product__form ui-product__dialog"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          const next = structuredClone(record.value) as Record<string, unknown>;
          for (const field of fields) {
            if (field.type === "boolean") next[field.path] = data.get(field.path) === "on";
            else if (field.type === "money")
              next[field.path] = decimalMoney(data.get(field.path), field.currency);
            else if (field.type === "number") next[field.path] = Number(data.get(field.path));
            else if (field.type === "date") {
              const date = String(data.get(field.path));
              next[field.path] = record.value[field.path]?.toString().includes("T")
                ? new Date(`${date}T12:00:00Z`).toISOString()
                : date;
            } else next[field.path] = String(data.get(field.path));
          }
          void submit.run(form, async () => {
            await onUpdate(record.id, next as T);
            onClose();
          });
        }}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <p className="ui-product__eyebrow">Editar configuración</p>
        <h2 id={titleId}>Actualizar registro</h2>
        <p id={descriptionId}>Revise los datos antes de guardar los cambios.</p>
        <div className="ui-product__form-grid">
          {fields.map((field, index) => (
            <label key={field.path}>
              {field.label}
              {field.type === "boolean" ? (
                <input defaultChecked={Boolean(field.value)} name={field.path} type="checkbox" />
              ) : (
                <input
                  defaultValue={String(field.value)}
                  data-dialog-initial-focus={index === 0 ? true : undefined}
                  inputMode={field.type === "money" ? "decimal" : undefined}
                  name={field.path}
                  required
                  type={field.type === "date" || field.type === "number" ? field.type : "text"}
                />
              )}
            </label>
          ))}
        </div>
        <FormFeedback value={submit.feedback} />
        <div className="ui-product__button-row">
          <button disabled={submit.pending} type="submit">
            Guardar cambios
          </button>
          <button className="ui-product__secondary" onClick={onClose} type="button">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

export function BudgetSavingsWorkspace({
  budgets,
  goals,
  onCreateBudget,
  onCreateGoal,
  onUpdateBudget,
  onUpdateGoal,
  onDeleteBudget,
  onDeleteGoal,
}: Readonly<{
  budgets: CollectionState<BudgetValue>;
  goals: CollectionState<GoalValue>;
  onCreateBudget: (value: BudgetForm) => Promise<void>;
  onCreateGoal: (value: SavingsGoalForm) => Promise<void>;
  onUpdateBudget?: (id: string, value: BudgetForm) => Promise<void>;
  onUpdateGoal?: (id: string, value: SavingsGoalForm) => Promise<void>;
  onDeleteBudget?: (id: string) => Promise<void>;
  onDeleteGoal?: (id: string) => Promise<void>;
}>) {
  const budgetSubmit = useSubmit();
  const goalSubmit = useSubmit();
  const [budgetEditing, setBudgetEditing] = useState<ProductRecordView<BudgetValue>>();
  const [goalEditing, setGoalEditing] = useState<ProductRecordView<GoalValue>>();
  return (
    <IconoirProvider>
      <div className="ui-product" data-product="budget">
        <WorkspaceHeading
          eyebrow="Plan mensual"
          title="Un presupuesto que respira"
          description="Defina límites por categoría y convierta el ahorro en objetivos visibles, sin perder precisión decimal."
        />
        <section className="ui-product__split">
          <div className="ui-product__panel">
            <div className="ui-product__section-title">
              <div>
                <p className="ui-product__eyebrow">Categorías</p>
                <h2>Presupuesto mensual</h2>
              </div>
              <Wallet />
            </div>
            <StateFrame
              state={budgets}
              empty="Cree una categoría para comenzar a comparar el límite con el gasto real."
            >
              {(records) => (
                <div className="ui-product__stack">
                  {records.map((record) => (
                    <article
                      className="ui-product__budget"
                      data-status={record.value.status ?? "on-track"}
                      key={record.id}
                    >
                      <div>
                        <span>{record.value.month}</span>
                        <h3>{record.value.category}</h3>
                        <p>{record.value.description || "Seguimiento mensual"}</p>
                      </div>
                      <strong>
                        {formatMoney(record.value.actual)}{" "}
                        <small>de {formatMoney(record.value.limit)}</small>
                      </strong>
                      <div className="ui-product__progress">
                        <i
                          style={{
                            inlineSize:
                              record.value.status === "exceeded"
                                ? "100%"
                                : record.value.status === "risk"
                                  ? "78%"
                                  : "52%",
                          }}
                        />
                      </div>
                      <DeleteButton
                        id={record.id}
                        label={record.value.category}
                        onDelete={onDeleteBudget}
                        preview={budgets.status === "ready" && budgets.preview}
                      />
                      <EditButton
                        label={record.value.category}
                        onClick={() => setBudgetEditing(record)}
                        preview={budgets.status === "ready" && budgets.preview}
                      />
                    </article>
                  ))}
                </div>
              )}
            </StateFrame>
          </div>
          <ProgressiveForm
            description="Defina la categoría, el periodo y el límite que desea observar."
            title="Crear un presupuesto"
            triggerLabel="Crear presupuesto"
          >
            <form
              className="ui-product__form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const data = new FormData(form);
                void budgetSubmit.run(form, () =>
                  onCreateBudget({
                    category: String(data.get("category")),
                    month: String(data.get("month")),
                    limit: decimalMoney(data.get("limit")),
                    actual: decimalMoney(data.get("actual")),
                    riskPercent: String(data.get("riskPercent") || "80"),
                    description: String(data.get("description") || ""),
                  }),
                );
              }}
            >
              <p className="ui-product__eyebrow">Nueva categoría</p>
              <h2>Marcar un límite</h2>
              <div className="ui-product__form-grid">
                <label>
                  Categoría
                  <input name="category" required />
                </label>
                <label>
                  Mes
                  <input name="month" required type="month" />
                </label>
                <label>
                  Límite exacto
                  <input inputMode="decimal" name="limit" placeholder="12000.00" required />
                </label>
                <label>
                  Gasto actual
                  <input defaultValue="0.00" inputMode="decimal" name="actual" required />
                </label>
                <label>
                  Riesgo desde (%)
                  <input defaultValue="80" inputMode="decimal" name="riskPercent" required />
                </label>
                <label>
                  Nota
                  <input name="description" />
                </label>
              </div>
              <FormFeedback value={budgetSubmit.feedback} />
              <button disabled={budgetSubmit.pending} type="submit">
                <Plus /> Crear presupuesto
              </button>
            </form>
          </ProgressiveForm>
        </section>
        <section className="ui-product__split ui-product__split--reverse">
          <ProgressiveForm
            description="Indique cuánto desea reunir, el avance actual y una fecha si existe."
            title="Crear una meta de ahorro"
            triggerLabel="Crear objetivo"
          >
            <form
              className="ui-product__form ui-product__form--sage"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const data = new FormData(form);
                void goalSubmit.run(form, () =>
                  onCreateGoal({
                    name: String(data.get("name")),
                    target: decimalMoney(data.get("target")),
                    saved: decimalMoney(data.get("saved")),
                    targetDate: String(data.get("targetDate") || "") || undefined,
                  }),
                );
              }}
            >
              <p className="ui-product__eyebrow">Nuevo objetivo</p>
              <h2>Dar nombre al ahorro</h2>
              <div className="ui-product__form-grid">
                <label>
                  Objetivo
                  <input name="name" required />
                </label>
                <label>
                  Meta exacta
                  <input inputMode="decimal" name="target" required />
                </label>
                <label>
                  Ahorrado
                  <input defaultValue="0.00" inputMode="decimal" name="saved" required />
                </label>
                <label>
                  Fecha objetivo
                  <input name="targetDate" type="date" />
                </label>
              </div>
              <FormFeedback value={goalSubmit.feedback} />
              <button disabled={goalSubmit.pending} type="submit">
                <Plus /> Crear objetivo
              </button>
            </form>
          </ProgressiveForm>
          <div className="ui-product__panel">
            <div className="ui-product__section-title">
              <div>
                <p className="ui-product__eyebrow">Horizonte</p>
                <h2>Metas de ahorro</h2>
              </div>
              <GraphUp />
            </div>
            <StateFrame state={goals} empty="Defina una meta y registre cuánto ha avanzado.">
              {(records) => (
                <div className="ui-product__cards">
                  {records.map((record) => (
                    <article key={record.id}>
                      <span>{record.value.targetDate || "Sin fecha límite"}</span>
                      <h3>{record.value.name}</h3>
                      <strong>{formatMoney(record.value.saved)}</strong>
                      <small>Meta {formatMoney(record.value.target)}</small>
                      <DeleteButton
                        id={record.id}
                        label={record.value.name}
                        onDelete={onDeleteGoal}
                        preview={goals.status === "ready" && goals.preview}
                      />
                      <EditButton
                        label={record.value.name}
                        onClick={() => setGoalEditing(record)}
                        preview={goals.status === "ready" && goals.preview}
                      />
                    </article>
                  ))}
                </div>
              )}
            </StateFrame>
          </div>
        </section>
        {onUpdateBudget ? (
          <EditProductDialog
            record={
              budgetEditing as ProductRecordView<BudgetValue & Record<string, unknown>> | undefined
            }
            onClose={() => setBudgetEditing(undefined)}
            onUpdate={onUpdateBudget as never}
          />
        ) : null}
        {onUpdateGoal ? (
          <EditProductDialog
            record={
              goalEditing as ProductRecordView<GoalValue & Record<string, unknown>> | undefined
            }
            onClose={() => setGoalEditing(undefined)}
            onUpdate={onUpdateGoal as never}
          />
        ) : null}
      </div>
    </IconoirProvider>
  );
}

export function SharedFinancesWorkspace({
  groups,
  expenses,
  onCreateGroup,
  onCreateExpense,
  onAddMember,
  onUpdateGroup,
  onUpdateExpense,
  onDeleteGroup,
  onDeleteExpense,
}: Readonly<{
  groups: CollectionState<GroupValue>;
  expenses: CollectionState<ExpenseValue>;
  onCreateGroup: (value: SharedGroupForm) => Promise<void>;
  onCreateExpense: (value: SharedExpenseForm) => Promise<void>;
  onAddMember: (groupId: string, userId: string) => Promise<void>;
  onUpdateGroup?: (id: string, value: SharedGroupForm) => Promise<void>;
  onUpdateExpense?: (id: string, value: SharedExpenseForm) => Promise<void>;
  onDeleteGroup?: (id: string) => Promise<void>;
  onDeleteExpense?: (id: string) => Promise<void>;
}>) {
  const groupSubmit = useSubmit();
  const expenseSubmit = useSubmit();
  const memberSubmit = useSubmit();
  const [groupEditing, setGroupEditing] = useState<ProductRecordView<GroupValue>>();
  const [expenseEditing, setExpenseEditing] = useState<ProductRecordView<ExpenseValue>>();
  return (
    <IconoirProvider>
      <div className="ui-product" data-product="shared">
        <WorkspaceHeading
          eyebrow="Finanzas compartidas"
          title="Cuentas claras entre personas"
          description="Organice grupos, integrantes y gastos con divisiones exactas calculadas por el dominio."
        />
        <section className="ui-product__split">
          <div className="ui-product__panel">
            <div className="ui-product__section-title">
              <div>
                <p className="ui-product__eyebrow">Grupos</p>
                <h2>Espacios compartidos</h2>
              </div>
              <Community />
            </div>
            <StateFrame state={groups} empty="Cree un grupo para registrar integrantes y gastos.">
              {(records) => (
                <div className="ui-product__cards">
                  {records.map((record) => (
                    <article key={record.id}>
                      <span>{record.value.members?.length ?? 1} integrantes</span>
                      <h3>{record.value.name}</h3>
                      <p>
                        {record.value.members?.map((member) => member.userId).join(" · ") ||
                          "Solo usted"}
                      </p>
                      <DeleteButton
                        id={record.id}
                        label={record.value.name}
                        onDelete={onDeleteGroup}
                        preview={groups.status === "ready" && groups.preview}
                      />
                      <EditButton
                        label={record.value.name}
                        onClick={() => setGroupEditing(record)}
                        preview={groups.status === "ready" && groups.preview}
                      />
                    </article>
                  ))}
                </div>
              )}
            </StateFrame>
          </div>
          <div className="ui-product__form-column">
            <ProgressiveForm
              description="Cree el espacio que reunirá integrantes y gastos compartidos."
              title="Crear un grupo"
              triggerLabel="Crear grupo"
            >
              <form
                className="ui-product__form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const data = new FormData(form);
                  void groupSubmit.run(form, () =>
                    onCreateGroup({ name: String(data.get("name")) }),
                  );
                }}
              >
                <p className="ui-product__eyebrow">Nuevo grupo</p>
                <h2>Compartir un espacio</h2>
                <label>
                  Nombre del grupo
                  <input name="name" required />
                </label>
                <FormFeedback value={groupSubmit.feedback} />
                <button disabled={groupSubmit.pending} type="submit">
                  <Plus /> Crear grupo
                </button>
              </form>
            </ProgressiveForm>
            <ProgressiveForm
              description="Seleccione un grupo e indique el identificador de la persona que participará."
              title="Agregar un integrante"
              triggerLabel="Agregar integrante"
            >
              <form
                className="ui-product__form ui-product__form--compact"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const data = new FormData(form);
                  void memberSubmit.run(form, () =>
                    onAddMember(String(data.get("groupId")), String(data.get("userId"))),
                  );
                }}
              >
                <h3>Agregar integrante</h3>
                <label>
                  Grupo
                  <select name="groupId" required>
                    {groups.status === "ready"
                      ? groups.records
                          .filter(() => !groups.preview)
                          .map((record) => (
                            <option key={record.id} value={record.id}>
                              {record.value.name}
                            </option>
                          ))
                      : null}
                  </select>
                </label>
                <label>
                  Identificador de usuario
                  <input name="userId" required />
                </label>
                <FormFeedback value={memberSubmit.feedback} />
                <button disabled={memberSubmit.pending} type="submit">
                  Agregar
                </button>
              </form>
            </ProgressiveForm>
          </div>
        </section>
        <section className="ui-product__split ui-product__split--reverse">
          <ProgressiveForm
            description="Seleccione el grupo, registre el monto exacto y defina quiénes participan."
            title="Registrar un gasto compartido"
            triggerLabel="Registrar gasto"
          >
            <form
              className="ui-product__form ui-product__form--peach"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const data = new FormData(form);
                const users = String(data.get("users"))
                  .split(",")
                  .map((userId) => userId.trim())
                  .filter(Boolean);
                void expenseSubmit.run(form, () =>
                  onCreateExpense({
                    groupId: String(data.get("groupId")),
                    description: String(data.get("description")),
                    amount: decimalMoney(data.get("amount")),
                    splits: users.map((userId) => ({ userId, weight: "1" })),
                  }),
                );
              }}
            >
              <p className="ui-product__eyebrow">Nuevo gasto</p>
              <h2>Dividir con exactitud</h2>
              <label>
                Grupo
                <select name="groupId" required>
                  {groups.status === "ready"
                    ? groups.records
                        .filter(() => !groups.preview)
                        .map((record) => (
                          <option key={record.id} value={record.id}>
                            {record.value.name}
                          </option>
                        ))
                    : null}
                </select>
              </label>
              <label>
                Descripción
                <input name="description" required />
              </label>
              <label>
                Monto exacto
                <input inputMode="decimal" name="amount" required />
              </label>
              <label>
                Usuarios, separados por coma
                <input name="users" placeholder="usuario-a, usuario-b" required />
              </label>
              <FormFeedback value={expenseSubmit.feedback} />
              <button disabled={expenseSubmit.pending} type="submit">
                <Plus /> Registrar gasto
              </button>
            </form>
          </ProgressiveForm>
          <div className="ui-product__panel">
            <div className="ui-product__section-title">
              <div>
                <p className="ui-product__eyebrow">Divisiones</p>
                <h2>Gastos recientes</h2>
              </div>
              <Wallet />
            </div>
            <StateFrame
              state={expenses}
              empty="Los gastos divididos aparecerán aquí con el importe exacto por persona."
            >
              {(records) => (
                <div className="ui-product__stack">
                  {records.map((record) => (
                    <article className="ui-product__expense" key={record.id}>
                      <div>
                        <span>{record.value.groupId}</span>
                        <h3>{record.value.description}</h3>
                      </div>
                      <strong>{formatMoney(record.value.amount)}</strong>
                      <ul>
                        {record.value.splits.map((split) => (
                          <li key={split.userId}>
                            <span>{split.userId}</span>
                            <b>
                              {split.amount ? formatMoney(split.amount) : `Peso ${split.weight}`}
                            </b>
                          </li>
                        ))}
                      </ul>
                      <DeleteButton
                        id={record.id}
                        label={record.value.description}
                        onDelete={onDeleteExpense}
                        preview={expenses.status === "ready" && expenses.preview}
                      />
                      <EditButton
                        label={record.value.description}
                        onClick={() => setExpenseEditing(record)}
                        preview={expenses.status === "ready" && expenses.preview}
                      />
                    </article>
                  ))}
                </div>
              )}
            </StateFrame>
          </div>
        </section>
        {onUpdateGroup ? (
          <EditProductDialog
            record={groupEditing as never}
            onClose={() => setGroupEditing(undefined)}
            onUpdate={onUpdateGroup as never}
          />
        ) : null}
        {onUpdateExpense ? (
          <EditProductDialog
            record={expenseEditing as never}
            onClose={() => setExpenseEditing(undefined)}
            onUpdate={onUpdateExpense as never}
          />
        ) : null}
      </div>
    </IconoirProvider>
  );
}

function CardForm({
  kind,
  onCreate,
}: Readonly<{
  kind: "credit" | "charge" | "debit" | "yield";
  onCreate: (
    value: CreditCardForm | ChargeCardForm | DebitProfileForm | YieldAccountForm,
  ) => Promise<void>;
}>) {
  const submit = useSubmit();
  const labels = {
    credit: "Crédito revolvente",
    charge: "Tarjeta de cargo",
    debit: "Condiciones de débito",
    yield: "Cuenta con rendimiento",
  };
  return (
    <form
      className="ui-product__form ui-product__form--compact"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const accountId = String(data.get("accountId"));
        let value: CreditCardForm | ChargeCardForm | DebitProfileForm | YieldAccountForm;
        if (kind === "credit")
          value = {
            accountId,
            cutoffDay: Number(data.get("cutoffDay")),
            dueDay: Number(data.get("dueDay")),
            catAnnualPercent: exactDecimal(data.get("cat"), "CAT"),
            annualInterestPercent: exactDecimal(data.get("interest"), "Interés"),
            annualFee: decimalMoney(data.get("annualFee")),
            minimumUseFee: decimalMoney(data.get("minimumUseFee")),
            minimumUseThreshold: decimalMoney(data.get("minimumUseThreshold")),
            minimumUsePeriod: String(data.get("minimumUsePeriod")) as "monthly" | "annual",
            creditLimit: decimalMoney(data.get("creditLimit")),
            creditUsed: decimalMoney(data.get("creditUsed")),
          };
        else if (kind === "charge")
          value = {
            accountId,
            cutoffDay: Number(data.get("cutoffDay")),
            dueDay: Number(data.get("dueDay")),
            annualFee: decimalMoney(data.get("annualFee")),
            lateFee: decimalMoney(data.get("lateFee")),
            fullStatementPaymentRequired: true,
          };
        else if (kind === "debit")
          value = {
            accountId,
            freeTransferCount: Number(data.get("freeTransferCount")),
            freeTransferAmount: decimalMoney(data.get("freeTransferAmount")),
            excessTransferFee: decimalMoney(data.get("excessTransferFee")),
          };
        else
          value = {
            accountId,
            investmentCap: decimalMoney(data.get("investmentCap")),
            belowCapAnnualPercent: exactDecimal(data.get("belowRate"), "Tasa bajo límite"),
            aboveCapAnnualPercent: exactDecimal(data.get("aboveRate"), "Tasa sobre límite"),
            dayBasis: Number(data.get("dayBasis")) as 360 | 365,
          };
        void submit.run(form, () => onCreate(value));
      }}
    >
      <h3>{labels[kind]}</h3>
      <p>Sin números de tarjeta. Solo se vincula el identificador interno de la cuenta.</p>
      <label>
        Identificador de cuenta
        <input name="accountId" required />
      </label>
      {kind === "credit" || kind === "charge" ? (
        <div className="ui-product__form-grid">
          <label>
            Día de corte
            <input max="31" min="1" name="cutoffDay" required type="number" />
          </label>
          <label>
            Día límite
            <input max="31" min="1" name="dueDay" required type="number" />
          </label>
          <label>
            Comisión anual
            <input inputMode="decimal" name="annualFee" required />
          </label>
          {kind === "credit" ? (
            <>
              <label>
                CAT anual (%)
                <input inputMode="decimal" name="cat" required />
              </label>
              <label>
                Interés anual (%)
                <input inputMode="decimal" name="interest" required />
              </label>
              <label>
                Límite de crédito
                <input inputMode="decimal" name="creditLimit" required />
              </label>
              <label>
                Crédito utilizado
                <input defaultValue="0.00" inputMode="decimal" name="creditUsed" required />
              </label>
              <label>
                Comisión uso mínimo
                <input defaultValue="0.00" inputMode="decimal" name="minimumUseFee" required />
              </label>
              <label>
                Umbral uso mínimo
                <input
                  defaultValue="0.00"
                  inputMode="decimal"
                  name="minimumUseThreshold"
                  required
                />
              </label>
              <label>
                Periodo
                <select name="minimumUsePeriod">
                  <option value="monthly">Mensual</option>
                  <option value="annual">Anual</option>
                </select>
              </label>
            </>
          ) : (
            <label>
              Comisión por atraso
              <input inputMode="decimal" name="lateFee" required />
            </label>
          )}
        </div>
      ) : null}
      {kind === "debit" ? (
        <div className="ui-product__form-grid">
          <label>
            Transferencias gratuitas
            <input min="0" name="freeTransferCount" required type="number" />
          </label>
          <label>
            Monto gratuito
            <input inputMode="decimal" name="freeTransferAmount" required />
          </label>
          <label>
            Comisión excedente
            <input inputMode="decimal" name="excessTransferFee" required />
          </label>
        </div>
      ) : null}
      {kind === "yield" ? (
        <div className="ui-product__form-grid">
          <label>
            Límite de inversión
            <input inputMode="decimal" name="investmentCap" required />
          </label>
          <label>
            Tasa bajo límite (%)
            <input inputMode="decimal" name="belowRate" required />
          </label>
          <label>
            Tasa sobre límite (%)
            <input inputMode="decimal" name="aboveRate" required />
          </label>
          <label>
            Base anual
            <select name="dayBasis">
              <option value="360">360 días</option>
              <option value="365">365 días</option>
            </select>
          </label>
        </div>
      ) : null}
      <FormFeedback value={submit.feedback} />
      <button disabled={submit.pending} type="submit">
        <Plus /> Guardar condiciones
      </button>
    </form>
  );
}

export function CardsWorkspace({
  creditCards,
  chargeCards,
  debitProfiles,
  yieldAccounts,
  onCreateCredit,
  onCreateCharge,
  onCreateDebit,
  onCreateYield,
  onUpdate,
  onDelete,
}: Readonly<{
  creditCards: CollectionState<CardValue>;
  chargeCards: CollectionState<CardValue>;
  debitProfiles: CollectionState<CardValue>;
  yieldAccounts: CollectionState<CardValue>;
  onCreateCredit: (value: CreditCardForm) => Promise<void>;
  onCreateCharge: (value: ChargeCardForm) => Promise<void>;
  onCreateDebit: (value: DebitProfileForm) => Promise<void>;
  onCreateYield: (value: YieldAccountForm) => Promise<void>;
  onUpdate?: (
    kind: "credit-card" | "charge-card" | "debit-profile" | "yield-account",
    id: string,
    value: CardValue,
  ) => Promise<void>;
  onDelete?: (
    kind: "credit-card" | "charge-card" | "debit-profile" | "yield-account",
    id: string,
  ) => Promise<void>;
}>) {
  const groups = [
    ["Crédito revolvente", creditCards, "credit-card"],
    ["Cargo total", chargeCards, "charge-card"],
    ["Débito", debitProfiles, "debit-profile"],
    ["Rendimiento", yieldAccounts, "yield-account"],
  ] as const;
  const [editing, setEditing] = useState<{
    kind: (typeof groups)[number][2];
    record: ProductRecordView<CardValue>;
  }>();
  return (
    <IconoirProvider>
      <div className="ui-product" data-product="cards">
        <WorkspaceHeading
          eyebrow="Productos y condiciones"
          title="Cada tarjeta conserva sus reglas"
          description="Crédito revolvente, cargo, débito y rendimiento se presentan como productos distintos. Nunca solicitamos ni mostramos el número de una tarjeta."
        />
        <section className="ui-product__panel">
          <div className="ui-product__section-title">
            <div>
              <p className="ui-product__eyebrow">Panorama</p>
              <h2>Productos vinculados</h2>
            </div>
            <CreditCard />
          </div>
          <div className="ui-product__product-grid">
            {groups.map(([label, state, kind]) => (
              <div className="ui-product__product-group" key={kind}>
                <h3>{label}</h3>
                <StateFrame
                  state={state}
                  empty={`Aún no hay productos de ${label.toLocaleLowerCase("es")}.`}
                >
                  {(records) => (
                    <div className="ui-product__cards">
                      {records.map((record) => (
                        <article key={record.id}>
                          <span>Cuenta vinculada</span>
                          <h3>{record.value.accountId}</h3>
                          {record.value.cutoffDay ? (
                            <p>
                              Corte {record.value.cutoffDay} · Pago {record.value.dueDay}
                            </p>
                          ) : null}
                          {record.value.creditLimit ? (
                            <strong>
                              {formatMoney(record.value.creditUsed)} /{" "}
                              {formatMoney(record.value.creditLimit)}
                            </strong>
                          ) : null}
                          {record.value.investmentCap ? (
                            <strong>Hasta {formatMoney(record.value.investmentCap)}</strong>
                          ) : null}
                          <DeleteButton
                            id={record.id}
                            label={String(record.value.accountId ?? "configuración")}
                            onDelete={(id) => onDelete?.(kind, id) ?? Promise.resolve()}
                            preview={state.status === "ready" && state.preview}
                          />
                          <EditButton
                            label={String(record.value.accountId ?? "configuración")}
                            onClick={() => setEditing({ kind, record })}
                            preview={state.status === "ready" && state.preview}
                          />
                        </article>
                      ))}
                    </div>
                  )}
                </StateFrame>
              </div>
            ))}
          </div>
        </section>
        <section className="ui-product__flow-grid">
          <ProgressiveForm
            description="Vincule una cuenta y registre fechas, costos y límite sin ingresar números de tarjeta."
            title="Agregar crédito revolvente"
            triggerLabel="Agregar crédito"
          >
            <CardForm kind="credit" onCreate={(value) => onCreateCredit(value as CreditCardForm)} />
          </ProgressiveForm>
          <ProgressiveForm
            description="Registre las fechas y comisiones de una tarjeta que exige el pago total del estado de cuenta."
            title="Agregar tarjeta de cargo"
            triggerLabel="Agregar tarjeta de cargo"
          >
            <CardForm kind="charge" onCreate={(value) => onCreateCharge(value as ChargeCardForm)} />
          </ProgressiveForm>
          <ProgressiveForm
            description="Documente las condiciones de transferencias y comisiones de una cuenta de débito."
            title="Configurar débito"
            triggerLabel="Configurar débito"
          >
            <CardForm kind="debit" onCreate={(value) => onCreateDebit(value as DebitProfileForm)} />
          </ProgressiveForm>
          <ProgressiveForm
            description="Indique el límite de inversión, las tasas y la base anual de cálculo."
            title="Configurar rendimiento"
            triggerLabel="Configurar rendimiento"
          >
            <CardForm kind="yield" onCreate={(value) => onCreateYield(value as YieldAccountForm)} />
          </ProgressiveForm>
        </section>
        {editing && onUpdate ? (
          <EditProductDialog
            record={editing.record as never}
            onClose={() => setEditing(undefined)}
            onUpdate={(id, value) => onUpdate(editing.kind, id, value as CardValue)}
          />
        ) : null}
      </div>
    </IconoirProvider>
  );
}

export function AlertsWorkspace({
  rules,
  onCreateRule,
  onDeleteRule,
  onEvaluate,
  notificationPermission,
  onRequestPermission,
}: Readonly<{
  rules: CollectionState<AlertValue>;
  onCreateRule: (value: AlertRuleForm) => Promise<void>;
  onUpdateRule?: (id: string, value: AlertRuleForm) => Promise<void>;
  onDeleteRule?: (id: string) => Promise<void>;
  onEvaluate: () => Promise<string>;
  notificationPermission: "default" | "denied" | "granted" | "unsupported";
  onRequestPermission: () => Promise<void>;
}>) {
  const submit = useSubmit();
  const [evaluation, setEvaluation] = useState("");
  const [newCondition, setNewCondition] =
    useState<NonNullable<AlertRuleForm["condition"]>>("budget");
  const selectedTemplate = alertTemplates[newCondition];
  const automatic: readonly AlertRuleForm[] = [
    {
      name: "Presupuesto en riesgo",
      source: "budget",
      field: "usagePercent",
      comparator: "gte",
      threshold: "80",
      condition: "budget",
      enabled: true,
    },
    {
      name: "Pago próximo",
      source: "credit-card",
      field: "daysUntilDue",
      comparator: "lte",
      threshold: "3",
      condition: "payment-due",
      enabled: true,
    },
  ];
  return (
    <IconoirProvider>
      <div className="ui-product" data-product="alerts">
        <WorkspaceHeading
          eyebrow="Señales, no ruido"
          title="Alertas que explican su origen"
          description="Elija qué situación quiere vigilar y cuándo desea recibir el aviso. 2 Free se encarga de traducirlo a una regla segura."
          action={
            <button
              className="ui-product__permission"
              onClick={() => void onRequestPermission()}
              type="button"
            >
              <Bell />{" "}
              {notificationPermission === "granted"
                ? "Notificaciones activas"
                : notificationPermission === "unsupported"
                  ? "No disponibles"
                  : "Permitir notificaciones"}
            </button>
          }
        />
        <section className="ui-product__panel">
          <div className="ui-product__section-title">
            <div>
              <p className="ui-product__eyebrow">Automáticas</p>
              <h2>Reglas recomendadas</h2>
            </div>
            <Bell />
          </div>
          <div className="ui-product__rule-grid">
            {automatic.map((rule) => (
              <article key={rule.name}>
                <span>Activa por diseño</span>
                <h3>{rule.name}</h3>
                <p>{alertRuleSummary(rule)}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="ui-product__split">
          <div className="ui-product__panel">
            <div className="ui-product__section-title">
              <div>
                <p className="ui-product__eyebrow">Personalizadas</p>
                <h2>Sus reglas</h2>
              </div>
              <Settings />
            </div>
            <StateFrame state={rules} empty="Cree una regla para seguir una condición específica.">
              {(records) => (
                <div className="ui-product__stack">
                  {records.map((record) => (
                    <article className="ui-product__rule" key={record.id}>
                      <div>
                        <span>{record.value.enabled ? "Activa" : "Pausada"}</span>
                        <h3>{record.value.name}</h3>
                      </div>
                      <p>{alertRuleSummary(record.value)}</p>
                      <DeleteButton
                        id={record.id}
                        label={record.value.name}
                        onDelete={onDeleteRule}
                        preview={rules.status === "ready" && rules.preview}
                      />
                    </article>
                  ))}
                </div>
              )}
            </StateFrame>
            <button
              className="ui-product__secondary"
              onClick={() =>
                void onEvaluate()
                  .then(setEvaluation)
                  .catch((error: unknown) =>
                    setEvaluation(error instanceof Error ? error.message : "No se pudo evaluar."),
                  )
              }
              type="button"
            >
              Evaluar reglas ahora
            </button>
            {evaluation ? (
              <p className="ui-product__feedback" role="status">
                {evaluation}
              </p>
            ) : null}
          </div>
          <ProgressiveForm
            description="Primero elija una situación financiera; después indique el momento del aviso."
            title="Crear un aviso"
            triggerLabel="Crear aviso"
          >
            <form
              className="ui-product__form ui-product__form--peach"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const data = new FormData(form);
                const condition = String(data.get("condition")) as NonNullable<
                  AlertRuleForm["condition"]
                >;
                const template = alertTemplates[condition];
                void submit.run(form, () =>
                  onCreateRule({
                    name: String(data.get("name") || template.name),
                    source: template.source,
                    field: template.field,
                    comparator: template.comparator,
                    threshold: String(data.get("threshold")),
                    condition,
                    enabled: true,
                  }),
                );
              }}
            >
              <p className="ui-product__eyebrow">Nuevo aviso</p>
              <h2>¿Qué quiere vigilar?</h2>
              <label>
                Situación
                <select
                  name="condition"
                  onChange={(event) =>
                    setNewCondition(event.target.value as NonNullable<AlertRuleForm["condition"]>)
                  }
                  value={newCondition}
                >
                  <option value="budget">Un presupuesto se está agotando</option>
                  <option value="payment-due">Se acerca el pago de una tarjeta</option>
                  <option value="cutoff">Se acerca la fecha de corte</option>
                  <option value="card">El crédito utilizado es alto</option>
                  <option value="yield">Bajó el rendimiento de una cuenta</option>
                </select>
              </label>
              <label>
                {selectedTemplate.prompt}
                <input
                  inputMode="decimal"
                  name="threshold"
                  pattern="\d+(\.\d+)?"
                  placeholder={selectedTemplate.placeholder}
                  required
                />
              </label>
              <label>
                Nombre del aviso (opcional)
                <input name="name" placeholder={selectedTemplate.name} />
              </label>
              <FormFeedback value={submit.feedback} />
              <button disabled={submit.pending} type="submit">
                <Plus /> Crear aviso
              </button>
            </form>
          </ProgressiveForm>
        </section>
      </div>
    </IconoirProvider>
  );
}

type OnboardingModeId = "local" | "cloud" | "self-host";

export function OnboardingModes({
  onSelect,
  selected,
  web = false,
}: Readonly<{
  onSelect?: (mode: OnboardingModeId) => void;
  selected?: OnboardingModeId;
  web?: boolean;
}>) {
  const modes = [
    {
      id: "local",
      title: "Local",
      text: web
        ? "No disponible en la web. Use la aplicación instalada para datos locales."
        : "SQLCipher en este dispositivo, sin réplica externa.",
    },
    {
      id: "cloud",
      title: "Nube 2 Free",
      text: web
        ? "Sesión protegida y acceso desde varios dispositivos."
        : "SQLCipher local con una réplica opcional en la nube administrada.",
    },
    {
      id: "self-host",
      title: "Servidor propio",
      text: web
        ? "La misma API alojada bajo su control."
        : "SQLCipher local con una réplica opcional en su propia API.",
    },
  ] as const;
  return (
    <section
      className="ui-product__modes"
      aria-label="Modos de uso"
      role={onSelect ? "radiogroup" : undefined}
    >
      {modes.map((mode) => {
        const disabled = web && mode.id === "local";
        const content = (
          <>
            <Database />
            <span>
              {disabled ? "No disponible" : selected === mode.id ? "Seleccionado" : "Modo"}
            </span>
            <h3>{mode.title}</h3>
            <p>{mode.text}</p>
          </>
        );
        return onSelect ? (
          <button
            aria-checked={selected === mode.id}
            className="ui-product__mode-card"
            data-selected={selected === mode.id}
            disabled={disabled}
            key={mode.id}
            onClick={() => onSelect(mode.id)}
            role="radio"
            type="button"
          >
            {content}
          </button>
        ) : (
          <article data-disabled={disabled} key={mode.id}>
            {content}
          </article>
        );
      })}
    </section>
  );
}

export function SettingsWorkspace({
  onExport,
  onImport,
  web = true,
}: Readonly<{
  onExport: () => Promise<string>;
  onImport: (file: File) => Promise<string>;
  web?: boolean;
}>) {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  async function run(action: () => Promise<string>) {
    try {
      setStatus(await action());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo completar la operación.");
    }
  }
  return (
    <IconoirProvider>
      <div className="ui-product" data-product="settings">
        <WorkspaceHeading
          eyebrow="Control y portabilidad"
          title="Un espacio bajo sus reglas"
          description={
            web
              ? "La web siempre requiere una API cloud o autohospedada. Ningún dato financiero se guarda en localStorage."
              : "La aplicación instalada siempre usa SQLCipher local; la nube administrada o un servidor propio pueden actuar como réplica."
          }
        />
        <OnboardingModes web={web} />
        <section className="ui-product__settings-grid">
          <article>
            <ShieldCheck />
            <p className="ui-product__eyebrow">Seguridad</p>
            <h2>Sesión y cifrado</h2>
            <p>
              {web
                ? "La sesión Better Auth limita el acceso por propietario. Los campos financieros sensibles se cifran antes de persistir."
                : "El modo local usa SQLCipher y una clave del almacén seguro del sistema. Los modos API usan una sesión Better Auth."}
            </p>
          </article>
          <article>
            <Database />
            <p className="ui-product__eyebrow">Datos</p>
            <h2>Exportar o importar</h2>
            <p>Descargue un sobre portable v2 o restaure uno validado por la fuente activa.</p>
            <div className="ui-product__button-row">
              <button onClick={() => void run(onExport)} type="button">
                Exportar
              </button>
              <button onClick={() => input.current?.click()} type="button">
                Importar
              </button>
            </div>
            <input
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void run(() => onImport(file));
                event.target.value = "";
              }}
              ref={input}
              type="file"
            />
          </article>
          <article>
            <Lock />
            <p className="ui-product__eyebrow">{web ? "Modo web" : "Modo instalado"}</p>
            <h2>{web ? "Sin persistencia financiera local" : "Configuración protegida"}</h2>
            <p>
              {web
                ? "Solo la preferencia visual puede permanecer en el navegador. Productos, montos y respaldos viajan mediante la API autenticada."
                : "La elección de modo y la URL se guardan fuera de la base de datos mediante el almacén seguro nativo."}
            </p>
          </article>
        </section>
        {status ? (
          <p className="ui-product__feedback" role="status">
            {status}
          </p>
        ) : null}
      </div>
    </IconoirProvider>
  );
}
