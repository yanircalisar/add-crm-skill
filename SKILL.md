---
name: add-crm
description: Add a CRM in the style of Salesforce, HubSpot or a neutral layout (leads, accounts/companies, contacts, deals/opportunities, cases, tasks, reports, marketing automation, user management) to the current project in a /CRM folder, running on the user's own database (Cloudflare D1 by default). Scans the project first, reuses existing data and email providers with permission, and can register the CRM with a user-level Master CRM. Use when the user runs /add-crm or asks to add a CRM to a project. `/add-crm master` sets up the Master CRM.
---

# /add-crm

You are installing a CRM into an **existing, running project**. Work in phases. Never change the
user's existing database, secrets or code outside `/CRM` without explicit permission. Never print secret values.

Templates live next to this file: `templates/base` (the app) and `docs/cloudflare-setup.md` (onboarding guide).
Read `PLAN.md` for the design rationale if anything here is unclear.

If the argument is `master`, skip to **Phase M**.
If the argument is `quick`, ask only: CRM style, CRM name and first admin email; take every other answer from
discovery or the defaults below, then show the full set of choices once for a single confirmation.
The goal is a working CRM in a few minutes, so ask as little as possible and never ask what discovery can answer.

## Phase 0 — Preconditions
0. **Check for a newer skill version.** If this skill's folder is a git clone, run
   `git -C <skill dir> fetch --quiet` and compare `VERSION` with `git -C <skill dir> show origin/main:VERSION`.
   If newer, show the matching `CHANGELOG.md` entries and offer to update (`git -C <skill dir> pull --ff-only`)
   before continuing. Never update without asking.
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

**Scan depth: schema plus aggregates.** Read tables, columns, types, primary/foreign keys and indexes, then only
aggregate facts: row counts and, per column, the value type and number of distinct values (low-cardinality text
columns are picklist candidates). Never read or print raw rows, and skip columns that look personal or secret
(email, phone, password, token, key, address) beyond noting that they exist. Everything that follows uses these facts.

Show the user a short summary, e.g.:
> Found: Next.js on Vercel · Postgres via Prisma: `User` (12 cols), `Organization`, `Subscription` · Resend via `RESEND_API_KEY` · B2B SaaS signals in README.

## Phase 2 — Start background research
Immediately after the summary, launch a **background** Agent (general-purpose) with this brief, then go on
to Phase 3 without waiting:
> Find 2-3 public customer stories or implementation guides for the chosen CRM style (Salesforce, HubSpot or
> similar: vendor case-study pages, public docs, partner blogs) for businesses similar to: <one-line business description from discovery>. For each, return:
> company/type, which CRM objects they used for which real-world entity, pipeline stages, key automations,
> and a one-line lesson. Cite URLs. Be concise.

When it returns, present the patterns as **suggestions** at the point they're relevant (data mapping, stages).
The user decides.

## Phase 2b — Propose custom objects
Follow `docs/custom-objects.md`. From the schema scan, list the host tables that do **not** map onto a standard
object (Lead, Account, Contact, Opportunity, Case, Task) and propose them as **custom objects**, ranked by CRM
value (row count, links to customers, status or amount columns). Show a ranked list, then a text diagram of the
relationships to the standard objects. For each candidate give: source table, why it matters, proposed fields,
the relationship type and its parent. The user accepts, edits or rejects each; nothing is created without that.
Supported relationship types: lookup (many-to-one), master-detail (cascade delete, inherits visibility),
many-to-many through a junction object, and activity links (tasks and timeline entries on any object).
Record the result in `CRM/crm.config.json` → `customObjects` and `relationships`.

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

**3c-2. Custom objects** — confirm the Phase 2b proposals and ask about anything the scan cannot tell:
which custom objects should be visible to which roles, and which one (if any) deserves its own pipeline or stage bar.
Custom-object data follows the DB strategy chosen in 3b (import script for a separate DB; views or `crm_` tables
for an existing DB).

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

**3h. CRM style** — Salesforce-style (records, path bar, related lists) · HubSpot-style (deals, companies,
contact timeline, marketing-first) · Neutral. Style changes layout and vocabulary only (e.g. Opportunities vs Deals,
Accounts vs Companies); the data model is the same. See `docs/legal-and-sources.md` for what may be reused.

**3i. Branding & admin:** CRM display name, brand color, first admin email.

## Phase 4 — Cloudflare setup (if D1 or Workers deploy was chosen)
Walk through `docs/cloudflare-setup.md` with the user step by step: account check/signup, `wrangler login`,
create D1, set secrets. Pause for the user at each step that needs their browser. Run the `wrangler` commands
yourself once they're logged in.

## Phase 5 — Generate
1. Copy `templates/base` → `<root>/CRM`. Rename `wrangler.toml.tmpl` → `wrangler.toml` and fill in
   `{{CRM_NAME}}`, `{{D1_DATABASE_ID}}`, `{{BRAND_COLOR}}`.
2. Write `CRM/crm.config.json` with all interview answers (no secrets).
3. The data model follows Salesforce (see `docs/data-model.md`): API names, 18-char IDs with key prefixes,
   system fields, lookup / master-detail / polymorphic relationships, profiles + roles + org-wide defaults.
   Apply the pipeline stages to `OPPORTUNITY_STAGES` in `src/api/objects.ts` and add each accepted custom object
   (API name `Xxx__c`, next free key prefix from `a00`, fields ending in `__c`) and its relationships to `OBJECTS`,
   then run `npm run schema` to regenerate the migration. Lookup, master-detail and junction (many-to-many) are
   supported; activity links on custom objects are planned (see `docs/custom-objects.md`), so don't fake them.
   Map host roles to the seeded profiles (System Administrator, Standard User, Read Only) and role hierarchy
   (CEO → Sales Manager → Sales Rep), and ask whether any object should be Public Read Only or Public Read/Write.
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
- **Legal:** follow `docs/legal-and-sources.md`. Use only public, permitted material; never another vendor's name,
  logos, icons, fonts, copy or code in the generated UI. Do not scrape or copy vendor docs, screenshots or UI assets.
- Marketing automation is provider-agnostic (lists, segments, campaigns, sequences, forms) and sends through the
  user's own email provider; never send to anyone without recorded consent and a working unsubscribe.
- **Updating an existing CRM** (`CRM/crm.config.json` has an older `skillVersion`): read the CHANGELOG entries in
  between, apply template changes file by file, keep the user's own edits (show a diff for anything that conflicts),
  and add database changes as new numbered migrations. Never rewrite an applied migration or drop data.
- Write the skill's `VERSION` into `CRM/crm.config.json` → `skillVersion`.
- Report at the end: what was created, which DB strategy, the mapping, pending modules, and next steps.
