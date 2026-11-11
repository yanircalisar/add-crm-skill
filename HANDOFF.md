# Handoff: add-crm plugin

Context for the next working session (local or cloud). Read this, check the repo, then ask the user what's next.

## What it is
`/add-crm:add-crm` adds a Salesforce-style CRM to an existing project in a `/CRM` folder, running on the user's own
Cloudflare account (Hono + React on Workers, D1 database). It scans the project, interviews the user (business,
database strategy, data mapping, custom objects, stages, modules, sign-in, email, style, branding), researches
similar Salesforce setups in the background, then generates, tests and deploys the CRM.

## Layout (v2.1.0)
- `.claude-plugin/marketplace.json` + `plugin.json`: the repo root is both the marketplace and the plugin.
- `skills/add-crm/`: `SKILL.md`, `PLAN.md`, `CHANGELOG.md`, `docs/` (cloudflare-setup, data-model,
  custom-objects, legal-and-sources) and `templates/base/` (the CRM app). Paths in SKILL.md use `${CLAUDE_SKILL_DIR}`.
- Root `SKILL.md`: a stub that tells old `git clone` installs to switch to the plugin.
- CI: `.github/workflows/test.yml` runs test, typecheck and build in `skills/add-crm/templates/base`.

## Data model (v2.0.0)
Follows the Salesforce Object Reference; details in `skills/add-crm/docs/data-model.md`.
- Object and field API names; 18-char IDs with key prefixes (001, 003, 00Q, 006, 00K, 500, 00T, 00U, 005, 00e, 00E).
- System audit fields; soft delete with Recycle Bin and undelete.
- Lookup, master-detail (cascade delete/restore, inherited access), polymorphic `WhoId`/`WhatId`,
  OpportunityContactRole junction.
- Profiles with object permissions, role hierarchy, organization-wide defaults.
- Salesforce-style REST (`/api/sobjects/...`, Salesforce error codes) and `/lightning/...` URLs.
- `src/api/objects.ts` is the source of truth; `npm run schema` regenerates `migrations/0001_init.sql`
  (a test checks they match).

## UI and legal
Lightning Design System **CSS only** (BSD-3) with our **own icons** (`src/web/Icon.tsx`). The legal policy in
`skills/add-crm/docs/legal-and-sources.md` forbids vendor icons, logos, fonts and code; SLDS icons (CC BY-ND) must
not be used. Third-party use is recorded in `NOTICE`.

## Verified
38 unit tests; a 60-check end-to-end run against `wrangler dev` with a local D1 database; browser check of every
screen; `claude plugin validate .` passes; install from GitHub works.

## Releasing
Bump `version` in `.claude-plugin/plugin.json`, add a `CHANGELOG.md` entry, push to `main`. Users receive it through
plugin auto-update, which is off by default for third-party marketplaces (enabled in `/plugin` → Marketplaces).

## Develop locally
```bash
cd skills/add-crm/templates/base
npm install && npm test && npm run typecheck && npm run build
```
Test the plugin from a checkout: `claude plugin validate .`, then `claude plugin marketplace add ./` and
`claude plugin install add-crm@add-crm-skill`.

## Not built yet
Optional modules (email and marketing automation, personal emails, sales insights, social); generating views or
imports from the host database; Postgres (Supabase, Neon); Master CRM (a hub that switches between project CRMs
with short-lived sign-in tokens); report builder; Change Owner; sharing rules; field-level security; SOQL; activity
links on custom objects. Auto-update has not been seen firing yet (needs a release after 2.1.0). The "update an
existing CRM" path in SKILL.md has never been run.

## Proposed next step (not started)
Turn the CRM core into an npm package, so each project's `/CRM` holds only its config and custom objects and new
releases reach every project as a dependency update (Dependabot or Renovate pull requests).

## Working with the user
Plain language, recommend rather than list options, test before merging. Pushes to `main` have sometimes failed
with an HTTP 500 from GitHub; pushing `branch:main` after a fast-forward check worked.
Leftover remote branches: `slds-ui`, `sf-model`, `plugin` (all merged), `readme-url` (test branch, safe to delete),
`claude/relaxed-noether-kstquw` (from another session; ask before deleting).
