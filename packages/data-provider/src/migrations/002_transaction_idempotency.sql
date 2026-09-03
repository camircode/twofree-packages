CREATE TABLE transaction_idempotency (
  idempotency_key TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE
);
