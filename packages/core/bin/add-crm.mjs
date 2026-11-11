#!/usr/bin/env node
// add-crm: command-line tool for a project's CRM folder (run it from CRM/, usually through npm scripts).
//   add-crm migrate            write the next migration if the model or the package changed the schema
//   add-crm migrate --check    fail if a migration is needed (for CI and before deploy)
//   add-crm migrate --baseline record that the database already matches the model (adopting the package once)
//   add-crm check              validate crm.model.mjs and make sure migrations are up to date
//   add-crm seed-admin <email> ["First Last"] [--remote] [--url https://crm.example.com]
//   add-crm version
// Options: --model <file> (default crm.model.mjs), --migrations <dir> (default migrations)
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const [command] = args;
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const positional = args.slice(1).filter((a, i, all) => !a.startsWith("--") && !(i > 0 && ["--model", "--migrations", "--url"].includes(all[i - 1])));
const fail = (msg) => { console.error(msg); process.exit(1); };

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const modelFile = resolve(option("--model", "crm.model.mjs"));
const migrationsDir = resolve(option("--migrations", "migrations"));
const snapshotFile = join(migrationsDir, "crm-schema.json");

async function loadModel() {
  const core = await import("../dist/server/index.js");
  let model = {};
  if (existsSync(modelFile)) model = (await import(pathToFileURL(modelFile).href)).default ?? {};
  try {
    core.applyModel(model);
  } catch (e) {
    fail(e.message);
  }
  return core;
}

const migrationFiles = () => (existsSync(migrationsDir) ? readdirSync(migrationsDir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort() : []);

async function migrate({ check, baseline }) {
  await loadModel();
  const m = await import("../dist/server/api/migrate.js");
  const files = migrationFiles();
  const hasSnapshot = existsSync(snapshotFile);
  if (baseline) {
    if (hasSnapshot) fail(`${snapshotFile} already exists; nothing to baseline.`);
    mkdirSync(migrationsDir, { recursive: true });
    writeFileSync(snapshotFile, JSON.stringify(m.baselineSnapshot(), null, 2) + "\n");
    console.log(`Recorded the current model as already applied (${snapshotFile}).`);
    return;
  }
  let plan;
  if (!hasSnapshot) {
    if (files.length) fail(`Found migrations but no ${snapshotFile}.\nIf the database already matches crm.model.mjs, run "add-crm migrate --baseline" once.`);
    plan = m.initialPlan();
  } else {
    plan = m.planMigration(JSON.parse(readFileSync(snapshotFile, "utf8")));
  }
  for (const w of plan.warnings) console.warn(`warning: ${w}`);
  if (!plan.sql) { console.log("Migrations are up to date."); return; }
  const next = String(files.length ? Number(files.at(-1).slice(0, 4)) + 1 : 1).padStart(4, "0");
  const name = `${next}_${files.length ? "crm_update" : "init"}.sql`;
  if (check) fail(`A new migration is needed (the model or add-crm-core changed). Run "npm run migrate" and commit ${name} and crm-schema.json.`);
  mkdirSync(migrationsDir, { recursive: true });
  writeFileSync(join(migrationsDir, name), plan.sql);
  writeFileSync(snapshotFile, JSON.stringify(plan.snapshot, null, 2) + "\n");
  console.log(`Wrote ${join(option("--migrations", "migrations"), name)}. Apply it with "npm run db:migrate:local" (and ":remote" before deploying).`);
}

async function seedAdmin() {
  const { newId, seedId } = await import("../dist/server/api/seed.js");
  const remote = flag("--remote");
  const baseUrl = option("--url", "http://localhost:8787");
  const [email, fullName = "Admin User"] = positional;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Usage: add-crm seed-admin you@example.com "First Last" [--remote] [--url https://...]');
  const q = (s) => (s === null ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);
  const parts = fullName.trim().split(/\s+/);
  const lastName = parts.pop() || "User";
  const firstName = parts.join(" ") || null;
  const id = newId("005");
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const user = email.toLowerCase();
  const sql = [
    `INSERT INTO "User" ("Id", "Username", "Email", "FirstName", "LastName", "Alias", "ProfileId", "UserRoleId") VALUES (${q(id)}, ${q(user)}, ${q(user)}, ${q(firstName)}, ${q(lastName)}, ${q(lastName.slice(0, 8).toLowerCase())}, ${q(seedId("00e", 1))}, ${q(seedId("00E", 1))});`,
    `INSERT INTO "_invite" ("token_hash", "user_id", "expires_at") VALUES (${q(tokenHash)}, ${q(id)}, strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+7 days'));`,
  ].join(" ");
  execFileSync("npx", ["wrangler", "d1", "execute", "DB", remote ? "--remote" : "--local", "--command", sql], { stdio: "inherit" });
  console.log(`\nAdmin created (${id}). Open this link once to set a password (valid 7 days):\n${baseUrl}/invite/${token}\n`);
}

switch (command) {
  case "migrate": await migrate({ check: flag("--check"), baseline: flag("--baseline") }); break;
  case "check": await migrate({ check: true, baseline: false }); console.log("Model is valid."); break;
  case "seed-admin": await seedAdmin(); break;
  case "version": case "--version": console.log(pkg.version); break;
  default:
    console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1, 10).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
    if (command && command !== "help" && command !== "--help") process.exit(1);
}
