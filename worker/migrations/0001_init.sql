PRAGMA foreign_keys = ON;
CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, pass_hash TEXT NOT NULL, pass_salt TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','trainer')), created_at INTEGER NOT NULL);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE user_state (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, json TEXT NOT NULL, updated_at INTEGER NOT NULL, version INTEGER NOT NULL);
CREATE TABLE trainer_links (trainer_id TEXT NOT NULL REFERENCES users(id), client_id TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(trainer_id,client_id));
CREATE TABLE invites (code TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
CREATE TABLE notes (id TEXT PRIMARY KEY, trainer_id TEXT NOT NULL REFERENCES users(id), client_id TEXT NOT NULL REFERENCES users(id), text TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX notes_pair ON notes(trainer_id,client_id,created_at);
