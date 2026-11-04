import { Hono, type Context, type Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { OBJECTS, RELATED, STAGES, CLOSED_STAGES, getObject, type ObjectDef } from "./objects";
import { can, canAccessRecord, visibility, type Permission } from "./rbac";
import { validateRecord } from "./validate";
import { hashPassword, verifyPassword, randomToken, sha256, newId } from "./crypto";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  CRM_NAME: string;
  BRAND_COLOR: string;
}

interface SessionUser {
  id: string;
  email: string;
  name: string;
  role_id: string;
}

type Vars = { user: SessionUser; perms: Permission[] };
type C = Context<{ Bindings: Env; Variables: Vars }>;

const SESSION_COOKIE = "crm_session";
const SESSION_DAYS = 7;
const INVITE_DAYS = 7;
const LOGIN_MAX = 10; // attempts per window
const LOGIN_WINDOW_MIN = 15;
const PAGE_MAX = 100;

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

// ---------- cross-cutting ----------
app.use("/api/*", async (c, next) => {
  // Mutations must be JSON: blocks form-based CSRF on top of SameSite=Strict cookies.
  if (!["GET", "HEAD"].includes(c.req.method) && !c.req.header("content-type")?.includes("application/json")) {
    return c.json({ error: "Content-Type must be application/json" }, 415);
  }
  await next();
  c.header("Cache-Control", "private, no-store");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "same-origin");
});

app.onError((err, c) => {
  console.error(JSON.stringify({ level: "error", path: c.req.path, message: err.message }));
  return c.json({ error: "Something went wrong" }, 500);
});

const body = async (c: C): Promise<Record<string, unknown>> => {
  try {
    const b = await c.req.json();
    return b && typeof b === "object" ? b : {};
  } catch {
    return {};
  }
};

async function loadPerms(db: D1Database, roleId: string): Promise<Permission[]> {
  const r = await db.prepare("SELECT object, can_read, can_create, can_edit, can_delete, view_all FROM profile_permissions WHERE role_id = ?").bind(roleId).all<Permission>();
  return r.results;
}

async function requireAuth(c: C, next: Next) {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: "Not signed in" }, 401);
  const user = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.role_id FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > datetime('now') AND u.active = 1`,
  ).bind(await sha256(token)).first<SessionUser>();
  if (!user) return c.json({ error: "Not signed in" }, 401);
  c.set("user", user);
  c.set("perms", await loadPerms(c.env.DB, user.role_id));
  await next();
}

const requireAdmin = async (c: C, next: Next) => {
  if (c.get("user").role_id !== "admin") return c.json({ error: "Forbidden" }, 403);
  await next();
};

async function startSession(c: C, userId: string) {
  const token = randomToken();
  await c.env.DB.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, datetime('now', '+${SESSION_DAYS} days'))`)
    .bind(await sha256(token), userId).run();
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true, secure: true, sameSite: "Strict", path: "/", maxAge: SESSION_DAYS * 86400,
  });
}

// ---------- auth ----------
app.post("/api/auth/login", async (c) => {
  const b = await body(c);
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  if (!email || !password || password.length > 200) return c.json({ error: "Invalid email or password" }, 400);

  const key = await sha256(`${email}|${c.req.header("cf-connecting-ip") ?? ""}`);
  const attempt = await c.env.DB.prepare(
    `INSERT INTO login_attempts (key, count, window_start) VALUES (?, 1, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN window_start < datetime('now', '-${LOGIN_WINDOW_MIN} minutes') THEN 1 ELSE count + 1 END,
       window_start = CASE WHEN window_start < datetime('now', '-${LOGIN_WINDOW_MIN} minutes') THEN datetime('now') ELSE window_start END
     RETURNING count`,
  ).bind(key).first<{ count: number }>();
  if ((attempt?.count ?? 0) > LOGIN_MAX) return c.json({ error: "Too many attempts. Try again later." }, 429);

  const user = await c.env.DB.prepare("SELECT id, password_hash FROM users WHERE email = ? AND active = 1")
    .bind(email).first<{ id: string; password_hash: string | null }>();
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ error: "Invalid email or password" }, 401);
  }
  await c.env.DB.prepare("DELETE FROM login_attempts WHERE key = ?").bind(key).run();
  await startSession(c as C, user.id);
  return c.json({ ok: true });
});

app.post("/api/auth/accept-invite", async (c) => {
  const b = await body(c);
  const token = String(b.token ?? "");
  const password = String(b.password ?? "");
  if (password.length < 10 || password.length > 200) return c.json({ error: "Password must be 10-200 characters" }, 400);
  const tokenHash = await sha256(token);
  const inv = await c.env.DB.prepare("SELECT user_id FROM invites WHERE token_hash = ? AND expires_at > datetime('now')")
    .bind(tokenHash).first<{ user_id: string }>();
  if (!inv) return c.json({ error: "This invite link is invalid or expired" }, 400);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(await hashPassword(password), inv.user_id),
    c.env.DB.prepare("DELETE FROM invites WHERE token_hash = ?").bind(tokenHash),
    c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(inv.user_id),
  ]);
  await startSession(c as C, inv.user_id);
  return c.json({ ok: true });
});

app.post("/api/auth/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await c.env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(await sha256(token)).run();
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: true });
  return c.json({ ok: true });
});

// Everything below requires a session.
app.use("/api/*", async (c, next) => {
  if (c.req.path.startsWith("/api/auth/") && c.req.path !== "/api/auth/me") return next();
  return requireAuth(c as C, next);
});

app.get("/api/auth/me", (c) => c.json({ user: c.get("user") }));

app.get("/api/meta", (c) => {
  const perms = c.get("perms");
  const objects = Object.fromEntries(
    Object.entries(OBJECTS).filter(([name]) => can(perms, name, "read")).map(([name, def]) => [name, def]),
  );
  return c.json({
    crm: { name: c.env.CRM_NAME, brandColor: c.env.BRAND_COLOR },
    user: c.get("user"),
    objects, related: RELATED, stages: STAGES, closedStages: CLOSED_STAGES,
    permissions: perms,
  });
});

// ---------- records ----------
const displayName = (def: ObjectDef, row: Record<string, unknown>) =>
  def.nameFields.map((f) => row[f]).filter(Boolean).join(" ");

function objectOr404(c: C): { name: string; def: ObjectDef } | null {
  const name = c.req.param("object") ?? "";
  const def = getObject(name);
  return def ? { name, def } : null;
}

app.get("/api/o/:object", async (c) => {
  const o = objectOr404(c as C);
  if (!o) return c.json({ error: "Not found" }, 404);
  const perms = c.get("perms"), user = c.get("user");
  if (!can(perms, o.name, "read")) return c.json({ error: "Forbidden" }, 403);

  const vis = visibility(perms, o.name, user.id);
  const where = [vis.sql];
  const params: (string | number)[] = [...vis.params];

  const q = (c.req.query("q") ?? "").trim().slice(0, 100);
  if (q) {
    const searchable = o.def.fields.filter((f) => ["text", "email", "phone"].includes(f.type)).map((f) => f.name);
    where.push(`(${searchable.map((f) => `${f} LIKE ?`).join(" OR ")})`);
    params.push(...searchable.map(() => `%${q.replace(/[%_]/g, "")}%`));
  }
  const filterField = c.req.query("field"), filterValue = c.req.query("value");
  if (filterField && filterValue !== undefined) {
    if (!o.def.fields.some((f) => f.name === filterField)) return c.json({ error: "Unknown field" }, 400);
    where.push(`${filterField} = ?`);
    params.push(filterValue);
  }
  const mine = c.req.query("scope") === "mine";
  if (mine) { where.push("owner_id = ?"); params.push(user.id); }

  const sortable = new Set(["created_at", "updated_at", ...o.def.fields.map((f) => f.name)]);
  const sort = sortable.has(c.req.query("sort") ?? "") ? c.req.query("sort")! : "updated_at";
  const dir = c.req.query("dir") === "asc" ? "ASC" : "DESC";
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 50, 1), PAGE_MAX);
  const offset = Math.max(Number(c.req.query("offset")) || 0, 0);

  const whereSql = where.join(" AND ");
  const [rows, total] = await c.env.DB.batch([
    c.env.DB.prepare(`SELECT * FROM ${o.def.table} WHERE ${whereSql} ORDER BY ${sort} ${dir} LIMIT ? OFFSET ?`).bind(...params, limit, offset),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM ${o.def.table} WHERE ${whereSql}`).bind(...params),
  ]);
  return c.json({ records: rows.results, total: (total.results[0] as { n: number }).n, limit, offset });
});

app.post("/api/o/:object", async (c) => {
  const o = objectOr404(c as C);
  if (!o) return c.json({ error: "Not found" }, 404);
  if (!can(c.get("perms"), o.name, "create")) return c.json({ error: "Forbidden" }, 403);
  const { values, errors } = validateRecord(o.def, await body(c as C));
  if (Object.keys(errors).length) return c.json({ error: "Validation failed", fields: errors }, 400);
  const id = newId();
  const cols = ["id", "owner_id", ...Object.keys(values)];
  await c.env.DB.prepare(`INSERT INTO ${o.def.table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`)
    .bind(id, c.get("user").id, ...Object.values(values)).run();
  return c.json({ id }, 201);
});

async function loadOwned(c: C, action: "read" | "edit" | "delete") {
  const o = objectOr404(c);
  if (!o) return { res: c.json({ error: "Not found" }, 404) };
  const row = await c.env.DB.prepare(`SELECT * FROM ${o.def.table} WHERE id = ?`).bind(c.req.param("id")).first<Record<string, unknown>>();
  // Same 404 for missing and not-allowed so record ids can't be probed (no IDOR).
  if (!row || !canAccessRecord(c.get("perms"), o.name, action, c.get("user").id, String(row.owner_id))) {
    return { res: c.json({ error: "Not found" }, 404) };
  }
  return { o, row };
}

app.get("/api/o/:object/:id", async (c) => {
  const r = await loadOwned(c as C, "read");
  if (r.res) return r.res;
  const { o, row } = r;
  const perms = c.get("perms"), user = c.get("user");

  // Resolve lookup names.
  const lookups: Record<string, { id: string; name: string; object: string } | null> = {};
  for (const f of o.def.fields.filter((f) => f.type === "lookup" && f.lookup)) {
    const id = row[f.name];
    if (!id || !can(perms, f.lookup!, "read")) { lookups[f.name] = null; continue; }
    const target = getObject(f.lookup!)!;
    const tv = visibility(perms, f.lookup!, user.id);
    const t = await c.env.DB.prepare(`SELECT * FROM ${target.table} WHERE id = ? AND ${tv.sql}`).bind(id, ...tv.params).first<Record<string, unknown>>();
    lookups[f.name] = t ? { id: String(id), name: displayName(target, t), object: f.lookup! } : null;
  }

  // Related lists (respecting visibility).
  const related: Record<string, unknown[]> = {};
  for (const rel of RELATED[o.name] ?? []) {
    if (!can(perms, rel.object, "read")) continue;
    const vis = visibility(perms, rel.object, user.id);
    const def = getObject(rel.object)!;
    const res = await c.env.DB.prepare(`SELECT * FROM ${def.table} WHERE ${rel.field} = ? AND ${vis.sql} ORDER BY updated_at DESC LIMIT 20`)
      .bind(row.id, ...vis.params).all();
    related[rel.object] = res.results;
  }

  const timeline = can(perms, "activities", "read")
    ? (await c.env.DB.prepare("SELECT * FROM activities WHERE related_object = ? AND related_id = ? ORDER BY created_at DESC LIMIT 50").bind(o.name, row.id).all()).results
    : [];
  const tasks = can(perms, "tasks", "read")
    ? (await c.env.DB.prepare("SELECT * FROM tasks WHERE related_object = ? AND related_id = ? ORDER BY due_date").bind(o.name, row.id).all()).results
    : [];
  const owner = await c.env.DB.prepare("SELECT id, name FROM users WHERE id = ?").bind(row.owner_id).first();

  return c.json({ record: row, name: displayName(o.def, row), lookups, related, timeline, tasks, owner });
});

app.patch("/api/o/:object/:id", async (c) => {
  const r = await loadOwned(c as C, "edit");
  if (r.res) return r.res;
  const { values, errors } = validateRecord(r.o.def, await body(c as C), true);
  if (Object.keys(errors).length) return c.json({ error: "Validation failed", fields: errors }, 400);
  const keys = Object.keys(values);
  if (!keys.length) return c.json({ ok: true });
  await c.env.DB.prepare(`UPDATE ${r.o.def.table} SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...Object.values(values), r.row.id).run();
  return c.json({ ok: true });
});

app.delete("/api/o/:object/:id", async (c) => {
  const r = await loadOwned(c as C, "delete");
  if (r.res) return r.res;
  await c.env.DB.prepare(`DELETE FROM ${r.o.def.table} WHERE id = ?`).bind(r.row.id).run();
  return c.json({ ok: true });
});

// Lead conversion: Lead -> Account + Contact (+ optional Opportunity).
app.post("/api/leads/:id/convert", async (c) => {
  const perms = c.get("perms"), user = c.get("user");
  const lead = await c.env.DB.prepare("SELECT * FROM leads WHERE id = ?").bind(c.req.param("id")).first<Record<string, string | null>>();
  if (!lead || !canAccessRecord(perms, "leads", "edit", user.id, String(lead.owner_id))) return c.json({ error: "Not found" }, 404);
  if (lead.converted_contact_id) return c.json({ error: "Lead is already converted" }, 409);
  if (!can(perms, "accounts", "create") || !can(perms, "contacts", "create")) return c.json({ error: "Forbidden" }, 403);

  const b = await body(c as C);
  const accountId = newId(), contactId = newId();
  const stmts = [
    c.env.DB.prepare("INSERT INTO accounts (id, owner_id, name, phone) VALUES (?, ?, ?, ?)")
      .bind(accountId, user.id, lead.company || `${lead.last_name} (Individual)`, lead.phone),
    c.env.DB.prepare("INSERT INTO contacts (id, owner_id, account_id, first_name, last_name, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(contactId, user.id, accountId, lead.first_name, lead.last_name, lead.email, lead.phone),
    c.env.DB.prepare("UPDATE leads SET status = 'Qualified', converted_contact_id = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(contactId, lead.id),
  ];
  let opportunityId: string | null = null;
  if (b.createOpportunity && can(perms, "opportunities", "create")) {
    opportunityId = newId();
    stmts.push(c.env.DB.prepare("INSERT INTO opportunities (id, owner_id, account_id, name, stage) VALUES (?, ?, ?, ?, ?)")
      .bind(opportunityId, user.id, accountId, `${lead.company || lead.last_name} - New Business`, STAGES[0]));
  }
  await c.env.DB.batch(stmts);
  return c.json({ accountId, contactId, opportunityId });
});

// ---------- reports ----------
app.get("/api/reports/summary", async (c) => {
  const perms = c.get("perms"), user = c.get("user");
  if (!can(perms, "reports", "read")) return c.json({ error: "Forbidden" }, 403);
  const out: Record<string, unknown> = {};
  if (can(perms, "opportunities", "read")) {
    const v = visibility(perms, "opportunities", user.id);
    out.pipeline = (await c.env.DB.prepare(`SELECT stage, COUNT(*) AS count, COALESCE(SUM(amount),0) AS amount FROM opportunities WHERE ${v.sql} GROUP BY stage`).bind(...v.params).all()).results;
    out.byMonth = (await c.env.DB.prepare(`SELECT substr(close_date,1,7) AS month, COALESCE(SUM(amount),0) AS amount FROM opportunities WHERE stage = 'Closed Won' AND close_date IS NOT NULL AND ${v.sql} GROUP BY month ORDER BY month DESC LIMIT 12`).bind(...v.params).all()).results;
  }
  if (can(perms, "leads", "read")) {
    const v = visibility(perms, "leads", user.id);
    out.leadsByStatus = (await c.env.DB.prepare(`SELECT status, COUNT(*) AS count FROM leads WHERE ${v.sql} GROUP BY status`).bind(...v.params).all()).results;
  }
  if (can(perms, "cases", "read")) {
    const v = visibility(perms, "cases", user.id);
    out.casesByStatus = (await c.env.DB.prepare(`SELECT status, COUNT(*) AS count FROM cases WHERE ${v.sql} GROUP BY status`).bind(...v.params).all()).results;
  }
  if (can(perms, "tasks", "read")) {
    out.myOpenTasks = (await c.env.DB.prepare("SELECT * FROM tasks WHERE owner_id = ? AND status != 'Completed' ORDER BY due_date LIMIT 10").bind(user.id).all()).results;
  }
  return c.json(out);
});

// ---------- user management (admin) ----------
app.use("/api/admin/*", (c, next) => requireAdmin(c as C, next));

app.get("/api/admin/users", async (c) => {
  const users = await c.env.DB.prepare("SELECT id, email, name, role_id, active, created_at, password_hash IS NOT NULL AS activated FROM users ORDER BY created_at").all();
  const roles = await c.env.DB.prepare("SELECT id, name, parent_id FROM roles").all();
  return c.json({ users: users.results, roles: roles.results });
});

app.post("/api/admin/users", async (c) => {
  const b = await body(c as C);
  const email = String(b.email ?? "").trim().toLowerCase();
  const name = String(b.name ?? "").trim().slice(0, 100);
  const role = String(b.role_id ?? "rep");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) return c.json({ error: "Name and a valid email are required" }, 400);
  if (!(await c.env.DB.prepare("SELECT 1 FROM roles WHERE id = ?").bind(role).first())) return c.json({ error: "Unknown role" }, 400);
  if (await c.env.DB.prepare("SELECT 1 FROM users WHERE email = ?").bind(email).first()) return c.json({ error: "A user with this email already exists" }, 409);
  const id = newId(), token = randomToken();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO users (id, email, name, role_id) VALUES (?, ?, ?, ?)").bind(id, email, name, role),
    c.env.DB.prepare(`INSERT INTO invites (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', '+${INVITE_DAYS} days'))`).bind(await sha256(token), id),
  ]);
  // The link is shown once to the admin (and emailed, when the email module is enabled).
  return c.json({ id, inviteUrl: `${new URL(c.req.url).origin}/invite/${token}` }, 201);
});

app.patch("/api/admin/users/:id", async (c) => {
  const b = await body(c as C);
  const id = c.req.param("id");
  if (id === c.get("user").id && (b.active === false || (b.role_id && b.role_id !== "admin"))) {
    return c.json({ error: "You can't deactivate or demote yourself" }, 400);
  }
  if (b.role_id !== undefined) {
    if (!(await c.env.DB.prepare("SELECT 1 FROM roles WHERE id = ?").bind(String(b.role_id)).first())) return c.json({ error: "Unknown role" }, 400);
    await c.env.DB.prepare("UPDATE users SET role_id = ? WHERE id = ?").bind(String(b.role_id), id).run();
  }
  if (typeof b.active === "boolean") {
    await c.env.DB.prepare("UPDATE users SET active = ? WHERE id = ?").bind(b.active ? 1 : 0, id).run();
    if (!b.active) await c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id).run();
  }
  return c.json({ ok: true });
});

app.get("/api/admin/permissions", async (c) => {
  const r = await c.env.DB.prepare("SELECT * FROM profile_permissions ORDER BY role_id, object").all();
  return c.json({ permissions: r.results });
});

app.put("/api/admin/permissions/:role/:object", async (c) => {
  const { role, object } = c.req.param();
  if (role === "admin") return c.json({ error: "The Administrator profile can't be changed" }, 400);
  const exists = await c.env.DB.prepare("SELECT 1 FROM profile_permissions WHERE role_id = ? AND object = ?").bind(role, object).first();
  if (!exists) return c.json({ error: "Not found" }, 404);
  const b = await body(c as C);
  const flag = (k: string) => (b[k] ? 1 : 0);
  await c.env.DB.prepare("UPDATE profile_permissions SET can_read=?, can_create=?, can_edit=?, can_delete=?, view_all=? WHERE role_id=? AND object=?")
    .bind(flag("can_read"), flag("can_create"), flag("can_edit"), flag("can_delete"), flag("view_all"), role, object).run();
  return c.json({ ok: true });
});

app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

// Everything else: the React app.
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
