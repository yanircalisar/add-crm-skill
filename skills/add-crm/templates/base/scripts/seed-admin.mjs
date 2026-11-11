#!/usr/bin/env node
// Creates the first System Administrator (role: CEO) and prints a one-time invite link (never a password).
// Usage: npm run seed:admin -- you@example.com "First Last" [--remote] [--url https://crm.example.com]
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";

const args = process.argv.slice(2);
const remote = args.includes("--remote");
const urlIdx = args.indexOf("--url");
const baseUrl = urlIdx >= 0 ? args[urlIdx + 1] : "http://localhost:8787";
const positional = args.filter((a, i) => !a.startsWith("--") && !(urlIdx >= 0 && i === urlIdx + 1));
const [email, fullName = "Admin User"] = positional;

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: npm run seed:admin -- you@example.com "First Last" [--remote] [--url https://...]');
  process.exit(1);
}

// Salesforce-style 18-char IDs (same algorithm as src/api/ids.ts)
const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SUF = "ABCDEFGHIJKLMNOPQRSTUVWXYZ012345";
const to18 = (id) => id + [0, 1, 2].map((k) => SUF[[...id.slice(k * 5, k * 5 + 5)].reduce((f, ch, i) => f | (/[A-Z]/.test(ch) ? 1 << i : 0), 0)]).join("");
const seedId = (prefix, n) => to18(prefix + String(n).padStart(12, "0"));
const newId = (prefix) => to18(prefix + "100" + [...randomBytes(9)].map((b) => B62[b % 62]).join(""));

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
