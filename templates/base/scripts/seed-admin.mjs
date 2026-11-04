#!/usr/bin/env node
// Creates the first admin and prints a one-time invite link (never a password).
// Usage: npm run seed:admin -- you@example.com "Your Name" [--remote] [--url https://crm.example.com]
import { execFileSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";

const args = process.argv.slice(2);
const remote = args.includes("--remote");
const urlIdx = args.indexOf("--url");
const baseUrl = urlIdx >= 0 ? args[urlIdx + 1] : "http://localhost:8787";
const positional = args.filter((a, i) => !a.startsWith("--") && !(urlIdx >= 0 && i === urlIdx + 1));
const [email, name = "Admin"] = positional;

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: npm run seed:admin -- you@example.com "Your Name" [--remote] [--url https://...]');
  process.exit(1);
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const id = randomUUID();
const token = randomBytes(32).toString("hex");
const tokenHash = createHash("sha256").update(token).digest("hex");

const sql = [
  `INSERT INTO users (id, email, name, role_id) VALUES (${q(id)}, ${q(email.toLowerCase())}, ${q(name)}, 'admin');`,
  `INSERT INTO invites (token_hash, user_id, expires_at) VALUES (${q(tokenHash)}, ${q(id)}, datetime('now', '+7 days'));`,
].join(" ");

execFileSync("npx", ["wrangler", "d1", "execute", "DB", remote ? "--remote" : "--local", "--command", sql], { stdio: "inherit" });
console.log(`\nAdmin created. Open this link once to set a password (valid 7 days):\n${baseUrl}/invite/${token}\n`);
