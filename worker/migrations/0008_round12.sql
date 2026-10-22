CREATE TABLE auth_tokens(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX auth_tokens_user ON auth_tokens(user_id,kind);
CREATE TABLE email_verifications(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, verified INTEGER NOT NULL DEFAULT 0);
CREATE TABLE session_activity(token_hash TEXT PRIMARY KEY REFERENCES sessions(token_hash) ON DELETE CASCADE, created INTEGER NOT NULL, last_used INTEGER NOT NULL, family TEXT NOT NULL);
CREATE TABLE security_limits(key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE admin_recovery(code_hash TEXT PRIMARY KEY);
CREATE TRIGGER suspend_sessions AFTER UPDATE OF suspended ON profiles WHEN NEW.suspended=1 BEGIN DELETE FROM sessions WHERE user_id=NEW.user_id; END;
