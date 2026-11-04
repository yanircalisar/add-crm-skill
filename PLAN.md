# add-crm skill — Plan (draft v0)

## Goal
A Claude Code skill (`/add-crm`) that, run inside any project (Races, Melio, …), interviews the user,
then scaffolds a Salesforce-style CRM in `<project>/CRM` (created if missing), backed by the user's own database.

## Decisions so far
| Area | Decision |
|---|---|
| Stack | Hono API + React SPA on Cloudflare Workers |
| Relation to host | Code lives in `/CRM`; data strategy decided per project after a scan (see Discovery) |
| Database | Reuse host DB if the user agrees; otherwise Cloudflare D1 (default) in v1. Supabase / Neon (Postgres via Hyperdrive) planned for v2 |
| Look & feel | Salesforce Lightning-style layout/UX, own neutral brand (no Salesforce logos/trademarks) |
| Auth | Email + password, admin invites, sessions in D1, HttpOnly/Secure/SameSite=Strict cookies |
| Access control | Roles (Admin/Manager/Rep) + profiles (object permissions) + record ownership |
| Email provider | Reuse host's existing provider/token if found (with permission); else Resend |

## Core objects (always built)
Leads (+conversion), Accounts, Contacts, Opportunities (stages, kanban pipeline), Tasks, Activities timeline,
Cases, Reports & Dashboards.

## Optional modules (asked at runtime)
- Email / marketing automation (campaigns, sequences, lists)
- Personal emails (send/log from record pages)
- Sales insights (pipeline analytics, win rates, forecasting)
- Social media interactions

## Discovery phase (runs first, on the existing project)
1. **Scan the project:** stack, framework, ORM/schema files, migrations, DB bindings (wrangler.toml, .env.example,
   prisma/drizzle/SQL), existing auth/users, customers/orders/subscriptions tables, email libs (Resend, SendGrid,
   Postmark, SES, Mailgun, nodemailer) and their env var names. Never print secret values.
2. **Summarize findings** to the user: "You have `users` (12 cols), `orders`, Resend via `RESEND_API_KEY`…".
3. **Database strategy — ask:**
   - Use the existing DB as the CRM base, and allow new tables only / new tables + new columns on existing tables
   - Use the existing DB read-only (CRM reads host data, writes to its own DB)
   - Separate new DB (default Cloudflare D1), with optional one-time or synced import
4. **Data mapping — ask:** for each relevant host entity, propose a CRM mapping (e.g. signed-up users -> Contacts,
   companies/workspaces -> Accounts, trial users -> Leads, paid plans -> Opportunities/Closed Won, support tickets -> Cases)
   and let the user confirm or change it. Mapping is stored as config and implemented as views or sync jobs, not data copies.
5. **Business context — ask:** business model (B2B/B2C/marketplace), sales motion (self-serve/sales-led), pipeline stages, team size and roles.
6. **Salesforce use-case research (in parallel, while the user answers):** a background agent searches public Salesforce
   customer stories and Trailhead/implementation guides for similar businesses (e.g. B2B SaaS payments, event/races platforms)
   and returns 2-3 concrete patterns (object model, stages, automations). These are presented as suggestions; the user picks.
7. **Email — ask:** if an existing provider/token is found, ask permission to reuse it; then wire the same env var into the
   CRM's Worker secrets (`wrangler secret put`) without echoing the value.

## Skill flow
1. Run the Discovery phase; check for existing `/CRM` (offer update vs abort).
2. Ask: optional modules, CRM name/brand color, admin email (DB and email already decided in Discovery).
3. Cloudflare onboarding (only if a Cloudflare DB/deploy is chosen): has account? -> signup guide; `wrangler login`; create D1, KV; set secrets (Resend key, session secret).
4. Generate code from templates + selected modules + data mapping; back up the DB, show migrations and get approval before running any change to an existing DB; seed admin user.
5. Run tests, `wrangler dev`, then optional `wrangler deploy`.

## Skill repo layout (this folder)
```
CRM skill/
  SKILL.md            # skill instructions + interview script
  templates/          # base app (api, web, migrations) + per-module overlays
  scripts/            # cloudflare setup helpers
  docs/cloudflare-setup.md
```

## Open questions
- Skill name: `add-crm`?
- Install target: user-level (`~/.claude/skills`) or per-project?
