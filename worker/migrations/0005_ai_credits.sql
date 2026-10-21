CREATE TABLE ai_credits(owner TEXT NOT NULL, period_start TEXT NOT NULL, granted INT NOT NULL CHECK(granted>=0), used INT NOT NULL DEFAULT 0 CHECK(used>=0 AND used<=granted), PRIMARY KEY(owner,period_start));
CREATE TABLE ai_topups(id TEXT PRIMARY KEY, owner TEXT NOT NULL, credits INT NOT NULL CHECK(credits>=0), used INT NOT NULL DEFAULT 0 CHECK(used>=0 AND used<=credits), expires TEXT NOT NULL);
CREATE INDEX ai_topups_owner ON ai_topups(owner,expires);
CREATE TABLE ai_usage(id TEXT PRIMARY KEY, owner TEXT NOT NULL, feature TEXT NOT NULL, model TEXT NOT NULL, input_tokens INT, output_tokens INT, cache_read INT, cache_write INT, cost_usd REAL, credits INT, created TEXT NOT NULL);
CREATE INDEX ai_usage_created ON ai_usage(created,owner);
-- Durable allocation receipts make both reservation and refund atomic and idempotent.
CREATE TABLE ai_reservations(id TEXT PRIMARY KEY, owner TEXT NOT NULL, allocations TEXT NOT NULL, refunded INT NOT NULL DEFAULT 0, created TEXT NOT NULL);
CREATE TRIGGER ai_reserve AFTER INSERT ON ai_reservations BEGIN
 UPDATE ai_credits SET used=used+COALESCE((SELECT json_extract(value,'$.amount') FROM json_each(NEW.allocations) WHERE json_extract(value,'$.kind')='period' AND json_extract(value,'$.id')=period_start),0) WHERE owner=NEW.owner;
 UPDATE ai_topups SET used=used+COALESCE((SELECT json_extract(value,'$.amount') FROM json_each(NEW.allocations) WHERE json_extract(value,'$.kind')='topup' AND json_extract(value,'$.id')=ai_topups.id),0) WHERE owner=NEW.owner;
END;
CREATE TRIGGER ai_refund AFTER UPDATE OF refunded ON ai_reservations WHEN OLD.refunded=0 AND NEW.refunded=1 BEGIN
 UPDATE ai_credits SET used=used-COALESCE((SELECT json_extract(value,'$.amount') FROM json_each(NEW.allocations) WHERE json_extract(value,'$.kind')='period' AND json_extract(value,'$.id')=period_start),0) WHERE owner=NEW.owner;
 UPDATE ai_topups SET used=used-COALESCE((SELECT json_extract(value,'$.amount') FROM json_each(NEW.allocations) WHERE json_extract(value,'$.kind')='topup' AND json_extract(value,'$.id')=ai_topups.id),0) WHERE owner=NEW.owner;
END;
CREATE TABLE ai_limits(owner TEXT NOT NULL, bucket INT NOT NULL, count INT NOT NULL, PRIMARY KEY(owner,bucket));
CREATE TABLE ai_events(id TEXT PRIMARY KEY,owner TEXT NOT NULL,kind TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE ai_periods(owner TEXT PRIMARY KEY, start INT NOT NULL);

-- Freeze purchased credit amounts and link guest top-ups to their existing wallet.
ALTER TABLE orders ADD COLUMN ai_owner TEXT;
ALTER TABLE orders ADD COLUMN ai_credits INT;
ALTER TABLE orders ADD COLUMN ai_valid_days INT;
