-- Users, roles, profiles (object permissions), sessions, invites
CREATE TABLE roles (
  id TEXT PRIMARY KEY,               -- 'admin' | 'manager' | 'rep' | custom
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES roles(id) -- role hierarchy: managers see their reps' records
);
CREATE TABLE profile_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id),
  object TEXT NOT NULL,              -- 'leads', 'accounts', ...
  can_read INTEGER NOT NULL DEFAULT 0,
  can_create INTEGER NOT NULL DEFAULT 0,
  can_edit INTEGER NOT NULL DEFAULT 0,
  can_delete INTEGER NOT NULL DEFAULT 0,
  view_all INTEGER NOT NULL DEFAULT 0, -- see records owned by anyone
  PRIMARY KEY (role_id, object)
);
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT,                -- null until the invite is accepted
  role_id TEXT NOT NULL REFERENCES roles(id),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,               -- sha-256 of the cookie token
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE TABLE invites (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL
);

-- Core CRM objects. Every record has an owner for record-level access.
CREATE TABLE accounts (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL, industry TEXT, website TEXT, phone TEXT, billing_city TEXT, billing_country TEXT,
  annual_revenue REAL, employees INTEGER, external_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE contacts (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
  account_id TEXT REFERENCES accounts(id),
  first_name TEXT, last_name TEXT NOT NULL, email TEXT, phone TEXT, title TEXT, external_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE leads (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
  first_name TEXT, last_name TEXT NOT NULL, company TEXT, email TEXT, phone TEXT,
  status TEXT NOT NULL DEFAULT 'Open', source TEXT,
  converted_contact_id TEXT REFERENCES contacts(id), external_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE opportunities (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
  account_id TEXT REFERENCES accounts(id),
  name TEXT NOT NULL, stage TEXT NOT NULL, amount REAL, close_date TEXT, probability INTEGER, external_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE cases (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
  account_id TEXT REFERENCES accounts(id), contact_id TEXT REFERENCES contacts(id),
  subject TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'New', priority TEXT NOT NULL DEFAULT 'Medium',
  external_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE tasks (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
  subject TEXT NOT NULL, due_date TEXT, status TEXT NOT NULL DEFAULT 'Not Started', priority TEXT NOT NULL DEFAULT 'Normal',
  related_object TEXT, related_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Activity timeline: calls, notes, emails, field changes
CREATE TABLE activities (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL, subject TEXT NOT NULL, body TEXT,
  related_object TEXT NOT NULL, related_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_activities_related ON activities(related_object, related_id, created_at);
CREATE INDEX idx_tasks_related ON tasks(related_object, related_id);
CREATE INDEX idx_leads_owner ON leads(owner_id);
CREATE INDEX idx_accounts_owner ON accounts(owner_id);
CREATE INDEX idx_contacts_owner ON contacts(owner_id);
CREATE INDEX idx_contacts_account ON contacts(account_id);
CREATE INDEX idx_opps_owner ON opportunities(owner_id);
CREATE INDEX idx_opps_stage ON opportunities(stage);
CREATE INDEX idx_cases_owner ON cases(owner_id);

-- Default roles and profiles
INSERT INTO roles (id, name, parent_id) VALUES ('admin','Administrator',NULL),('manager','Sales Manager','admin'),('rep','Sales Rep','manager');
WITH objs(o) AS (VALUES ('leads'),('accounts'),('contacts'),('opportunities'),('cases'),('tasks'),('activities'),('reports'))
INSERT INTO profile_permissions SELECT 'admin', o, 1,1,1,1,1 FROM objs
UNION ALL SELECT 'manager', o, 1,1,1,1,1 FROM objs
UNION ALL SELECT 'rep', o, 1,1,1,0,0 FROM objs;

-- Login throttling (per email + IP)
CREATE TABLE login_attempts (
  key TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start TEXT NOT NULL
);
