"use client";

import {
  Activity,
  CheckCircle,
  CloudDownload,
  CloudUpload,
  CreditCard,
  Database,
  Filter,
  Plus,
  Search,
  ShieldCheck,
  Wallet,
  Xmark,
} from "iconoir-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";

import { IconoirProvider } from "./icon-control";

export type AccountOption = Readonly<{ id: string; label: string; currency: string }>;
export type AccountOverviewItem = Readonly<{
  id: string;
  label: string;
  detail: string;
  kind: "available" | "invested" | "credit";
  balance: string;
  accent: string;
  currency: string;
  statementBalance?: string;
  transactionCount: number;
  type: "debit" | "yield" | "revolving-credit" | "charge-card";
}>;
export type AccountsOverviewData = Readonly<{
  total: string;
  available: string;
  invested: string;
  credit: string;
  accounts: readonly AccountOverviewItem[];
}>;

export type TransactionListItem = Readonly<{
  id: string;
  label: string;
  account: string;
  category: string;
  date: string;
  amount: string;
  amountValue: string;
  accountId: string;
  dateIso: string;
  draft: TransactionDraft;
  type: "income" | "expense";
}>;
export type TransactionsOverviewData = Readonly<{
  income: string;
  expenses: string;
  balance: string;
  transactions: readonly TransactionListItem[];
}>;

export type TransactionDraft = Readonly<{
  accountId: string;
  type: "income" | "expense";
  amount: string;
  date: string;
  category: string;
  description: string;
}>;
export type TransactionSubmitResult = Readonly<{
  status: "success" | "error";
  message: string;
}>;

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function decimalParts(value: string): readonly [bigint, number] {
  const [whole = "0", fraction = ""] = value.split(".");
  return [BigInt(`${whole}${fraction}`), fraction.length];
}

function isDecimal(value: string): boolean {
  return /^(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value);
}

function compareDecimals(left: string, right: string): number {
  const [leftValue, leftScale] = decimalParts(left);
  const [rightValue, rightScale] = decimalParts(right);
  const scale = Math.max(leftScale, rightScale);
  const normalizedLeft = leftValue * 10n ** BigInt(scale - leftScale);
  const normalizedRight = rightValue * 10n ** BigInt(scale - rightScale);
  return normalizedLeft < normalizedRight ? -1 : normalizedLeft > normalizedRight ? 1 : 0;
}

function WorkspaceHeading({
  title,
  description,
  action,
}: Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}>) {
  return (
    <header className="ui-portfolio__heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action ? <div className="ui-portfolio__heading-action">{action}</div> : null}
    </header>
  );
}

export function AccountsOverview({
  action,
  data,
  renderActions,
}: {
  action?: ReactNode;
  data: AccountsOverviewData;
  renderActions?: (account: AccountOverviewItem) => ReactNode;
}) {
  const metrics = [
    ["Disponible", data.available, "available"],
    ["Con rendimiento", data.invested, "invested"],
    ["Crédito utilizado", data.credit, "credit"],
  ] as const;
  return (
    <IconoirProvider>
      <div className="ui-portfolio" data-portfolio-section="accounts">
        <WorkspaceHeading
          eyebrow="Estructura financiera"
          title="Cuentas que trabajan para usted"
          description="Una lectura simple de su liquidez, cuentas con rendimiento y crédito, sin perder el detalle de cada cuenta."
          action={action}
        />
        <section
          className="ui-portfolio__hero ui-portfolio__hero--accounts"
          aria-label="Cuentas registradas"
        >
          <div>
            <span>Cuentas registradas</span>
            <strong>{data.total}</strong>
            <small>Registros disponibles en su espacio</small>
          </div>
          <div className="ui-portfolio__hero-orbit" aria-hidden="true">
            <Wallet />
          </div>
        </section>
        <section className="ui-portfolio__metrics" aria-label="Resumen de cuentas">
          {metrics.map(([label, value, kind]) => (
            <article key={label} data-tone={kind}>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>
                {kind === "available"
                  ? "Listo para usar"
                  : kind === "invested"
                    ? "En crecimiento"
                    : "Bajo control"}
              </small>
            </article>
          ))}
        </section>
        <section className="ui-portfolio__panel">
          <div className="ui-portfolio__section-heading">
            <div>
              <p className="ui-portfolio__eyebrow">Detalle</p>
              <h2>Mis cuentas</h2>
            </div>
            <a href="/portabilidad">Gestionar datos</a>
          </div>
          <div className="ui-portfolio__account-grid">
            {data.accounts.map((account) => (
              <article className="ui-portfolio__account" data-kind={account.kind} key={account.id}>
                <div className="ui-portfolio__account-icon" aria-hidden="true">
                  {account.kind === "credit" ? (
                    <CreditCard />
                  ) : account.kind === "invested" ? (
                    <Activity />
                  ) : (
                    <Wallet />
                  )}
                </div>
                <span>{account.detail}</span>
                <h3>{account.label}</h3>
                <strong>{account.balance}</strong>
                <div className="ui-portfolio__account-footer">
                  <span>{account.accent}</span>
                  <a href={`/transacciones?cuenta=${account.id}`}>Ver actividad</a>
                </div>
                {renderActions ? (
                  <div className="ui-portfolio__record-actions">{renderActions(account)}</div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    </IconoirProvider>
  );
}

export function TransactionsOverview({
  data,
  registrationAction,
  renderActions,
}: {
  data: TransactionsOverviewData;
  registrationAction: ReactNode;
  renderActions?: (transaction: TransactionListItem) => ReactNode;
}) {
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [query, setQuery] = useState("");
  const [accountId, setAccountId] = useState("");
  const [minimum, setMinimum] = useState("");
  const [maximum, setMaximum] = useState("");
  const [period, setPeriod] = useState<
    "all" | "day" | "week" | "fortnight" | "month" | "year" | "custom"
  >("all");
  const [referenceDate, setReferenceDate] = useState(localDateKey(new Date()));
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const accountOptions = [
    ...new Map(data.transactions.map((item) => [item.accountId, item.account])),
  ];
  const reference = new Date(`${referenceDate}T12:00:00`);
  const start = new Date(reference);
  const end = new Date(reference);
  if (period === "week") {
    const day = (reference.getDay() + 6) % 7;
    start.setDate(reference.getDate() - day);
    end.setDate(start.getDate() + 6);
  } else if (period === "fortnight") {
    start.setDate(reference.getDate() <= 15 ? 1 : 16);
    end.setMonth(
      reference.getMonth() + (reference.getDate() <= 15 ? 0 : 1),
      reference.getDate() <= 15 ? 15 : 0,
    );
  } else if (period === "month") {
    start.setDate(1);
    end.setMonth(reference.getMonth() + 1, 0);
  } else if (period === "year") {
    start.setMonth(0, 1);
    end.setMonth(11, 31);
  }
  const filtered = data.transactions.filter((item) => {
    const searchable = `${item.label} ${item.account} ${item.category}`.toLocaleLowerCase("es");
    const date = item.dateIso;
    const periodMatch =
      period === "all" ||
      (period === "custom"
        ? (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo)
        : period === "day"
          ? date === referenceDate
          : date >= localDateKey(start) && date <= localDateKey(end));
    return (
      (filter === "all" || item.type === filter) &&
      (!accountId || item.accountId === accountId) &&
      (!minimum || (isDecimal(minimum) && compareDecimals(item.amountValue, minimum) >= 0)) &&
      (!maximum || (isDecimal(maximum) && compareDecimals(item.amountValue, maximum) <= 0)) &&
      periodMatch &&
      searchable.includes(query.toLocaleLowerCase("es"))
    );
  });
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);

  useEffect(() => {
    const selectedAccount = new URLSearchParams(window.location.search).get("cuenta");
    if (selectedAccount) setAccountId(selectedAccount);
  }, []);
  useEffect(
    () => setPage(0),
    [accountId, dateFrom, dateTo, filter, maximum, minimum, period, query, referenceDate],
  );
  return (
    <IconoirProvider>
      <div className="ui-portfolio" data-portfolio-section="transactions">
        <WorkspaceHeading
          eyebrow="Historial financiero"
          title="Cada movimiento, en contexto"
          description="Registre, filtre y comprenda qué está pasando con su dinero desde un solo lugar."
          action={registrationAction}
        />
        <section
          className="ui-portfolio__metrics ui-portfolio__metrics--transactions"
          aria-label="Resumen del mes"
        >
          <article data-tone="available">
            <span>Ingresos registrados</span>
            <strong>{data.income}</strong>
            <small>Actividad disponible</small>
          </article>
          <article data-tone="credit">
            <span>Gastos registrados</span>
            <strong>{data.expenses}</strong>
            <small>Actividad disponible</small>
          </article>
          <article data-tone="invested">
            <span>Actividad</span>
            <strong>{data.balance}</strong>
            <small>Movimientos registrados</small>
          </article>
        </section>
        <section className="ui-portfolio__panel">
          <div className="ui-portfolio__section-heading">
            <div>
              <p className="ui-portfolio__eyebrow">Movimientos</p>
              <h2>Historial completo</h2>
            </div>
            <span aria-live="polite">
              {filtered.length
                ? `${page * pageSize + 1}-${Math.min((page + 1) * pageSize, filtered.length)} de ${filtered.length} resultados`
                : "0 resultados"}
            </span>
          </div>
          <section
            aria-labelledby="transaction-filters-title"
            className="ui-portfolio__filter-panel"
          >
            <h3 id="transaction-filters-title">
              <Filter aria-hidden="true" /> Filtrar historial
            </h3>
            <div className="ui-portfolio__filters">
              <label>
                <Search aria-hidden="true" />
                <span className="ui-visually-hidden">Buscar transacciones</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por nombre, cuenta o categoría"
                />
              </label>
              <div role="group" aria-label="Filtrar por tipo">
                {(["all", "income", "expense"] as const).map((value) => (
                  <button
                    aria-pressed={filter === value}
                    key={value}
                    onClick={() => setFilter(value)}
                    type="button"
                  >
                    {value === "all" ? "Todas" : value === "income" ? "Ingresos" : "Gastos"}
                  </button>
                ))}
              </div>
            </div>
            <div className="ui-portfolio__advanced-filters">
              <label>
                Cuenta
                <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                  <option value="">Todas las cuentas</option>
                  {accountOptions.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Monto mínimo
                <input
                  inputMode="decimal"
                  min="0"
                  placeholder="$0"
                  step="0.01"
                  type="number"
                  value={minimum}
                  onChange={(event) => setMinimum(event.target.value)}
                />
              </label>
              <label>
                Monto máximo
                <input
                  inputMode="decimal"
                  min="0"
                  placeholder="Sin límite"
                  step="0.01"
                  type="number"
                  value={maximum}
                  onChange={(event) => setMaximum(event.target.value)}
                />
              </label>
              <label>
                Periodo
                <select
                  value={period}
                  onChange={(event) => setPeriod(event.target.value as typeof period)}
                >
                  <option value="all">Todo el tiempo</option>
                  <option value="day">Día</option>
                  <option value="week">Semana</option>
                  <option value="fortnight">Quincena</option>
                  <option value="month">Mes</option>
                  <option value="year">Año</option>
                  <option value="custom">Rango de fechas</option>
                </select>
              </label>
              {period !== "all" && period !== "custom" ? (
                <label>
                  Fecha de referencia
                  <input
                    type="date"
                    value={referenceDate}
                    onChange={(event) => setReferenceDate(event.target.value)}
                  />
                </label>
              ) : null}
              {period === "custom" ? (
                <>
                  <label>
                    Desde
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(event) => setDateFrom(event.target.value)}
                    />
                  </label>
                  <label>
                    Hasta
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(event) => setDateTo(event.target.value)}
                    />
                  </label>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setFilter("all");
                  setQuery("");
                  setAccountId("");
                  setMinimum("");
                  setMaximum("");
                  setPeriod("all");
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                Limpiar filtros
              </button>
            </div>
          </section>
          <ul className="ui-portfolio__transaction-list">
            {visible.map((item) => (
              <li key={item.id}>
                <span
                  className="ui-portfolio__transaction-mark"
                  data-type={item.type}
                  aria-hidden="true"
                >
                  {item.type === "income" ? "+" : "−"}
                </span>
                <div>
                  <strong>{item.label}</strong>
                  <span>
                    {item.account} · {item.category}
                  </span>
                </div>
                <time>{item.date}</time>
                <strong data-type={item.type}>{item.amount}</strong>
                {renderActions ? (
                  <div className="ui-portfolio__record-actions">{renderActions(item)}</div>
                ) : null}
              </li>
            ))}
          </ul>
          {visible.length === 0 ? (
            <p className="ui-portfolio__empty" role="status">
              No hay movimientos que coincidan con su búsqueda.
            </p>
          ) : null}
          {pageCount > 1 ? (
            <nav aria-label="Paginación de movimientos" className="ui-portfolio__pagination">
              <button
                disabled={page === 0}
                onClick={() => setPage((current) => current - 1)}
                type="button"
              >
                Anterior
              </button>
              <span aria-live="polite">
                Página {page + 1} de {pageCount}
              </span>
              <button
                disabled={page >= pageCount - 1}
                onClick={() => setPage((current) => current + 1)}
                type="button"
              >
                Siguiente
              </button>
            </nav>
          ) : null}
        </section>
      </div>
    </IconoirProvider>
  );
}

export function TransactionComposer({
  accounts,
  compactTrigger = false,
  initialType = "expense",
  onSubmit,
  triggerLabel = "Registrar transacción",
}: Readonly<{
  accounts: readonly AccountOption[];
  compactTrigger?: boolean;
  initialType?: TransactionDraft["type"];
  onSubmit: (draft: TransactionDraft) => Promise<TransactionSubmitResult>;
  triggerLabel?: string;
}>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const today = new Date().toISOString().slice(0, 10);
  const [draft, setDraft] = useState<TransactionDraft>({
    accountId: accounts[0]?.id ?? "",
    type: initialType,
    amount: "",
    date: today,
    category: "",
    description: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof TransactionDraft, string>>>({});
  const [result, setResult] = useState<TransactionSubmitResult>();
  const [submitting, setSubmitting] = useState(false);
  const update =
    (field: keyof TransactionDraft) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setDraft((current) => ({ ...current, [field]: event.target.value }));
      setErrors((current) => {
        if (!current[field]) return current;
        const next = { ...current };
        delete next[field];
        return next;
      });
    };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      setResult(undefined);
      triggerRef.current?.focus();
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!draft.accountId) nextErrors.accountId = "Seleccione una cuenta.";
    if (!/^\d+(?:\.\d{1,2})?$/.test(draft.amount) || Number(draft.amount) <= 0)
      nextErrors.amount = "Ingrese un monto mayor a cero, con hasta 2 decimales.";
    if (!draft.date) nextErrors.date = "Seleccione una fecha.";
    if (!draft.category.trim()) nextErrors.category = "Indique una categoría.";
    if (!draft.description.trim()) nextErrors.description = "Agregue una descripción.";
    setErrors(nextErrors);
    setResult(undefined);
    if (Object.keys(nextErrors).length > 0) {
      const firstError = Object.keys(nextErrors)[0];
      window.requestAnimationFrame(() =>
        dialogRef.current?.querySelector<HTMLElement>(`[name="${firstError}"]`)?.focus(),
      );
      return;
    }
    setSubmitting(true);
    try {
      setResult(await onSubmit(draft));
    } catch (error) {
      setResult({
        status: "error",
        message: error instanceof Error ? error.message : "No se pudo registrar la transacción.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function close() {
    dialogRef.current?.close();
  }
  return (
    <IconoirProvider>
      <button
        className={`ui-portfolio__button ui-portfolio__button--primary${compactTrigger ? " ui-portfolio__button--quick" : ""}`}
        onClick={(event) => {
          triggerRef.current = event.currentTarget;
          dialogRef.current?.showModal();
          window.requestAnimationFrame(() =>
            dialogRef.current?.querySelector<HTMLElement>("[data-dialog-initial-focus]")?.focus(),
          );
        }}
        type="button"
      >
        {compactTrigger ? (
          <span aria-hidden="true">{initialType === "expense" ? "−" : "+"}</span>
        ) : (
          <Plus />
        )}
        <span>{triggerLabel}</span>
      </button>
      <dialog
        aria-describedby={`${titleId}-description`}
        aria-labelledby={titleId}
        className="ui-transaction-dialog"
        onCancel={(event) => {
          if (submitting) event.preventDefault();
        }}
        ref={dialogRef}
      >
        <div className="ui-transaction-dialog__top">
          <div>
            <h2 id={titleId}>Registrar transacción</h2>
            <p id={`${titleId}-description`}>Agregue el movimiento a su historial financiero.</p>
          </div>
          <button aria-label="Cerrar" disabled={submitting} onClick={close} type="button">
            <Xmark />
          </button>
        </div>
        <form noValidate onSubmit={submit}>
          <fieldset className="ui-transaction-dialog__types">
            <legend>Tipo</legend>
            <label>
              <input
                checked={draft.type === "expense"}
                name="type"
                onChange={update("type")}
                type="radio"
                value="expense"
              />
              <span>Gasto</span>
            </label>
            <label>
              <input
                checked={draft.type === "income"}
                name="type"
                onChange={update("type")}
                type="radio"
                value="income"
              />
              <span>Ingreso</span>
            </label>
          </fieldset>
          <div className="ui-transaction-dialog__grid">
            <label>
              Cuenta
              <select
                aria-invalid={Boolean(errors.accountId)}
                aria-describedby={errors.accountId ? "transaction-account-error" : undefined}
                data-dialog-initial-focus
                id="transaction-account"
                name="accountId"
                value={draft.accountId}
                onChange={update("accountId")}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label} · {account.currency}
                  </option>
                ))}
              </select>
              {errors.accountId ? (
                <small id="transaction-account-error" role="alert">
                  {errors.accountId}
                </small>
              ) : null}
            </label>
            <label>
              Monto
              <input
                aria-invalid={Boolean(errors.amount)}
                aria-describedby={errors.amount ? "transaction-amount-error" : undefined}
                id="transaction-amount"
                inputMode="decimal"
                min="0.01"
                onChange={update("amount")}
                placeholder="0.00"
                step="0.01"
                type="number"
                value={draft.amount}
              />
              {errors.amount ? (
                <small id="transaction-amount-error" role="alert">
                  {errors.amount}
                </small>
              ) : null}
            </label>
            <label>
              Fecha
              <input
                aria-invalid={Boolean(errors.date)}
                aria-describedby={errors.date ? "transaction-date-error" : undefined}
                id="transaction-date"
                onChange={update("date")}
                type="date"
                value={draft.date}
              />
              {errors.date ? (
                <small id="transaction-date-error" role="alert">
                  {errors.date}
                </small>
              ) : null}
            </label>
            <label>
              Categoría
              <input
                aria-invalid={Boolean(errors.category)}
                aria-describedby={errors.category ? "transaction-category-error" : undefined}
                id="transaction-category"
                maxLength={48}
                onChange={update("category")}
                placeholder="Ej. Alimentación"
                value={draft.category}
              />
              {errors.category ? (
                <small id="transaction-category-error" role="alert">
                  {errors.category}
                </small>
              ) : null}
            </label>
            <label className="ui-transaction-dialog__wide">
              Descripción
              <textarea
                aria-invalid={Boolean(errors.description)}
                aria-describedby={errors.description ? "transaction-description-error" : undefined}
                id="transaction-description"
                maxLength={120}
                onChange={update("description")}
                placeholder="¿Qué movimiento desea recordar?"
                rows={3}
                value={draft.description}
              />
              {errors.description ? (
                <small id="transaction-description-error" role="alert">
                  {errors.description}
                </small>
              ) : null}
            </label>
          </div>
          {result ? (
            <div
              className="ui-transaction-dialog__result"
              data-status={result.status}
              aria-live={result.status === "error" ? "assertive" : "polite"}
              role={result.status === "error" ? "alert" : "status"}
            >
              {result.status === "success" ? <CheckCircle /> : <Activity />}
              <span>{result.message}</span>
            </div>
          ) : null}
          <div className="ui-transaction-dialog__actions">
            <button disabled={submitting} onClick={close} type="button">
              Cancelar
            </button>
            <button
              className="ui-portfolio__button ui-portfolio__button--dark"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Registrando..." : "Registrar transacción"}
            </button>
          </div>
        </form>
      </dialog>
    </IconoirProvider>
  );
}

export function PortabilityExperience({
  onExport,
  onImport,
}: Readonly<{
  onExport: () => Promise<string>;
  onImport: (file: File) => Promise<string>;
}>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{
    tone: "idle" | "working" | "success" | "error";
    message: string;
  }>({ tone: "idle", message: "Sus datos permanecen bajo su control." });
  async function run(action: () => Promise<string>) {
    setStatus({ tone: "working", message: "Procesando de forma segura..." });
    try {
      setStatus({ tone: "success", message: await action() });
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "No pudimos completar la operación.",
      });
    }
  }
  return (
    <IconoirProvider>
      <div className="ui-portfolio" data-portfolio-section="portability">
        <WorkspaceHeading
          eyebrow="Libertad por diseño"
          title="Su información viaja con usted"
          description="Exporte una copia legible o recupere su espacio desde un archivo. Sin formatos cerrados ni dependencia de un proveedor."
        />
        <section className="ui-portfolio__hero ui-portfolio__hero--portability">
          <div>
            <span>Enfoque local-first</span>
            <strong>Usted decide dónde viven sus datos.</strong>
            <small>Formato abierto · Copia completa · Importación validada</small>
          </div>
          <div className="ui-portfolio__hero-orbit" aria-hidden="true">
            <Database />
          </div>
        </section>
        <section className="ui-portfolio__portability-grid">
          <article>
            <div className="ui-portfolio__feature-icon">
              <CloudDownload />
            </div>
            <p className="ui-portfolio__eyebrow">Crear respaldo</p>
            <h2>Exportar mis datos</h2>
            <p>Descargá cuentas y transacciones en un archivo JSON portable.</p>
            <button
              className="ui-portfolio__button ui-portfolio__button--dark"
              disabled={status.tone === "working"}
              onClick={() => void run(onExport)}
              type="button"
            >
              Exportar copia
            </button>
          </article>
          <article>
            <div className="ui-portfolio__feature-icon">
              <CloudUpload />
            </div>
            <p className="ui-portfolio__eyebrow">Recuperar espacio</p>
            <h2>Importar un respaldo</h2>
            <p>
              Seleccione un archivo exportado por 2 Free. Lo validaremos antes de aplicar cambios.
            </p>
            <input
              accept="application/json,.json"
              className="ui-visually-hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void run(() => onImport(file));
                event.target.value = "";
              }}
              ref={inputRef}
              type="file"
            />
            <button
              className="ui-portfolio__button ui-portfolio__button--outline"
              disabled={status.tone === "working"}
              onClick={() => inputRef.current?.click()}
              type="button"
            >
              Elegir archivo
            </button>
          </article>
        </section>
        <div className="ui-portfolio__portability-status" data-status={status.tone} role="status">
          <ShieldCheck />
          <div>
            <strong>
              {status.tone === "error"
                ? "Revisá el archivo"
                : status.tone === "success"
                  ? "Operación completada"
                  : "Control local"}
            </strong>
            <span>{status.message}</span>
          </div>
        </div>
      </div>
    </IconoirProvider>
  );
}

export * from "./product-workspaces";
