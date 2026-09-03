-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "label_encrypted" BYTEA,
ADD COLUMN     "metadata_encrypted" BYTEA;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "metadata_encrypted" BYTEA;

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "payload" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_actuals" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "budget_id" TEXT NOT NULL,
    "coefficient" TEXT NOT NULL,
    "scale" INTEGER NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_actuals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "savings_goals" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "payload" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "savings_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_expense_groups" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "payload" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shared_expense_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_expense_members" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "shared_expense_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_expenses" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "payload" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shared_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_expense_splits" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "expense_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "coefficient" TEXT NOT NULL,
    "scale" INTEGER NOT NULL,

    CONSTRAINT "shared_expense_splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_card_profiles" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "payload" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_card_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charge_card_profiles" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "payload" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charge_card_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_limit_history" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "coefficient" TEXT NOT NULL,
    "scale" INTEGER NOT NULL,
    "effective_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_limit_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_movements" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "credit_profile_id" TEXT,
    "charge_profile_id" TEXT,
    "type" TEXT NOT NULL,
    "payload" BYTEA NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debit_profiles" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "payload" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debit_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yield_account_profiles" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "payload" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yield_account_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_holdings" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "symbol_hash" TEXT NOT NULL,
    "payload" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_purchases" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "holding_id" TEXT NOT NULL,
    "payload" BYTEA NOT NULL,
    "purchased_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investment_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cetes_holdings" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "maturity_date" TIMESTAMP(3) NOT NULL,
    "payload" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cetes_holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_rules" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "source_hash" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "payload" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_events" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "payload" BYTEA NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "budgets_owner_id_month_idx" ON "budgets"("owner_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_id_owner_id_key" ON "budgets"("id", "owner_id");

-- CreateIndex
CREATE INDEX "budget_actuals_owner_id_budget_id_idx" ON "budget_actuals"("owner_id", "budget_id");

-- CreateIndex
CREATE INDEX "savings_goals_owner_id_idx" ON "savings_goals"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "savings_goals_id_owner_id_key" ON "savings_goals"("id", "owner_id");

-- CreateIndex
CREATE INDEX "shared_expense_groups_owner_id_idx" ON "shared_expense_groups"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "shared_expense_groups_id_owner_id_key" ON "shared_expense_groups"("id", "owner_id");

-- CreateIndex
CREATE INDEX "shared_expense_members_owner_id_group_id_idx" ON "shared_expense_members"("owner_id", "group_id");

-- CreateIndex
CREATE INDEX "shared_expense_members_user_id_idx" ON "shared_expense_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "shared_expense_members_group_id_user_id_key" ON "shared_expense_members"("group_id", "user_id");

-- CreateIndex
CREATE INDEX "shared_expenses_owner_id_group_id_idx" ON "shared_expenses"("owner_id", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "shared_expenses_id_owner_id_key" ON "shared_expenses"("id", "owner_id");

-- CreateIndex
CREATE INDEX "shared_expense_splits_owner_id_expense_id_idx" ON "shared_expense_splits"("owner_id", "expense_id");

-- CreateIndex
CREATE UNIQUE INDEX "shared_expense_splits_expense_id_user_id_key" ON "shared_expense_splits"("expense_id", "user_id");

-- CreateIndex
CREATE INDEX "credit_card_profiles_owner_id_idx" ON "credit_card_profiles"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_card_profiles_id_owner_id_key" ON "credit_card_profiles"("id", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_card_profiles_account_id_owner_id_key" ON "credit_card_profiles"("account_id", "owner_id");

-- CreateIndex
CREATE INDEX "charge_card_profiles_owner_id_idx" ON "charge_card_profiles"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "charge_card_profiles_id_owner_id_key" ON "charge_card_profiles"("id", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "charge_card_profiles_account_id_owner_id_key" ON "charge_card_profiles"("account_id", "owner_id");

-- CreateIndex
CREATE INDEX "credit_limit_history_owner_id_profile_id_effective_at_idx" ON "credit_limit_history"("owner_id", "profile_id", "effective_at");

-- CreateIndex
CREATE INDEX "card_movements_owner_id_occurred_at_idx" ON "card_movements"("owner_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "debit_profiles_id_owner_id_key" ON "debit_profiles"("id", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "debit_profiles_account_id_owner_id_key" ON "debit_profiles"("account_id", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "yield_account_profiles_id_owner_id_key" ON "yield_account_profiles"("id", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "yield_account_profiles_account_id_owner_id_key" ON "yield_account_profiles"("account_id", "owner_id");

-- CreateIndex
CREATE INDEX "security_holdings_owner_id_symbol_hash_idx" ON "security_holdings"("owner_id", "symbol_hash");

-- CreateIndex
CREATE UNIQUE INDEX "security_holdings_id_owner_id_key" ON "security_holdings"("id", "owner_id");

-- CreateIndex
CREATE INDEX "investment_purchases_owner_id_holding_id_purchased_at_idx" ON "investment_purchases"("owner_id", "holding_id", "purchased_at");

-- CreateIndex
CREATE INDEX "cetes_holdings_owner_id_maturity_date_idx" ON "cetes_holdings"("owner_id", "maturity_date");

-- CreateIndex
CREATE UNIQUE INDEX "cetes_holdings_id_owner_id_key" ON "cetes_holdings"("id", "owner_id");

-- CreateIndex
CREATE INDEX "notification_rules_owner_id_enabled_idx" ON "notification_rules"("owner_id", "enabled");

-- CreateIndex
CREATE INDEX "notification_rules_owner_id_source_hash_idx" ON "notification_rules"("owner_id", "source_hash");

-- CreateIndex
CREATE UNIQUE INDEX "notification_rules_id_owner_id_key" ON "notification_rules"("id", "owner_id");

-- CreateIndex
CREATE INDEX "notification_events_owner_id_occurred_at_idx" ON "notification_events"("owner_id", "occurred_at");

-- CreateIndex
CREATE INDEX "notification_events_owner_id_rule_id_idx" ON "notification_events"("owner_id", "rule_id");

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_actuals" ADD CONSTRAINT "budget_actuals_budget_id_owner_id_fkey" FOREIGN KEY ("budget_id", "owner_id") REFERENCES "budgets"("id", "owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_goals" ADD CONSTRAINT "savings_goals_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_expense_groups" ADD CONSTRAINT "shared_expense_groups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_expense_members" ADD CONSTRAINT "shared_expense_members_group_id_owner_id_fkey" FOREIGN KEY ("group_id", "owner_id") REFERENCES "shared_expense_groups"("id", "owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_expense_members" ADD CONSTRAINT "shared_expense_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_expenses" ADD CONSTRAINT "shared_expenses_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_expenses" ADD CONSTRAINT "shared_expenses_group_id_owner_id_fkey" FOREIGN KEY ("group_id", "owner_id") REFERENCES "shared_expense_groups"("id", "owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_expense_splits" ADD CONSTRAINT "shared_expense_splits_expense_id_owner_id_fkey" FOREIGN KEY ("expense_id", "owner_id") REFERENCES "shared_expenses"("id", "owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_profiles" ADD CONSTRAINT "credit_card_profiles_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_profiles" ADD CONSTRAINT "credit_card_profiles_account_id_owner_id_fkey" FOREIGN KEY ("account_id", "owner_id") REFERENCES "accounts"("id", "owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_card_profiles" ADD CONSTRAINT "charge_card_profiles_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_card_profiles" ADD CONSTRAINT "charge_card_profiles_account_id_owner_id_fkey" FOREIGN KEY ("account_id", "owner_id") REFERENCES "accounts"("id", "owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_limit_history" ADD CONSTRAINT "credit_limit_history_profile_id_owner_id_fkey" FOREIGN KEY ("profile_id", "owner_id") REFERENCES "credit_card_profiles"("id", "owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_movements" ADD CONSTRAINT "card_movements_credit_profile_id_owner_id_fkey" FOREIGN KEY ("credit_profile_id", "owner_id") REFERENCES "credit_card_profiles"("id", "owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_movements" ADD CONSTRAINT "card_movements_charge_profile_id_owner_id_fkey" FOREIGN KEY ("charge_profile_id", "owner_id") REFERENCES "charge_card_profiles"("id", "owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_profiles" ADD CONSTRAINT "debit_profiles_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_profiles" ADD CONSTRAINT "debit_profiles_account_id_owner_id_fkey" FOREIGN KEY ("account_id", "owner_id") REFERENCES "accounts"("id", "owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yield_account_profiles" ADD CONSTRAINT "yield_account_profiles_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yield_account_profiles" ADD CONSTRAINT "yield_account_profiles_account_id_owner_id_fkey" FOREIGN KEY ("account_id", "owner_id") REFERENCES "accounts"("id", "owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_holdings" ADD CONSTRAINT "security_holdings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_purchases" ADD CONSTRAINT "investment_purchases_holding_id_owner_id_fkey" FOREIGN KEY ("holding_id", "owner_id") REFERENCES "security_holdings"("id", "owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cetes_holdings" ADD CONSTRAINT "cetes_holdings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_rule_id_owner_id_fkey" FOREIGN KEY ("rule_id", "owner_id") REFERENCES "notification_rules"("id", "owner_id") ON DELETE CASCADE ON UPDATE CASCADE;
