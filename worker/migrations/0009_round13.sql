-- Admin tests are isolated from account usage, credits and user dashboards.
CREATE TABLE IF NOT EXISTS admin_ai_tests (
 request_id TEXT PRIMARY KEY, tag TEXT NOT NULL DEFAULT 'admin_test',
 engine TEXT NOT NULL, task TEXT NOT NULL, model TEXT NOT NULL,
 input_tokens INTEGER NOT NULL, output_tokens INTEGER NOT NULL,
 estimated_cost REAL NOT NULL, created INTEGER NOT NULL
);
