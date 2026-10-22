CREATE TABLE ideas(id TEXT PRIMARY KEY, owner TEXT NOT NULL, title TEXT NOT NULL, detail TEXT NOT NULL, category TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created INTEGER NOT NULL, merged_into TEXT);
CREATE TABLE idea_votes(idea_id TEXT NOT NULL REFERENCES ideas(id), owner TEXT NOT NULL, weight INTEGER NOT NULL CHECK(weight IN (1,2)), PRIMARY KEY(idea_id,owner));
CREATE TABLE donations(id TEXT PRIMARY KEY, owner TEXT NOT NULL, amount REAL NOT NULL CHECK(amount>=1), currency TEXT NOT NULL, method TEXT NOT NULL, created INTEGER NOT NULL, note TEXT NOT NULL DEFAULT '', ref TEXT UNIQUE);
CREATE TABLE supporters(owner TEXT PRIMARY KEY, amount REAL NOT NULL, created INTEGER NOT NULL);
CREATE TABLE supporter_codes(code_hash TEXT PRIMARY KEY, amount REAL NOT NULL, created INTEGER NOT NULL, claimed_by TEXT);
CREATE INDEX ideas_owner_created ON ideas(owner,created);
CREATE INDEX donations_created ON donations(created);
-- A transfer cannot fund both a purchase and a donation, even concurrently.
CREATE TRIGGER donation_replay BEFORE INSERT ON donations WHEN NEW.ref IS NOT NULL AND EXISTS(SELECT 1 FROM payments WHERE method='promptpay' AND ref=NEW.ref) BEGIN SELECT RAISE(ABORT,'Transfer already used'); END;
CREATE TRIGGER payment_donation_replay BEFORE INSERT ON payments WHEN NEW.method='promptpay' AND EXISTS(SELECT 1 FROM donations WHERE ref=NEW.ref) BEGIN SELECT RAISE(ABORT,'Transfer already used'); END;
