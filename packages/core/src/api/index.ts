import { Hono, type Context, type Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import {
  OBJECTS, OPPORTUNITY_STAGES, NAV, LEAD_CONVERTED_STATUS, CASE_CLOSED_STATUSES, TASK_CLOSED_STATUSES,
  allFields, childRelationships, getObject, nameFieldOf, objectForId, stageByName,
  type SObjectDef, type Sharing,
} from "./objects.js";
import { can, canAccessRecord, readFilter, subordinateRoleIds, type ObjectPermission, type SecurityContext } from "./rbac.js";
import { validateRecord, type FieldError, type Values } from "./validate.js";
import { hashPassword, verifyPassword, randomToken, sha256 } from "./crypto.js";
import { newId, normalizeId } from "./ids.js";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  CRM_NAME: string;
  BRAND_COLOR: string;
}

interface CurrentUser {
  Id: string; Name: string; Email: string; Username: string; ProfileId: string; UserRoleId: string | null;
  ProfileName: string; PermissionsModifyAllData: number; PermissionsViewAllData: number; PermissionsManageUsers: number;
}
type Vars = { user: CurrentUser; sec: SecurityContext };
type C = Context<{ Bindings: Env; Variables: Vars }>;

const API_VERSION = "v1.0";
const SESSION_COOKIE = "crm_session";
const SESSION_DAYS = 7;
const INVITE_DAYS = 7;
const LOGIN_MAX = 10;
const LOGIN_WINDOW_MIN = 15;
const PAGE_MAX = 200;
const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

// ---------- helpers ----------
/** Salesforce REST error body: an array of { message, errorCode, fields }. */
const sfError = (c: Context, status: number, errorCode: string, message: string, fields: string[] = []) =>
  c.json([{ message, errorCode, fields }], status as 400);
const sfErrors = (c: Context, errors: FieldError[]) => c.json(errors, 400);
const notFound = (c: Context) => sfError(c, 404, "NOT_FOUND", "The requested resource does not exist");

const body = async (c: Context): Promise<Record<string, unknown>> => {
  try {
    const b = await c.req.json();
    return b && typeof b === "object" && !Array.isArray(b) ? b : {};
  } catch {
    return {};
  }
};

const masterOf = (def: SObjectDef) => {
  const f = def.fields.find((x) => x.cascadeDelete && x.referenceTo?.length === 1);
  const master = f ? getObject(f.referenceTo![0]!) : null;
  return f && master ? { master, field: f.name } : null;
};

/** Convert a DB row into an API record: booleans as true/false, plus Salesforce `attributes`. */
function toRecord(def: SObjectDef, row: Record<string, unknown>) {
  const out: Record<string, unknown> = { attributes: { type: def.name, url: `/api/sobjects/${def.name}/${row.Id}` } };
  for (const f of allFields(def)) {
    if (!(f.name in row)) continue;
    out[f.name] = f.type === "boolean" ? Boolean(row[f.name]) : row[f.name];
  }
  return out;
}

const tbl = (def: SObjectDef) => `"${def.name}"`;

// ---------- cross-cutting ----------
app.use("/api/*", async (c, next) => {
  // Mutations must be JSON: blocks form-based CSRF on top of SameSite=Strict cookies.
  if (!["GET", "HEAD"].includes(c.req.method) && !c.req.header("content-type")?.includes("application/json")) {
    return sfError(c, 415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json");
  }
  await next();
  c.header("Cache-Control", "private, no-store");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "same-origin");
});

app.onError((err, c) => {
  console.error(JSON.stringify({ level: "error", path: c.req.path, message: err.message }));
  return sfError(c, 500, "UNKNOWN_EXCEPTION", "An unexpected error occurred");
});

async function loadSecurity(db: D1Database, user: CurrentUser): Promise<SecurityContext> {
  const [perms, owd, roles, users] = await db.batch([
    db.prepare(`SELECT "SobjectType", "PermissionsRead", "PermissionsCreate", "PermissionsEdit", "PermissionsDelete", "PermissionsViewAllRecords", "PermissionsModifyAllRecords" FROM "ObjectPermissions" WHERE "ParentId" = ?`).bind(user.ProfileId),
    db.prepare(`SELECT "SobjectType", "Access" FROM "OrgWideDefault"`),
    db.prepare(`SELECT "Id", "ParentRoleId" FROM "UserRole"`),
    db.prepare(`SELECT "Id", "UserRoleId" FROM "User" WHERE "UserRoleId" IS NOT NULL`),
  ]);
  const below = new Set(subordinateRoleIds(roles.results as { Id: string; ParentRoleId: string | null }[], user.UserRoleId));
  const visible = (users.results as { Id: string; UserRoleId: string }[]).filter((u) => below.has(u.UserRoleId)).map((u) => u.Id);
  return {
    userId: user.Id,
    modifyAllData: !!user.PermissionsModifyAllData,
    perms: perms.results as unknown as ObjectPermission[],
    sharing: Object.fromEntries((owd.results as { SobjectType: string; Access: Sharing }[]).map((r) => [r.SobjectType, r.Access])),
    visibleOwnerIds: [user.Id, ...visible],
  };
}

async function requireAuth(c: C, next: Next) {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return sfError(c, 401, "INVALID_SESSION_ID", "Session expired or invalid");
  const user = await c.env.DB.prepare(
    `SELECT u."Id", u."Name", u."Email", u."Username", u."ProfileId", u."UserRoleId", p."Name" AS "ProfileName",
            p."PermissionsModifyAllData", p."PermissionsViewAllData", p."PermissionsManageUsers"
     FROM "_session" s JOIN "User" u ON u."Id" = s."user_id" JOIN "Profile" p ON p."Id" = u."ProfileId"
     WHERE s."id" = ? AND s."expires_at" > ${NOW} AND u."IsActive" = 1`,
  ).bind(await sha256(token)).first<CurrentUser>();
  if (!user) return sfError(c, 401, "INVALID_SESSION_ID", "Session expired or invalid");
  c.set("user", user);
  c.set("sec", await loadSecurity(c.env.DB, user));
  await next();
}

async function startSession(c: C, userId: string) {
  const token = randomToken();
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO "_session" ("id", "user_id", "expires_at") VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+${SESSION_DAYS} days'))`).bind(await sha256(token), userId),
    c.env.DB.prepare(`UPDATE "User" SET "LastLoginDate" = ${NOW} WHERE "Id" = ?`).bind(userId),
  ]);
  setCookie(c, SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: "Strict", path: "/", maxAge: SESSION_DAYS * 86400 });
}

// ---------- auth ----------
app.post("/api/auth/login", async (c) => {
  const b = await body(c);
  const username = String(b.username ?? b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  if (!username || !password || password.length > 200) return sfError(c, 400, "INVALID_LOGIN", "Invalid username or password");

  const key = await sha256(`${username}|${c.req.header("cf-connecting-ip") ?? ""}`);
  const attempt = await c.env.DB.prepare(
    `INSERT INTO "_login_attempt" ("key", "count", "window_start") VALUES (?, 1, ${NOW})
     ON CONFLICT("key") DO UPDATE SET
       "count" = CASE WHEN "window_start" < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-${LOGIN_WINDOW_MIN} minutes') THEN 1 ELSE "count" + 1 END,
       "window_start" = CASE WHEN "window_start" < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-${LOGIN_WINDOW_MIN} minutes') THEN ${NOW} ELSE "window_start" END
     RETURNING "count"`,
  ).bind(key).first<{ count: number }>();
  if ((attempt?.count ?? 0) > LOGIN_MAX) return sfError(c, 429, "LOGIN_RATE_EXCEEDED", "Too many login attempts. Try again later.");

  const user = await c.env.DB.prepare(`SELECT "Id", "PasswordHash" FROM "User" WHERE "Username" = ? AND "IsActive" = 1`)
    .bind(username).first<{ Id: string; PasswordHash: string | null }>();
  if (!user || !(await verifyPassword(password, user.PasswordHash))) return sfError(c, 401, "INVALID_LOGIN", "Invalid username or password");
  await c.env.DB.prepare(`DELETE FROM "_login_attempt" WHERE "key" = ?`).bind(key).run();
  await startSession(c as C, user.Id);
  return c.json({ success: true });
});

app.post("/api/auth/accept-invite", async (c) => {
  const b = await body(c);
  const password = String(b.password ?? "");
  if (password.length < 10 || password.length > 200) return sfError(c, 400, "INVALID_NEW_PASSWORD", "Password must be 10-200 characters", ["password"]);
  const tokenHash = await sha256(String(b.token ?? ""));
  const inv = await c.env.DB.prepare(`SELECT "user_id" FROM "_invite" WHERE "token_hash" = ? AND "expires_at" > ${NOW}`).bind(tokenHash).first<{ user_id: string }>();
  if (!inv) return sfError(c, 400, "INVALID_INVITE", "This invite link is invalid or expired");
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE "User" SET "PasswordHash" = ?, "LastModifiedDate" = ${NOW} WHERE "Id" = ?`).bind(await hashPassword(password), inv.user_id),
    c.env.DB.prepare(`DELETE FROM "_invite" WHERE "token_hash" = ?`).bind(tokenHash),
    c.env.DB.prepare(`DELETE FROM "_session" WHERE "user_id" = ?`).bind(inv.user_id),
  ]);
  await startSession(c as C, inv.user_id);
  return c.json({ success: true });
});

app.post("/api/auth/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await c.env.DB.prepare(`DELETE FROM "_session" WHERE "id" = ?`).bind(await sha256(token)).run();
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: true });
  return c.json({ success: true });
});

// Everything below requires a session.
app.use("/api/*", async (c, next) => {
  if (c.req.path.startsWith("/api/auth/") && c.req.path !== "/api/auth/me") return next();
  return requireAuth(c as C, next);
});

app.get("/api/auth/me", (c) => c.json({ user: c.get("user") }));

// ---------- describe ----------
/** describeGlobal: objects the user can read. */
app.get("/api/sobjects", (c) => {
  const sec = c.get("sec");
  return c.json({
    crm: { name: c.env.CRM_NAME, brandColor: c.env.BRAND_COLOR },
    user: c.get("user"),
    stages: OPPORTUNITY_STAGES,
    nav: NAV.filter((n) => can(sec, n, "read")),
    sobjects: Object.values(OBJECTS).filter((d) => can(sec, d.name, "read")).map((d) => ({
      name: d.name, label: d.label, labelPlural: d.labelPlural, keyPrefix: d.keyPrefix, custom: d.name.endsWith("__c"),
      queryable: true, createable: can(sec, d.name, "create"), updateable: can(sec, d.name, "edit"), deletable: can(sec, d.name, "delete"),
    })),
  });
});

app.get("/api/sobjects/:type/describe", (c) => {
  const def = getObject(c.req.param("type"));
  const sec = c.get("sec");
  if (!def || !can(sec, def.name, "read")) return notFound(c);
  return c.json({
    name: def.name, label: def.label, labelPlural: def.labelPlural, keyPrefix: def.keyPrefix, custom: def.name.endsWith("__c"),
    nameField: nameFieldOf(def), listFields: def.listFields, highlightFields: def.highlightFields,
    createable: can(sec, def.name, "create"), updateable: can(sec, def.name, "edit"), deletable: can(sec, def.name, "delete"),
    sharingModel: sec.sharing[def.name] ?? def.defaultSharing,
    fields: allFields(def).map((f) => ({
      name: f.name, label: f.label, type: f.type, nillable: !f.required, length: f.length ?? null,
      createable: f.createable !== false && !f.calculated, updateable: f.updateable !== false && !f.calculated, calculated: !!f.calculated,
      picklistValues: (f.picklistValues ?? []).map((v) => ({ value: v, label: v, active: true })),
      referenceTo: f.referenceTo ?? [], relationshipName: f.relationshipName ?? null, cascadeDelete: !!f.cascadeDelete,
    })),
    childRelationships: childRelationships(def.name).filter((r) => can(sec, r.childSObject, "read")),
  });
});

// ---------- record CRUD ----------
function typeOr404(c: C): SObjectDef | null {
  return getObject(c.req.param("type") ?? "");
}

/** List records (a "list view"), with search, sort, filter by one field, and paging. */
app.get("/api/sobjects/:type", async (c) => {
  const def = typeOr404(c as C);
  const sec = c.get("sec");
  if (!def || !can(sec, def.name, "read")) return notFound(c);

  const vis = readFilter(sec, def, masterOf);
  const where = [`"IsDeleted" = 0`, vis.sql];
  const params: (string | number)[] = [...vis.params];

  const q = (c.req.query("q") ?? "").trim().slice(0, 100).replace(/[%_]/g, "");
  if (q) {
    where.push(`(${def.searchFields.map((f) => `"${f}" LIKE ?`).join(" OR ")})`);
    params.push(...def.searchFields.map(() => `%${q}%`));
  }
  const field = c.req.query("field");
  const value = c.req.query("value");
  if (field && value !== undefined) {
    if (!allFields(def).some((f) => f.name === field)) return sfError(c, 400, "INVALID_FIELD", `No such column '${field}' on entity '${def.name}'`, [field]);
    where.push(`"${field}" = ?`);
    params.push(value);
  }
  if (c.req.query("scope") === "mine" && def.ownerable) { where.push(`"OwnerId" = ?`); params.push(sec.userId); }
  if (c.req.query("scope") === "open") {
    if (def.fields.some((f) => f.name === "IsClosed")) where.push(`"IsClosed" = 0`);
    if (def.name === "Lead") where.push(`"IsConverted" = 0`);
  }

  const sortable = new Set(allFields(def).map((f) => f.name));
  const sort = sortable.has(c.req.query("sort") ?? "") ? c.req.query("sort")! : "LastModifiedDate";
  const dir = c.req.query("dir") === "asc" ? "ASC" : "DESC";
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 50, 1), PAGE_MAX);
  const offset = Math.max(Number(c.req.query("offset")) || 0, 0);

  const whereSql = where.join(" AND ");
  const [rows, total] = await c.env.DB.batch([
    c.env.DB.prepare(`SELECT * FROM ${tbl(def)} WHERE ${whereSql} ORDER BY "${sort}" ${dir}, "Id" LIMIT ? OFFSET ?`).bind(...params, limit, offset),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM ${tbl(def)} WHERE ${whereSql}`).bind(...params),
  ]);
  const records = (rows.results as Record<string, unknown>[]).map((r) => toRecord(def, r));
  const totalSize = (total.results[0] as { n: number }).n;
  return c.json({ totalSize, done: offset + records.length >= totalSize, records, names: await lookupNames(c as C, def, records) });
});

/** Load a record and check record-level access (detail records check their master). Same 404 for missing and forbidden. */
async function loadAccessible(c: C, def: SObjectDef, id: string, action: "read" | "edit" | "delete"): Promise<Record<string, unknown> | null> {
  const sec = c.get("sec");
  if (!can(sec, def.name, action)) return null;
  const row = await c.env.DB.prepare(`SELECT * FROM ${tbl(def)} WHERE "Id" = ? AND "IsDeleted" = 0`).bind(id).first<Record<string, unknown>>();
  if (!row) return null;
  if (def.ownerable) return canAccessRecord(sec, def, action, String(row.OwnerId)) ? row : null;
  const m = masterOf(def);
  if (!m) return null;
  // Controlled by parent: read on child needs read on master; edit/delete on child needs edit on master.
  const master = await loadAccessible(c, m.master, String(row[m.field]), action === "read" ? "read" : "edit");
  return master ? row : null;
}

/** Check that every reference value points at an existing record the user can read. */
async function checkReferences(c: C, def: SObjectDef, values: Values): Promise<FieldError[]> {
  const errors: FieldError[] = [];
  for (const f of def.fields.filter((x) => x.type === "reference")) {
    const id = values[f.name];
    if (typeof id !== "string") continue;
    const target = objectForId(id);
    if (!target || !(await loadAccessible(c, target, id, "read"))) {
      errors.push({ message: `${f.label}: invalid cross reference id`, errorCode: "INVALID_CROSS_REFERENCE_KEY", fields: [f.name] });
    }
  }
  return errors;
}

/** Derived fields Salesforce maintains automatically (IsClosed, IsWon, Probability defaults, ClosedDate). */
function applyDerived(def: SObjectDef, values: Values, existing?: Record<string, unknown>) {
  if (def.name === "Opportunity" && typeof values.StageName === "string") {
    const st = stageByName(values.StageName)!;
    values.IsClosed = st.isClosed ? 1 : 0;
    values.IsWon = st.isWon ? 1 : 0;
    values.ForecastCategoryName = st.forecastCategory;
    if (!("Probability" in values) || values.Probability === null) values.Probability = st.probability;
  }
  if (def.name === "Case" && typeof values.Status === "string") {
    const closed = CASE_CLOSED_STATUSES.includes(values.Status);
    values.IsClosed = closed ? 1 : 0;
    if (closed && !existing?.IsClosed) values.ClosedDate = new Date().toISOString();
    if (!closed) values.ClosedDate = null;
  }
  if (def.name === "Task" && typeof values.Status === "string") values.IsClosed = TASK_CLOSED_STATUSES.includes(values.Status) ? 1 : 0;
  if (def.name === "Lead" && values.Status === LEAD_CONVERTED_STATUS && !existing?.IsConverted) {
    delete values.Status; // only the convert action may set the converted status
  }
}

app.post("/api/sobjects/:type", async (c) => {
  const def = typeOr404(c as C);
  const sec = c.get("sec");
  if (!def || !can(sec, def.name, "create")) return notFound(c);
  const input = await body(c);
  if (def.name === "Task" && !("Status" in input)) input.Status = "Not Started";
  if (def.name === "Lead" && !("Status" in input)) input.Status = "Open - Not Contacted";
  if (def.name === "Case" && !("Status" in input)) input.Status = "New";
  const { values, errors } = validateRecord(def, input, "create");
  if (errors.length) return sfErrors(c, errors);
  const refErrors = await checkReferences(c as C, def, values);
  if (refErrors.length) return sfErrors(c, refErrors);
  if (!def.ownerable) {
    const m = masterOf(def)!;
    if (!(await loadAccessible(c as C, m.master, String(values[m.field]), "edit"))) {
      return sfError(c, 400, "INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY", "insufficient access rights on cross-reference id", [m.field]);
    }
  }
  if (def.name === "Lead" && values.Status === LEAD_CONVERTED_STATUS) values.Status = "Open - Not Contacted";
  applyDerived(def, values);

  const id = newId(def.keyPrefix);
  const cols: Record<string, unknown> = { Id: id, ...values, CreatedById: sec.userId, LastModifiedById: sec.userId };
  if (def.ownerable) cols.OwnerId = sec.userId;
  const names = Object.keys(cols);
  let sql = `INSERT INTO ${tbl(def)} (${names.map((n) => `"${n}"`).join(", ")}) VALUES (${names.map(() => "?").join(", ")})`;
  if (def.name === "Case") {
    // Auto-number: next CaseNumber, zero-padded to 8 digits (00001000, 00001001, ...)
    sql = `INSERT INTO "Case" (${[...names, "CaseNumber"].map((n) => `"${n}"`).join(", ")})
           SELECT ${names.map(() => "?").join(", ")}, printf('%08d', COALESCE(MAX(CAST("CaseNumber" AS INTEGER)), 999) + 1) FROM "Case"`;
  }
  await c.env.DB.prepare(sql).bind(...Object.values(cols)).run();
  return c.json({ id, success: true, errors: [] }, 201);
});

app.get("/api/sobjects/:type/:id", async (c) => {
  const def = typeOr404(c as C);
  const id = normalizeId(c.req.param("id"));
  if (!def || !id || !id.startsWith(def.keyPrefix)) return notFound(c);
  const row = await loadAccessible(c as C, def, id, "read");
  return row ? c.json(toRecord(def, row)) : notFound(c);
});

app.patch("/api/sobjects/:type/:id", async (c) => {
  const def = typeOr404(c as C);
  const id = normalizeId(c.req.param("id"));
  if (!def || !id || !id.startsWith(def.keyPrefix)) return notFound(c);
  const row = await loadAccessible(c as C, def, id, "edit");
  if (!row) return notFound(c);
  const { values, errors } = validateRecord(def, await body(c), "update");
  if (errors.length) return sfErrors(c, errors);
  const refErrors = await checkReferences(c as C, def, values);
  if (refErrors.length) return sfErrors(c, refErrors);
  if (def.name === "Lead" && row.IsConverted) return sfError(c, 400, "CANNOT_UPDATE_CONVERTED_LEAD", "cannot reference converted lead");
  applyDerived(def, values, row);
  const keys = Object.keys(values);
  if (!keys.length) return c.body(null, 204);
  await c.env.DB.prepare(`UPDATE ${tbl(def)} SET ${keys.map((k) => `"${k}" = ?`).join(", ")}, "LastModifiedById" = ?, "LastModifiedDate" = ${NOW}, "SystemModstamp" = ${NOW} WHERE "Id" = ?`)
    .bind(...Object.values(values), c.get("sec").userId, id).run();
  return c.body(null, 204);
});

/** Soft delete to the Recycle Bin; master-detail children go with their master. */
function deleteStatements(db: D1Database, def: SObjectDef, idSql: string, params: string[], deleted: 0 | 1, userId: string): D1PreparedStatement[] {
  const stmts: D1PreparedStatement[] = [];
  for (const child of Object.values(OBJECTS)) {
    for (const f of child.fields.filter((x) => x.cascadeDelete && x.referenceTo?.[0] === def.name)) {
      stmts.push(...deleteStatements(db, child, `SELECT "Id" FROM "${child.name}" WHERE "${f.name}" IN (${idSql})`, params, deleted, userId));
    }
  }
  stmts.push(db.prepare(`UPDATE ${tbl(def)} SET "IsDeleted" = ?, "LastModifiedById" = ?, "SystemModstamp" = ${NOW} WHERE "Id" IN (${idSql})`).bind(deleted, userId, ...params));
  return stmts;
}

app.delete("/api/sobjects/:type/:id", async (c) => {
  const def = typeOr404(c as C);
  const id = normalizeId(c.req.param("id"));
  if (!def || !id || !id.startsWith(def.keyPrefix)) return notFound(c);
  if (!(await loadAccessible(c as C, def, id, "delete"))) return notFound(c);
  await c.env.DB.batch(deleteStatements(c.env.DB, def, "?", [id], 1, c.get("sec").userId));
  return c.body(null, 204);
});

// ---------- Recycle Bin ----------
app.get("/api/recyclebin", async (c) => {
  const sec = c.get("sec");
  const items: unknown[] = [];
  for (const def of Object.values(OBJECTS).filter((d) => d.ownerable && can(sec, d.name, "delete"))) {
    const vis = readFilter(sec, def, masterOf);
    const res = await c.env.DB.prepare(`SELECT "Id", "${nameFieldOf(def)}" AS "Name", "SystemModstamp" AS "DeletedDate" FROM ${tbl(def)} WHERE "IsDeleted" = 1 AND ${vis.sql} ORDER BY "SystemModstamp" DESC LIMIT 100`)
      .bind(...vis.params).all();
    for (const r of res.results) items.push({ ...r, type: def.name, typeLabel: def.label });
  }
  return c.json({ records: items });
});

app.post("/api/sobjects/:type/:id/undelete", async (c) => {
  const def = typeOr404(c as C);
  const sec = c.get("sec");
  const id = normalizeId(c.req.param("id"));
  if (!def || !id || !def.ownerable || !id.startsWith(def.keyPrefix)) return notFound(c);
  const row = await c.env.DB.prepare(`SELECT "OwnerId" FROM ${tbl(def)} WHERE "Id" = ? AND "IsDeleted" = 1`).bind(id).first<{ OwnerId: string }>();
  if (!row || !canAccessRecord(sec, def, "delete", row.OwnerId)) return notFound(c);
  await c.env.DB.batch(deleteStatements(c.env.DB, def, "?", [id], 0, sec.userId));
  return c.json({ id, success: true });
});

// ---------- UI API (record page data in one call) ----------
/** Display names for every reference value in a set of records, resolved by ID key prefix (handles polymorphic fields). */
async function lookupNames(c: C, def: SObjectDef, records: Record<string, unknown>[]): Promise<Record<string, { name: string; type: string }>> {
  const sec = c.get("sec");
  const byType = new Map<string, Set<string>>();
  for (const r of records) {
    for (const f of allFields(def).filter((x) => x.type === "reference")) {
      const id = r[f.name];
      if (typeof id !== "string") continue;
      const t = f.referenceTo?.[0] === "User" ? "User" : objectForId(id)?.name;
      if (!t) continue;
      if (!byType.has(t)) byType.set(t, new Set());
      byType.get(t)!.add(id);
    }
  }
  const out: Record<string, { name: string; type: string }> = {};
  for (const [type, ids] of byType) {
    const list = [...ids].slice(0, 500);
    if (type === "User") {
      const res = await c.env.DB.prepare(`SELECT "Id", "Name" FROM "User" WHERE "Id" IN (${list.map(() => "?").join(", ")})`).bind(...list).all<{ Id: string; Name: string }>();
      for (const u of res.results) out[u.Id] = { name: u.Name, type: "User" };
      continue;
    }
    const target = getObject(type)!;
    if (!can(sec, type, "read")) continue;
    const vis = readFilter(sec, target, masterOf);
    const res = await c.env.DB.prepare(`SELECT "Id", "${nameFieldOf(target)}" AS "N" FROM ${tbl(target)} WHERE "Id" IN (${list.map(() => "?").join(", ")}) AND ${vis.sql}`)
      .bind(...list, ...vis.params).all<{ Id: string; N: string }>();
    for (const r of res.results) out[r.Id] = { name: r.N, type };
  }
  return out;
}

/** Everything a record page needs: the record, lookup names, related lists and activities. Type comes from the ID prefix. */
app.get("/api/ui-api/records/:id", async (c) => {
  const id = normalizeId(c.req.param("id"));
  const def = id ? objectForId(id) : null;
  const sec = c.get("sec");
  if (!id || !def) return notFound(c);
  const row = await loadAccessible(c as C, def, id, "read");
  if (!row) return notFound(c);
  const record = toRecord(def, row);

  const related: Record<string, { relationship: { childSObject: string; field: string }; records: unknown[]; totalSize: number }> = {};
  const relatedRows: Record<string, unknown>[] = [];
  for (const rel of childRelationships(def.name).filter((r) => can(sec, r.childSObject, "read"))) {
    const child = getObject(rel.childSObject)!;
    const vis = readFilter(sec, child, masterOf);
    const [rows, total] = await c.env.DB.batch([
      c.env.DB.prepare(`SELECT * FROM ${tbl(child)} WHERE "${rel.field}" = ? AND "IsDeleted" = 0 AND ${vis.sql} ORDER BY "LastModifiedDate" DESC LIMIT 6`).bind(id, ...vis.params),
      c.env.DB.prepare(`SELECT COUNT(*) AS n FROM ${tbl(child)} WHERE "${rel.field}" = ? AND "IsDeleted" = 0 AND ${vis.sql}`).bind(id, ...vis.params),
    ]);
    const recs = (rows.results as Record<string, unknown>[]).map((r) => toRecord(child, r));
    relatedRows.push(...recs);
    related[`${rel.childSObject}.${rel.field}`] = { relationship: { childSObject: rel.childSObject, field: rel.field }, records: recs, totalSize: (total.results[0] as { n: number }).n };
  }

  // Activities: Tasks/Events linked by WhoId (people) or WhatId (things).
  const activityField = ["Contact", "Lead"].includes(def.name) ? "WhoId" : ["Account", "Opportunity", "Case"].includes(def.name) ? "WhatId" : null;
  const activities: Record<string, unknown>[] = [];
  if (activityField) {
    for (const t of ["Task", "Event"] as const) {
      const adef = getObject(t)!;
      if (!can(sec, t, "read")) continue;
      const vis = readFilter(sec, adef, masterOf);
      const res = await c.env.DB.prepare(`SELECT * FROM "${t}" WHERE "${activityField}" = ? AND "IsDeleted" = 0 AND ${vis.sql} ORDER BY "CreatedDate" DESC LIMIT 50`).bind(id, ...vis.params).all();
      activities.push(...(res.results as Record<string, unknown>[]).map((r) => toRecord(adef, r)));
    }
  }

  const names = {
    ...(await lookupNames(c as C, def, [record])),
    ...Object.assign({}, ...(await Promise.all(Object.values(related).map((r) => {
      const child = getObject(r.relationship.childSObject)!;
      return lookupNames(c as C, child, r.records as Record<string, unknown>[]);
    })))),
    ...(await lookupNames(c as C, getObject("Task")!, activities.filter((a) => (a.attributes as { type: string }).type === "Task"))),
    ...(await lookupNames(c as C, getObject("Event")!, activities.filter((a) => (a.attributes as { type: string }).type === "Event"))),
  };
  return c.json({ record, name: String(row[nameFieldOf(def)] ?? ""), names, related, activities, relatedRowsCount: relatedRows.length });
});

// ---------- Lead conversion (Salesforce: convertLead) ----------
app.post("/api/actions/convertLead", async (c) => {
  const sec = c.get("sec");
  const b = await body(c);
  const leadId = normalizeId(b.leadId);
  const leadDef = getObject("Lead")!;
  const lead = leadId ? await loadAccessible(c as C, leadDef, leadId, "edit") : null;
  if (!lead) return notFound(c);
  if (lead.IsConverted) return sfError(c, 400, "CANNOT_CONVERT_LEAD", "Lead is already converted");
  if (!can(sec, "Account", "create") || !can(sec, "Contact", "create")) return sfError(c, 403, "INSUFFICIENT_ACCESS", "Insufficient privileges");

  // Optionally attach to an existing Account instead of creating one.
  const existingAccountId = normalizeId(b.accountId);
  if (b.accountId && (!existingAccountId || !(await loadAccessible(c as C, getObject("Account")!, existingAccountId, "read")))) {
    return sfError(c, 400, "INVALID_CROSS_REFERENCE_KEY", "invalid cross reference id", ["accountId"]);
  }
  const accountId = existingAccountId ?? newId("001");
  const contactId = newId("003");
  const audit = [sec.userId, sec.userId, sec.userId];
  const stmts = [];
  if (!existingAccountId) {
    stmts.push(c.env.DB.prepare(`INSERT INTO "Account" ("Id", "OwnerId", "CreatedById", "LastModifiedById", "Name", "Phone", "Industry", "AnnualRevenue", "NumberOfEmployees", "AccountSource") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(accountId, ...audit, lead.Company, lead.Phone, lead.Industry, lead.AnnualRevenue, lead.NumberOfEmployees, lead.LeadSource));
  }
  stmts.push(c.env.DB.prepare(`INSERT INTO "Contact" ("Id", "OwnerId", "CreatedById", "LastModifiedById", "AccountId", "Salutation", "FirstName", "LastName", "Title", "Email", "Phone", "LeadSource") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(contactId, ...audit, accountId, lead.Salutation, lead.FirstName, lead.LastName, lead.Title, lead.Email, lead.Phone, lead.LeadSource));
  let opportunityId: string | null = null;
  if (b.createOpportunity && can(sec, "Opportunity", "create")) {
    opportunityId = newId("006");
    const st = OPPORTUNITY_STAGES[0]!;
    const close = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
    const oppName = typeof b.opportunityName === "string" && b.opportunityName.trim() ? b.opportunityName.trim().slice(0, 120) : `${lead.Company}-`;
    stmts.push(c.env.DB.prepare(`INSERT INTO "Opportunity" ("Id", "OwnerId", "CreatedById", "LastModifiedById", "AccountId", "Name", "StageName", "CloseDate", "Probability", "ForecastCategoryName", "LeadSource") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(opportunityId, ...audit, accountId, oppName, st.name, close, st.probability, st.forecastCategory, lead.LeadSource));
    stmts.push(c.env.DB.prepare(`INSERT INTO "OpportunityContactRole" ("Id", "CreatedById", "LastModifiedById", "OpportunityId", "ContactId", "IsPrimary") VALUES (?, ?, ?, ?, ?, 1)`)
      .bind(newId("00K"), sec.userId, sec.userId, opportunityId, contactId));
  }
  // Move the lead's open activities to the new contact (WhoId), as Salesforce does.
  stmts.push(c.env.DB.prepare(`UPDATE "Task" SET "WhoId" = ?, "WhatId" = COALESCE("WhatId", ?) WHERE "WhoId" = ?`).bind(contactId, opportunityId ?? accountId, leadId));
  stmts.push(c.env.DB.prepare(`UPDATE "Event" SET "WhoId" = ?, "WhatId" = COALESCE("WhatId", ?) WHERE "WhoId" = ?`).bind(contactId, opportunityId ?? accountId, leadId));
  stmts.push(c.env.DB.prepare(`UPDATE "Lead" SET "IsConverted" = 1, "Status" = ?, "ConvertedDate" = date('now'), "ConvertedAccountId" = ?, "ConvertedContactId" = ?, "ConvertedOpportunityId" = ?, "LastModifiedById" = ?, "LastModifiedDate" = ${NOW}, "SystemModstamp" = ${NOW} WHERE "Id" = ?`)
    .bind(LEAD_CONVERTED_STATUS, accountId, contactId, opportunityId, sec.userId, leadId));
  await c.env.DB.batch(stmts);
  return c.json({ success: true, leadId, accountId, contactId, opportunityId });
});

// ---------- Home summary ----------
app.get("/api/ui-api/home", async (c) => {
  const sec = c.get("sec");
  const out: Record<string, unknown> = {};
  if (can(sec, "Opportunity", "read")) {
    const v = readFilter(sec, getObject("Opportunity")!, masterOf);
    out.pipeline = (await c.env.DB.prepare(`SELECT "StageName", COUNT(*) AS "count", COALESCE(SUM("Amount"), 0) AS "amount" FROM "Opportunity" WHERE "IsDeleted" = 0 AND ${v.sql} GROUP BY "StageName"`).bind(...v.params).all()).results;
  }
  if (can(sec, "Lead", "read")) {
    const v = readFilter(sec, getObject("Lead")!, masterOf);
    out.leadsByStatus = (await c.env.DB.prepare(`SELECT "Status", COUNT(*) AS "count" FROM "Lead" WHERE "IsDeleted" = 0 AND ${v.sql} GROUP BY "Status"`).bind(...v.params).all()).results;
  }
  if (can(sec, "Case", "read")) {
    const v = readFilter(sec, getObject("Case")!, masterOf);
    out.casesByStatus = (await c.env.DB.prepare(`SELECT "Status", COUNT(*) AS "count" FROM "Case" WHERE "IsDeleted" = 0 AND ${v.sql} GROUP BY "Status"`).bind(...v.params).all()).results;
  }
  if (can(sec, "Task", "read")) {
    out.myOpenTasks = (await c.env.DB.prepare(`SELECT "Id", "Subject", "ActivityDate", "Priority" FROM "Task" WHERE "OwnerId" = ? AND "IsClosed" = 0 AND "IsDeleted" = 0 ORDER BY "ActivityDate" IS NULL, "ActivityDate" LIMIT 10`).bind(sec.userId).all()).results;
  }
  return c.json(out);
});

// ---------- Setup (admin) ----------
app.use("/api/setup/*", async (c, next) => {
  if (!c.get("user").PermissionsManageUsers) return sfError(c, 403, "INSUFFICIENT_ACCESS", "Insufficient privileges");
  await next();
});

app.get("/api/setup/users", async (c) => {
  const db = c.env.DB;
  const [users, profiles, roles] = await db.batch([
    db.prepare(`SELECT "Id", "Username", "Email", "Name", "FirstName", "LastName", "Title", "ProfileId", "UserRoleId", "IsActive", "PasswordHash" IS NOT NULL AS "Activated", "LastLoginDate" FROM "User" ORDER BY "LastName"`),
    db.prepare(`SELECT "Id", "Name" FROM "Profile" ORDER BY "Name"`),
    db.prepare(`SELECT "Id", "Name", "ParentRoleId" FROM "UserRole" ORDER BY "Name"`),
  ]);
  return c.json({ users: users.results, profiles: profiles.results, roles: roles.results });
});

async function exists(db: D1Database, table: "Profile" | "UserRole", id: unknown) {
  return typeof id === "string" && !!(await db.prepare(`SELECT 1 FROM "${table}" WHERE "Id" = ?`).bind(id).first());
}

app.post("/api/setup/users", async (c) => {
  const b = await body(c);
  const email = String(b.Email ?? "").trim().toLowerCase();
  const lastName = String(b.LastName ?? "").trim().slice(0, 80);
  const firstName = String(b.FirstName ?? "").trim().slice(0, 40) || null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !lastName) return sfError(c, 400, "REQUIRED_FIELD_MISSING", "Last Name and a valid Email are required", ["LastName", "Email"]);
  if (!(await exists(c.env.DB, "Profile", b.ProfileId))) return sfError(c, 400, "INVALID_CROSS_REFERENCE_KEY", "Unknown profile", ["ProfileId"]);
  if (b.UserRoleId && !(await exists(c.env.DB, "UserRole", b.UserRoleId))) return sfError(c, 400, "INVALID_CROSS_REFERENCE_KEY", "Unknown role", ["UserRoleId"]);
  if (await c.env.DB.prepare(`SELECT 1 FROM "User" WHERE "Username" = ?`).bind(email).first()) return sfError(c, 400, "DUPLICATE_USERNAME", "A user with this username already exists", ["Username"]);
  const id = newId("005");
  const token = randomToken();
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO "User" ("Id", "Username", "Email", "FirstName", "LastName", "Alias", "ProfileId", "UserRoleId") VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, email, email, firstName, lastName, ((firstName?.[0] ?? "") + lastName).slice(0, 8).toLowerCase(), b.ProfileId, b.UserRoleId || null),
    c.env.DB.prepare(`INSERT INTO "_invite" ("token_hash", "user_id", "expires_at") VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+${INVITE_DAYS} days'))`).bind(await sha256(token), id),
  ]);
  return c.json({ id, success: true, inviteUrl: `${new URL(c.req.url).origin}/invite/${token}` }, 201);
});

app.patch("/api/setup/users/:id", async (c) => {
  const b = await body(c);
  const id = normalizeId(c.req.param("id"));
  const me = c.get("user");
  if (!id) return notFound(c);
  if (id === me.Id && (b.IsActive === false || (b.ProfileId !== undefined && b.ProfileId !== me.ProfileId))) {
    return sfError(c, 400, "CANNOT_UPDATE_OWN_ACCESS", "You can't deactivate yourself or change your own profile");
  }
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (b.ProfileId !== undefined) {
    if (!(await exists(c.env.DB, "Profile", b.ProfileId))) return sfError(c, 400, "INVALID_CROSS_REFERENCE_KEY", "Unknown profile", ["ProfileId"]);
    sets.push(`"ProfileId" = ?`); vals.push(b.ProfileId);
  }
  if (b.UserRoleId !== undefined) {
    if (b.UserRoleId && !(await exists(c.env.DB, "UserRole", b.UserRoleId))) return sfError(c, 400, "INVALID_CROSS_REFERENCE_KEY", "Unknown role", ["UserRoleId"]);
    sets.push(`"UserRoleId" = ?`); vals.push(b.UserRoleId || null);
  }
  if (typeof b.IsActive === "boolean") { sets.push(`"IsActive" = ?`); vals.push(b.IsActive ? 1 : 0); }
  if (!sets.length) return c.body(null, 204);
  const stmts = [c.env.DB.prepare(`UPDATE "User" SET ${sets.join(", ")}, "LastModifiedDate" = ${NOW} WHERE "Id" = ?`).bind(...vals, id)];
  if (b.IsActive === false) stmts.push(c.env.DB.prepare(`DELETE FROM "_session" WHERE "user_id" = ?`).bind(id));
  await c.env.DB.batch(stmts);
  return c.body(null, 204);
});

app.get("/api/setup/profiles/:id/permissions", async (c) => {
  const r = await c.env.DB.prepare(`SELECT * FROM "ObjectPermissions" WHERE "ParentId" = ? ORDER BY "SobjectType"`).bind(c.req.param("id")).all();
  return c.json({ permissions: r.results });
});

const PERM_FLAGS = ["PermissionsRead", "PermissionsCreate", "PermissionsEdit", "PermissionsDelete", "PermissionsViewAllRecords", "PermissionsModifyAllRecords"] as const;

app.put("/api/setup/profiles/:id/permissions/:type", async (c) => {
  const { id, type } = c.req.param();
  const profile = await c.env.DB.prepare(`SELECT "PermissionsModifyAllData" FROM "Profile" WHERE "Id" = ?`).bind(id).first<{ PermissionsModifyAllData: number }>();
  if (!profile || !getObject(type)) return notFound(c);
  if (profile.PermissionsModifyAllData) return sfError(c, 400, "CANNOT_MODIFY_MANAGED_OBJECT", "The System Administrator profile can't be changed");
  const b = await body(c);
  const f = Object.fromEntries(PERM_FLAGS.map((k) => [k, b[k] ? 1 : 0])) as Record<(typeof PERM_FLAGS)[number], number>;
  // Salesforce dependencies: create/edit/delete need read; delete needs edit; modify all needs view all + delete.
  if (f.PermissionsModifyAllRecords) Object.assign(f, { PermissionsViewAllRecords: 1, PermissionsDelete: 1 });
  if (f.PermissionsDelete) f.PermissionsEdit = 1;
  if (f.PermissionsCreate || f.PermissionsEdit || f.PermissionsViewAllRecords) f.PermissionsRead = 1;
  await c.env.DB.prepare(`UPDATE "ObjectPermissions" SET ${PERM_FLAGS.map((k) => `"${k}" = ?`).join(", ")} WHERE "ParentId" = ? AND "SobjectType" = ?`)
    .bind(...PERM_FLAGS.map((k) => f[k]), id, type).run();
  return c.json(f);
});

app.get("/api/setup/sharing", async (c) => {
  const r = await c.env.DB.prepare(`SELECT "SobjectType", "Access" FROM "OrgWideDefault" ORDER BY "SobjectType"`).all();
  return c.json({ defaults: r.results });
});

app.put("/api/setup/sharing/:type", async (c) => {
  const def = getObject(c.req.param("type"));
  const access = String((await body(c)).Access ?? "");
  if (!def) return notFound(c);
  if (def.defaultSharing === "ControlledByParent") return sfError(c, 400, "INVALID_SHARING", "This object is controlled by its parent");
  if (!["Private", "Read", "ReadWrite"].includes(access)) return sfError(c, 400, "INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST", "Access must be Private, Read or ReadWrite", ["Access"]);
  await c.env.DB.prepare(`UPDATE "OrgWideDefault" SET "Access" = ? WHERE "SobjectType" = ?`).bind(access, def.name).run();
  return c.json({ SobjectType: def.name, Access: access });
});

app.get("/api/version", (c) => c.json({ version: API_VERSION }));
app.all("/api/*", (c) => notFound(c));

// Everything else: the React app.
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
