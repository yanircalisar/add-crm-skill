# add-crm skill — Plan (draft v0)

## Goal
A Claude Code skill (`/add-crm`) that, run inside any project (Races, Melio, …), interviews the user,
then scaffolds a Salesforce-style CRM in `<project>/CRM` (created if missing), backed by the user's own database.

## Decisions so far
| Area | Decision |
|---|---|
| Stack | Hono API + React SPA on Cloudflare Workers |
| Relation to host | Standalone app in `/CRM`, own deploy & DB (host data import later) |
| Database | Cloudflare D1 in v1. Supabase / Neon (Postgres via Hyperdrive) planned for v2 |
| Look & feel | Salesforce Lightning-style layout/UX, own neutral brand (no Salesforce logos/trademarks) |
| Auth | Email + password, admin invites, sessions in D1, HttpOnly/Secure/SameSite=Strict cookies |
| Access control | Roles (Admin/Manager/Rep) + profiles (object permissions) + record ownership |
| Email provider | Resend |

## Core objects (always built)
Leads (+conversion), Accounts, Contacts, Opportunities (stages, kanban pipeline), Tasks, Activities timeline,
Cases, Reports & Dashboards.

## Optional modules (asked at runtime)
- Email / marketing automation (campaigns, sequences, lists)
- Personal emails (send/log from record pages)
- Sales insights (pipeline analytics, win rates, forecasting)
- Social media interactions

## Skill flow
1. Detect project root; check for existing `/CRM` (offer update vs abort).
2. Ask: optional modules, DB (default D1), CRM name/brand color, admin email.
3. Cloudflare onboarding: has account? -> signup guide; `wrangler login`; create D1, KV; set secrets (Resend key, session secret).
4. Generate code from templates + selected modules; run migrations; seed admin user.
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
