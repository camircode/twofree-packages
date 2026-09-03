CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('debit', 'yield', 'revolving-credit', 'charge-card')),
  label TEXT NOT NULL,
  currency TEXT NOT NULL,
  metadata JSONB NOT NULL,
  created_at TEXT NOT NULL,
  statement_balance_coefficient TEXT,
  statement_balance_scale INTEGER,
  CHECK ((statement_balance_coefficient IS NULL) = (statement_balance_scale IS NULL)),
  CHECK (statement_balance_coefficient IS NULL OR statement_balance_coefficient ~ '^-?(0|[1-9][0-9]*)$'),
  CHECK (statement_balance_scale IS NULL OR statement_balance_scale >= 0)
);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount_coefficient TEXT NOT NULL CHECK (amount_coefficient ~ '^-?(0|[1-9][0-9]*)$'),
  amount_scale INTEGER NOT NULL CHECK (amount_scale >= 0),
  amount_currency TEXT NOT NULL,
  metadata JSONB NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX transactions_account_id_idx ON transactions(account_id);
