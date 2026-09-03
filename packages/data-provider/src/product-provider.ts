import type {
  NotificationEvent,
  NotificationRule,
  ProductKind,
} from "@camircode/twofree-core/product-domain.js";

import type { FinanceScope } from "./provider.js";
import type { ScopedFinanceProviderLike } from "./provider.js";

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

export interface ProductDataProvider {
  createProduct<T>(scope: FinanceScope, kind: ProductKind, input: T): Promise<ProductRecord<T>>;
  updateProduct<T>(
    scope: FinanceScope,
    kind: ProductKind,
    id: string,
    input: T,
  ): Promise<ProductRecord<T>>;
  deleteProduct(scope: FinanceScope, kind: ProductKind, id: string): Promise<void>;
  listProducts<T>(scope: FinanceScope, kind: ProductKind): Promise<readonly ProductRecord<T>[]>;
  evaluateNotifications(
    scope: FinanceScope,
    observations: Readonly<Record<string, Readonly<Record<string, string>>>>,
  ): Promise<readonly NotificationEvent[]>;
  exportProducts(scope: FinanceScope): Promise<PortableProductEnvelope>;
  importProducts(scope: FinanceScope, envelope: PortableProductEnvelope): Promise<void>;
  addSharedMember(scope: FinanceScope, groupId: string, userId: string): Promise<void>;
}

export interface CompleteFinanceProvider extends ScopedFinanceProviderLike, ProductDataProvider {}

export type NotificationRuleRecord = ProductRecord<NotificationRule>;
