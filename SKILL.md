---
name: add-crm
description: Add a Salesforce-style CRM (leads, accounts, contacts, opportunities, cases, tasks, reports, user management) to the current project in a /CRM folder, running on the user's own database (Cloudflare D1 by default). Scans the project first, reuses existing data and email providers with permission, and can register the CRM with a user-level Master CRM. Use when the user runs /add-crm or asks to add a CRM to a project. `/add-crm master` sets up the Master CRM.
---

# /add-crm

You are installing a CRM into an **existing, running project**. Work in phases. Never change the
user's existing database, secrets or code outside `/CRM` without explicit permission. Never print secret values.

Templates live next to this file: `templates/base` (the app) and `docs/cloudflare-setup.md` (onboarding guide).
Read `PLAN.md` for the design rationale if anything here is unclear.

If the argument is `master`, skip to **Phase M**.

## Phase 0 — Preconditions
1. Find the project root (git root). If `<root>/CRM` exists, read `CRM/crm.config.json` and ask:
   update the existing CRM / add modules / abort. Never overwrite silently.
2. Make sure work happens on a feature branch, not `main`/`dev`, following the repo's rules.

## Phase 1 — Discovery (scan, don't ask yet)
Scan the project and build a findings summary. Look for:
- **Stack:** package.json / pyproject / framework config, deploy target (wrangler.toml, vercel.json, Dockerfile).
- **Database:** wrangler.toml `[[d1_databases]]`, `DATABASE_URL`-style env names in `.env.example`, Prisma/Drizzle/
  Knex/SQLAlchemy schemas, `migrations/` folders. List tables + key columns relevant to a CRM
  (users, customers, companies/organizations/workspaces, orders/payments/subscriptions, tickets, events/registrations).
- **Auth:** existing login system (sessions, JWT, Clerk/Auth0/Supabase auth, etc.).
- **Email:** Resend, SendGrid, Postmark, SES, Mailgun, nodemailer. Record the **env var name** only (e.g. `RESEND_API_KEY`).
- **Business signals:** README, landing page copy, pricing pages — to infer B2B/B2C and the sales motion.

Show the user a short summary, e.g.:
> Found: Next.js on Vercel · Postgres via Prisma: `User` (12 cols), `Organization`, `Subscription` · Resend via `RESEND_API_KEY` · B2B SaaS signals in README.

## Phase 2 — Start background research
Immediately after the summary, launch a **background** Agent (general-purpose) with this brief, then go on
to Phase 3 without waiting:
> Find 2-3 public Salesforce customer stories or implementation guides (salesforce.com/customer-stories, Trailhead,
> partner blogs) for businesses similar to: <one-line business description from discovery>. For each, return:
> company/type, which Salesforce objects they used for which real-world entity, pipeline stages, key automations,
> and a one-line lesson. Cite URLs. Be concise.

When it returns, present the patterns as **suggestions** at the point they're relevant (data mapping, stages).
The user decides.

## Phase 3 — Interview (use AskUserQuestion, ≤4 questions per call)
Ask in this order; skip questions discovery already answered. Put the recommended option first.

**3a. Business context**
- Business model: B2B / B2C / marketplace / other.
- Sales motion: self-serve / sales-led / both.
- Team: roughly how many CRM users, and which roles (default Admin, Manager, Rep).

**3b. Database strategy** (only if a database was found)
- Use the existing DB as the CRM base — **new tables only**
- Use the existing DB — **new tables + new columns** on existing tables
- Existing DB **read-only** (CRM reads host data, stores its own data separately)
- **Separate new database** (default Cloudflare D1), optional import
If no DB was found, or they choose separate: offer Cloudflare D1 (default). Postgres (Supabase/Neon) is v2 —
say so if asked.

**3c. Data mapping** — for each relevant host entity, propose a CRM object and let the user confirm/change.
Typical defaults (adapt to the research findings):
| Host entity | B2B default | B2C default |
|---|---|---|
| users / customers | Contacts | Contacts (Person Accounts style) |
| organizations / companies / workspaces | Accounts | — |
| sign-ups without purchase / trials | Leads | Leads |
| subscriptions / paid orders | Opportunities (Closed Won) | Opportunities (Closed Won) |
| support tickets | Cases | Cases |
Record the result in `CRM/crm.config.json` → `mapping`.

**3d. Pipeline stages** — propose stages (from research or defaults:
Prospecting → Qualification → Proposal → Negotiation → Closed Won / Closed Lost).

**3e. Optional modules** (multiSelect): Email & marketing automation · Personal emails · Sales insights ·
Social media interactions.

**3f. CRM sign-in** (only if the project already has user accounts)
- Separate CRM accounts invited by an admin (default)
- Reuse the project's existing logins, limited to users the admin allows into the CRM
CRM roles/permissions are stored by the CRM in both cases.

**3g. Email** (only if an email module was chosen or a provider was found)
- If a provider was found: "Can the CRM reuse `<ENV_NAME>`?" If yes, it will be set as a CRM secret with the same
  value — ask the user to run `npx wrangler secret put RESEND_API_KEY` themselves, or pipe it from their local env
  without echoing. If no provider: default Resend; guide them to create an API key.

**3h. Branding & admin:** CRM display name, brand color, first admin email.

## Phase 4 — Cloudflare setup (if D1 or Workers deploy was chosen)
Walk through `docs/cloudflare-setup.md` with the user step by step: account check/signup, `wrangler login`,
create D1, set secrets. Pause for the user at each step that needs their browser. Run the `wrangler` commands
yourself once they're logged in.

## Phase 5 — Generate
1. Copy `templates/base` → `<root>/CRM`. Rename `wrangler.toml.tmpl` → `wrangler.toml` and fill in
   `{{CRM_NAME}}`, `{{D1_DATABASE_ID}}`, `{{BRAND_COLOR}}`.
2. Write `CRM/crm.config.json` with all interview answers (no secrets).
3. Apply the pipeline stages to `src/api/objects.ts` (`STAGES`).
4. Data mapping:
   - **Separate DB:** write an import script `CRM/scripts/import-from-host.ts` (idempotent, upserts by `external_id`).
   - **Existing DB, new tables:** generate migrations that create the `crm_` tables in the host DB and SQL **views**
     mapping host tables to CRM objects. **Read-only** works the same but views only, no writes to host tables.
   - **New columns allowed:** only add the columns the mapping needs, all nullable, and list them.
   For any change to an existing DB: **back it up first, show the exact SQL, wait for approval.**
5. Optional modules: v1 ships the core only. For each chosen module, add a TODO entry in `crm.config.json` → `modules`
   and tell the user it's planned (don't fake it).
6. `cd CRM && npm install` (exact versions are pinned), `npm test`, `npm run db:migrate:local`, `npm run dev`.
7. Seed the first admin: `npm run seed:admin -- <email>` (prints a one-time invite link, never a password).

## Phase 6 — Verify & deploy
- Run tests; they must pass. Open the dev server and check login, a list view, a record page and the pipeline board.
- Ask before deploying: `npm run db:migrate:remote && npm run deploy`.
- If a Master CRM exists (`~/.claude/crm-master/registry.json`), offer to register this CRM (Phase M step 3).

## Phase M — Master CRM (`/add-crm master`)
Status: **planned (v2)**. Explain the design from `PLAN.md` (Master CRM section): one user-level hub that lists
every project CRM and switches between them in one click with short-lived single-use sign-in tokens.
Until it ships, record each project CRM in `~/.claude/crm-master/registry.json`
(`{ "crms": [{ "name", "url", "project", "color" }] }`) so the hub can import them later.

## Rules
- Exact dependency versions only. Don't add packages beyond the template without asking.
- No secrets in code or `crm.config.json`; use `wrangler secret put` and `.dev.vars` (gitignored).
- Salesforce-like layout and UX, but never Salesforce's name, logos or trademarks in the generated UI.
- Report at the end: what was created, which DB strategy, the mapping, pending modules, and next steps.
