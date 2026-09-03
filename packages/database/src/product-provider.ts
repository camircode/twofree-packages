import { createHash, randomUUID } from "node:crypto";

import {
  assertCardProfile,
  budgetStatus,
  domainMoney,
  evaluateRules,
  assertNoPanLikeData,
  moneyDto,
  splitExactly,
  type NotificationRule,
  type ProductKind,
} from "@camircode/twofree-core/product-domain.js";
import { ValidationError } from "@camircode/twofree-core/validation.js";
import type {
  PortableProductEnvelope,
  ProductDataProvider,
  ProductRecord,
} from "@camircode/twofree-data-provider";
import { requireFinanceScope, type FinanceScope } from "@camircode/twofree-data-provider";

import type { PrismaClient } from "./client.js";
import { DataEncryption } from "./encryption.js";

type StoredRow = { id: string; payload: Uint8Array; createdAt: Date; updatedAt: Date };
type Delegate = {
  create(args: unknown): Promise<StoredRow>;
  update(args: unknown): Promise<StoredRow>;
  delete(args: unknown): Promise<unknown>;
  findUnique(args: unknown): Promise<StoredRow | null>;
  findMany(args: unknown): Promise<StoredRow[]>;
};

const delegates = {
  budget: "budget",
  "savings-goal": "savingsGoal",
  "shared-group": "sharedExpenseGroup",
  "shared-expense": "sharedExpense",
  "credit-card": "creditCardProfile",
  "charge-card": "chargeCardProfile",
  "debit-profile": "debitProfile",
  "yield-account": "yieldAccountProfile",
  "notification-rule": "notificationRule",
} as const satisfies Record<ProductKind, string>;

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ValidationError("product input must be an object");
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "")
    throw new ValidationError(`${field} must be a non-empty string`);
  return value;
}

function delegate(prisma: PrismaClient, kind: ProductKind): Delegate {
  const name = delegates[kind];
  if (!name) throw new ValidationError("product kind is invalid");
  return (prisma as unknown as Record<string, Delegate>)[name]!;
}

function record<T>(
  kind: ProductKind,
  row: StoredRow,
  encryption: DataEncryption,
): ProductRecord<T> {
  return Object.freeze({
    id: row.id,
    kind,
    value: encryption.decrypt<T>(row.payload),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

function structural(
  kind: ProductKind,
  ownerId: string,
  id: string,
  value: Record<string, unknown>,
  payload: Uint8Array,
) {
  const common = { id, ownerId, payload };
  switch (kind) {
    case "budget":
      return { ...common, month: text(value.month, "month") };
    case "shared-expense":
      return { ...common, groupId: text(value.groupId, "groupId") };
    case "credit-card":
    case "charge-card":
    case "debit-profile":
    case "yield-account":
      return { ...common, accountId: text(value.accountId, "accountId") };
    case "notification-rule":
      return {
        ...common,
        sourceHash: hash(text(value.source, "source")),
        enabled: value.enabled !== false,
      };
    default:
      return common;
  }
}

async function assertAccountKind(
  prisma: PrismaClient,
  ownerId: string,
  value: Record<string, unknown>,
  kind: ProductKind,
): Promise<void> {
  if (!["credit-card", "charge-card", "debit-profile", "yield-account"].includes(kind)) return;
  const expected = (
    {
      "credit-card": "revolving-credit",
      "charge-card": "charge-card",
      "debit-profile": "debit",
      "yield-account": "yield",
    } as Partial<Record<ProductKind, string>>
  )[kind];
  const account = await prisma.financeAccount.findUnique({
    where: { id_ownerId: { id: text(value.accountId, "accountId"), ownerId } },
  });
  if (!account || account.type !== expected)
    throw new ValidationError(`${kind} requires an owned ${expected} account`);
}

export function createPrismaProductProvider(
  prisma: PrismaClient,
  encryption: DataEncryption,
): ProductDataProvider {
  const scope = (value: FinanceScope) => requireFinanceScope(value);
  const provider: ProductDataProvider = {
    async createProduct<T>(requested: FinanceScope, kind: ProductKind, input: T) {
      const { ownerId } = scope(requested);
      assertNoPanLikeData(input);
      const source = object(input);
      if (kind === "credit-card" || kind === "charge-card") assertCardProfile(kind, source);
      await assertAccountKind(prisma, ownerId, source, kind);
      const id = typeof source.id === "string" && source.id !== "" ? source.id : randomUUID();
      let value: Record<string, unknown> = { ...source, id };
      if (kind === "budget")
        value = {
          ...value,
          status: budgetStatus(
            domainMoney(source.limit as never),
            domainMoney(source.actual as never),
            typeof source.riskPercent === "string" ? source.riskPercent : "80",
          ),
        };
      if (kind === "shared-group")
        value = { ...value, members: [{ userId: ownerId, role: "owner" }] };
      if (kind === "shared-expense") {
        const groupId = text(value.groupId, "groupId");
        const group = await prisma.sharedExpenseGroup.findFirst({
          where: { id: groupId, members: { some: { userId: ownerId } } },
          include: { members: true },
        });
        if (!group) throw new ValidationError("shared expense requires group membership");
        const splitUsers = Array.isArray(value.splits)
          ? value.splits.map((split) => text(object(split).userId, "split userId"))
          : [];
        const members = new Set(group.members.map((member) => member.userId));
        if (splitUsers.length === 0 || splitUsers.some((userId) => !members.has(userId)))
          throw new ValidationError("every split user must be a group member");
        value = {
          ...value,
          splits: splitExactly(
            domainMoney(value.amount as never),
            (value.splits as unknown[]).map((split) => ({
              userId: text(object(split).userId, "split userId"),
              weight: text(object(split).weight, "split weight"),
            })),
          ).map(({ userId, amount }) => ({ userId, amount: moneyDto(amount) })),
        };
      }
      const row = await delegate(prisma, kind).create({
        data: structural(kind, ownerId, id, value, encryption.encrypt(value)),
      });
      if (kind === "shared-group")
        await prisma.sharedExpenseMember.create({
          data: { id: randomUUID(), ownerId, groupId: id, userId: ownerId, role: "owner" },
        });
      if (kind === "budget") {
        const actual = domainMoney(value.actual as never);
        await prisma.budgetActual.create({
          data: {
            id: randomUUID(),
            ownerId,
            budgetId: id,
            coefficient: actual.coefficient.toString(),
            scale: actual.scale,
          },
        });
      }
      if (kind === "shared-expense") {
        for (const entry of value.splits as Array<Record<string, unknown>>) {
          const amount = domainMoney(entry.amount as never);
          await prisma.sharedExpenseSplit.create({
            data: {
              id: randomUUID(),
              ownerId,
              expenseId: id,
              userId: text(entry.userId, "split userId"),
              coefficient: amount.coefficient.toString(),
              scale: amount.scale,
            },
          });
        }
      }
      if (kind === "credit-card") {
        for (const entry of Array.isArray(value.limitHistory) ? value.limitHistory : []) {
          const history = object(entry);
          const limit = domainMoney(history.limit as never);
          await prisma.creditLimitHistory.create({
            data: {
              id: randomUUID(),
              ownerId,
              profileId: id,
              coefficient: limit.coefficient.toString(),
              scale: limit.scale,
              effectiveAt: new Date(text(history.effectiveAt, "effectiveAt")),
            },
          });
        }
      }
      if (kind === "credit-card" || kind === "charge-card") {
        for (const entry of Array.isArray(value.movements) ? value.movements : []) {
          const movement = object(entry);
          await prisma.cardMovement.create({
            data: {
              id: randomUUID(),
              ownerId,
              creditProfileId: kind === "credit-card" ? id : null,
              chargeProfileId: kind === "charge-card" ? id : null,
              type: text(movement.type, "movement type"),
              payload: encryption.encrypt(movement),
              occurredAt: new Date(text(movement.occurredAt, "occurredAt")),
            },
          });
        }
      }
      return record<T>(kind, row, encryption);
    },
    async updateProduct<T>(requested: FinanceScope, kind: ProductKind, id: string, input: T) {
      const { ownerId } = scope(requested);
      assertNoPanLikeData(input);
      const source = object(input);
      if (kind === "credit-card" || kind === "charge-card") assertCardProfile(kind, source);
      const current = await delegate(prisma, kind).findUnique({
        where: { id_ownerId: { id, ownerId } },
      });
      if (!current) throw new ValidationError("product does not exist for owner");
      let value: Record<string, unknown> = {
        ...encryption.decrypt<Record<string, unknown>>(current.payload),
        ...source,
        id,
      };
      if (kind === "budget")
        value = {
          ...value,
          status: budgetStatus(
            domainMoney(value.limit as never),
            domainMoney(value.actual as never),
            typeof value.riskPercent === "string" ? value.riskPercent : "80",
          ),
        };
      if (kind === "shared-expense") {
        const splits = Array.isArray(source.splits) ? source.splits : [];
        value = {
          ...value,
          splits: splitExactly(
            domainMoney(value.amount as never),
            splits.map((split) => ({
              userId: text(object(split).userId, "split userId"),
              weight: text(object(split).weight, "split weight"),
            })),
          ).map(({ userId, amount }) => ({ userId, amount: moneyDto(amount) })),
        };
      }
      await assertAccountKind(prisma, ownerId, value, kind);
      const row = await delegate(prisma, kind).update({
        where: { id_ownerId: { id, ownerId } },
        data: {
          ...structural(kind, ownerId, id, value, encryption.encrypt(value)),
          id: undefined,
          ownerId: undefined,
        },
      });
      return record<T>(kind, row, encryption);
    },
    async deleteProduct(requested, kind, id) {
      const { ownerId } = scope(requested);
      await delegate(prisma, kind).delete({ where: { id_ownerId: { id, ownerId } } });
    },
    async listProducts<T>(requested: FinanceScope, kind: ProductKind) {
      const { ownerId } = scope(requested);
      const rows = await delegate(prisma, kind).findMany({
        where: { ownerId },
        orderBy: { createdAt: "asc" },
      });
      return rows.map((row) => record<T>(kind, row, encryption));
    },
    async evaluateNotifications(requested, observations) {
      const owner = scope(requested);
      assertNoPanLikeData(observations);
      const rules = await provider.listProducts<NotificationRule>(owner, "notification-rule");
      const occurredAt = new Date().toISOString();
      const events = evaluateRules(
        rules.map(({ value }) => value),
        observations,
        occurredAt,
      );
      for (const event of events)
        await prisma.notificationEvent.create({
          data: {
            id: randomUUID(),
            ownerId: owner.ownerId,
            ruleId: event.ruleId,
            payload: encryption.encrypt(event),
            occurredAt: new Date(event.occurredAt),
          },
        });
      return events;
    },
    async exportProducts(requested) {
      const owner = scope(requested);
      const records = (
        await Promise.all(
          (Object.keys(delegates) as ProductKind[]).map((kind) =>
            provider.listProducts(owner, kind),
          ),
        )
      ).flat();
      return Object.freeze({
        format: "2free-portable",
        version: 2,
        exportedAt: new Date().toISOString(),
        records,
      });
    },
    async importProducts(requested, envelope: PortableProductEnvelope) {
      const owner = scope(requested);
      if (
        envelope.format !== "2free-portable" ||
        envelope.version !== 2 ||
        !Array.isArray(envelope.records)
      )
        throw new ValidationError("unsupported portable product envelope");
      for (const item of envelope.records)
        await provider.createProduct(owner, item.kind, item.value);
    },
    async addSharedMember(requested, groupId, userId) {
      const owner = scope(requested);
      const group = await prisma.sharedExpenseGroup.findUnique({
        where: { id_ownerId: { id: groupId, ownerId: owner.ownerId } },
      });
      if (!group) throw new ValidationError("only the group owner may add members");
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new ValidationError("member must reference an existing 2 Free user");
      await prisma.sharedExpenseMember.create({
        data: { id: randomUUID(), ownerId: owner.ownerId, groupId, userId, role: "member" },
      });
      const current = encryption.decrypt<Record<string, unknown>>(group.payload);
      const members = Array.isArray(current.members) ? current.members : [];
      await prisma.sharedExpenseGroup.update({
        where: { id_ownerId: { id: groupId, ownerId: owner.ownerId } },
        data: {
          payload: encryption.encrypt({
            ...current,
            members: [...members, { userId, role: "member" }],
          }),
        },
      });
    },
  };
  return Object.freeze(provider);
}
