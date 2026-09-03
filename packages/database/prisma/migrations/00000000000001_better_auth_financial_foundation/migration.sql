-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE IF NOT EXISTS "auth_user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "auth_session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "auth_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "auth_account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "auth_verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "accounts" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "statement_balance_coefficient" TEXT,
    "statement_balance_scale" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "transactions" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount_coefficient" TEXT NOT NULL,
    "amount_scale" INTEGER NOT NULL,
    "metadata" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "transaction_idempotency" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "request_fingerprint" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_idempotency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "quarantined_financial_rows" (
    "id" TEXT NOT NULL,
    "source_table" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "owner_id" TEXT,
    "migration_audit_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quarantined_financial_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "migration_audits" (
    "id" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "operator_id" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "row_count" INTEGER NOT NULL,
    "assigned_count" INTEGER NOT NULL,
    "quarantined_count" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "migration_audits_pkey" PRIMARY KEY ("id")
);

-- Existing raw-pg rows remain ownerless and rollback-only until a later
-- quarantine/bootstrap slice assigns them explicitly. These nullable columns
-- let this foundation migration run after the imported legacy baseline without
-- inferring an owner or dual-writing through the old provider.
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "owner_id" TEXT;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "owner_id" TEXT;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "currency" TEXT;
ALTER TABLE "transaction_idempotency" ADD COLUMN IF NOT EXISTS "id" TEXT;
ALTER TABLE "transaction_idempotency" ADD COLUMN IF NOT EXISTS "owner_id" TEXT;
ALTER TABLE "transaction_idempotency" ADD COLUMN IF NOT EXISTS "key" TEXT;
ALTER TABLE "transaction_idempotency" ADD COLUMN IF NOT EXISTS "request_fingerprint" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "auth_user_email_key" ON "auth_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_session_token_key" ON "auth_session"("token");

-- CreateIndex
CREATE INDEX "auth_session_userId_idx" ON "auth_session"("userId");

-- CreateIndex
CREATE INDEX "auth_account_userId_idx" ON "auth_account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_account_providerId_accountId_key" ON "auth_account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "auth_verification_identifier_idx" ON "auth_verification"("identifier");

-- CreateIndex
CREATE INDEX "accounts_owner_id_idx" ON "accounts"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_id_owner_id_key" ON "accounts"("id", "owner_id");

-- CreateIndex
CREATE INDEX "transactions_owner_id_account_id_idx" ON "transactions"("owner_id", "account_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_id_owner_id_key" ON "transactions"("id", "owner_id");

-- CreateIndex
CREATE INDEX "transaction_idempotency_owner_id_idx" ON "transaction_idempotency"("owner_id");

-- CreateIndex
CREATE INDEX "transaction_idempotency_transaction_id_owner_id_idx" ON "transaction_idempotency"("transaction_id", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_idempotency_owner_id_key_key" ON "transaction_idempotency"("owner_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_idempotency_transaction_id_owner_id_key" ON "transaction_idempotency"("transaction_id", "owner_id");

-- CreateIndex
CREATE INDEX "quarantined_financial_rows_owner_id_idx" ON "quarantined_financial_rows"("owner_id");

-- CreateIndex
CREATE INDEX "quarantined_financial_rows_migration_audit_id_idx" ON "quarantined_financial_rows"("migration_audit_id");

-- CreateIndex
CREATE UNIQUE INDEX "quarantined_financial_rows_source_table_source_id_key" ON "quarantined_financial_rows"("source_table", "source_id");

-- CreateIndex
CREATE INDEX "migration_audits_operator_id_idx" ON "migration_audits"("operator_id");

-- CreateIndex
CREATE INDEX "migration_audits_checksum_idx" ON "migration_audits"("checksum");

-- CreateIndex
CREATE INDEX "migration_audits_action_created_at_idx" ON "migration_audits"("action", "created_at");

-- AddForeignKey
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_owner_id_fkey" FOREIGN KEY ("account_id", "owner_id") REFERENCES "accounts"("id", "owner_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_idempotency" ADD CONSTRAINT "transaction_idempotency_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_idempotency" ADD CONSTRAINT "transaction_idempotency_transaction_id_owner_id_fkey" FOREIGN KEY ("transaction_id", "owner_id") REFERENCES "transactions"("id", "owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quarantined_financial_rows" ADD CONSTRAINT "quarantined_financial_rows_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quarantined_financial_rows" ADD CONSTRAINT "quarantined_financial_rows_migration_audit_id_fkey" FOREIGN KEY ("migration_audit_id") REFERENCES "migration_audits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "migration_audits" ADD CONSTRAINT "migration_audits_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "auth_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
