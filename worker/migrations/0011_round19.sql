CREATE TABLE IF NOT EXISTS usage_daily(date TEXT NOT NULL,name TEXT NOT NULL,dim TEXT NOT NULL,value TEXT NOT NULL,count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(date,name,dim,value));
CREATE TABLE IF NOT EXISTS usage_actives(date TEXT NOT NULL,install_hash TEXT NOT NULL,PRIMARY KEY(date,install_hash));
CREATE TABLE IF NOT EXISTS usage_installs(install_hash TEXT PRIMARY KEY,first_seen TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS usage_first_seen ON usage_installs(first_seen);
CREATE TABLE IF NOT EXISTS usage_milestones(install_hash TEXT NOT NULL,name TEXT NOT NULL,date TEXT NOT NULL,PRIMARY KEY(install_hash,name));
CREATE TABLE IF NOT EXISTS usage_snapshot(date TEXT PRIMARY KEY,json TEXT NOT NULL);
