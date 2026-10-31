-- Counters only: never images, notes, prompts, responses or provider keys.
CREATE TABLE IF NOT EXISTS ai_free_owners(owner TEXT PRIMARY KEY, timezone TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ai_free_counts(scope TEXT NOT NULL, day TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0, calls INTEGER NOT NULL DEFAULT 0, errors INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(scope,day));
