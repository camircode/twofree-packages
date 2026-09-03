export type MoneyDto = Readonly<{
  currency: string;
  coefficient: string;
  scale: number;
}>;

export type ProductKind =
  | "budget"
  | "savings-goal"
  | "shared-group"
  | "shared-expense"
  | "credit-card"
  | "charge-card"
  | "debit-profile"
  | "yield-account"
  | "notification-rule";

export type ProductRecord<T = unknown> = Readonly<{
  id: string;
  kind: ProductKind;
  value: T;
  createdAt: string;
  updatedAt: string;
}>;

export type PortableProductEnvelope = Readonly<{
  format: "2free-portable";
  version: 2;
  exportedAt: string;
  records: readonly ProductRecord[];
}>;

export type NotificationEvent = Readonly<{
  ruleId: string;
  source: string;
  field: string;
  observed: string;
  threshold: string;
  occurredAt: string;
}>;

export interface ProductDataProvider {
  list<T>(kind: ProductKind): Promise<readonly ProductRecord<T>[]>;
  create<TInput, TValue = TInput>(
    kind: ProductKind,
    input: TInput,
    idempotencyKey?: string,
  ): Promise<ProductRecord<TValue>>;
  update<TInput, TValue = TInput>(
    kind: ProductKind,
    id: string,
    input: TInput,
    idempotencyKey?: string,
  ): Promise<ProductRecord<TValue>>;
  delete(kind: ProductKind, id: string, idempotencyKey?: string): Promise<void>;
  addSharedMember(groupId: string, userId: string): Promise<void>;
  calculateYield(id: string, balance: MoneyDto): Promise<MoneyDto>;
  exportProducts(): Promise<PortableProductEnvelope>;
  importProducts(envelope: PortableProductEnvelope): Promise<void>;
  evaluateAlerts(
    observations: Readonly<Record<string, Readonly<Record<string, string>>>>,
  ): Promise<readonly NotificationEvent[]>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const paths: Readonly<Record<ProductKind, string>> = {
  budget: "budgets",
  "savings-goal": "savings-goals",
  "shared-group": "shared-groups",
  "shared-expense": "shared-expenses",
  "credit-card": "credit-cards",
  "charge-card": "charge-cards",
  "debit-profile": "debit-profiles",
  "yield-account": "yield-accounts",
  "notification-rule": "notification-rules",
};

function mutationHeaders(idempotencyKey?: string): HeadersInit {
  return {
    "content-type": "application/json",
    "idempotency-key":
      idempotencyKey ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
  };
}

export function productUpdateInput(kind: ProductKind, input: unknown): Record<string, unknown> {
  const value = { ...(input as Record<string, unknown>) };
  delete value.id;
  delete value.status;
  delete value.members;
  delete value.paidByUserId;
  if (kind === "shared-expense" && Array.isArray(value.splits)) {
    value.splits = value.splits.map((entry) => ({
      userId: String((entry as Record<string, unknown>).userId),
      weight: String((entry as Record<string, unknown>).weight ?? "1"),
    }));
  }
  return value;
}

export function decimalToMoney(value: string, currency = "MXN"): MoneyDto {
  const normalized = value.trim();
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(normalized)) {
    throw new Error("El monto debe ser un decimal exacto.");
  }
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/u, "") || "0";
  return {
    currency: currency.toUpperCase(),
    coefficient: `${negative ? "-" : ""}${digits}`,
    scale: fraction.length,
  };
}

export class ApiProvider implements ProductDataProvider {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = `${baseUrl.replace(/\/$/u, "")}/`;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetch(new URL(path, this.baseUrl), { ...init, credentials: "include" });
    } catch {
      throw new ApiError("No se pudo conectar con la API. El borrador se conservó.", 0);
    }
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    if (!response.ok) {
      const message =
        response.status === 401
          ? "La sesión terminó. Acceda de nuevo para continuar; el borrador se conservó."
          : payload?.message || "La API no pudo completar la operación. El borrador se conservó.";
      throw new ApiError(Array.isArray(message) ? message.join(" ") : message, response.status);
    }
    return payload as T;
  }

  async list<T>(kind: ProductKind) {
    const result = await this.request<{ records: readonly ProductRecord<T>[] }>(paths[kind]);
    return result.records;
  }

  async create<TInput, TValue = TInput>(kind: ProductKind, input: TInput, idempotencyKey?: string) {
    const result = await this.request<{ record: ProductRecord<TValue> }>(paths[kind], {
      method: "POST",
      headers: mutationHeaders(idempotencyKey),
      body: JSON.stringify(input),
    });
    return result.record;
  }

  async update<TInput, TValue = TInput>(
    kind: ProductKind,
    id: string,
    input: TInput,
    idempotencyKey?: string,
  ) {
    const result = await this.request<{ record: ProductRecord<TValue> }>(
      `products/${kind}/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: mutationHeaders(idempotencyKey),
        body: JSON.stringify(productUpdateInput(kind, input)),
      },
    );
    return result.record;
  }

  async delete(kind: ProductKind, id: string, idempotencyKey?: string) {
    await this.request(`products/${kind}/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: mutationHeaders(idempotencyKey),
    });
  }

  async addSharedMember(groupId: string, userId: string) {
    await this.request(`shared-groups/${encodeURIComponent(groupId)}/members`, {
      method: "POST",
      headers: mutationHeaders(),
      body: JSON.stringify({ userId }),
    });
  }

  async calculateYield(id: string, balance: MoneyDto) {
    const result = await this.request<{ dailyYield: MoneyDto }>(
      `yield-accounts/${encodeURIComponent(id)}/calculate`,
      {
        method: "POST",
        headers: mutationHeaders(),
        body: JSON.stringify({ balance }),
      },
    );
    return result.dailyYield;
  }

  exportProducts() {
    return this.request<PortableProductEnvelope>("portable/products");
  }

  async importProducts(envelope: PortableProductEnvelope) {
    await this.request("portable/products", {
      method: "POST",
      headers: mutationHeaders(),
      body: JSON.stringify(envelope),
    });
  }

  async evaluateAlerts(observations: Readonly<Record<string, Readonly<Record<string, string>>>>) {
    const result = await this.request<{ events: readonly NotificationEvent[] }>(
      "notifications/evaluate",
      {
        method: "POST",
        headers: mutationHeaders(),
        body: JSON.stringify({ observations }),
      },
    );
    return result.events;
  }
}
