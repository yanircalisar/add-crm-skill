# Handoff: add-crm plugin

Context for the next working session (local or cloud). Read this, check the repo, then ask the user what's next.

## What it is
`/add-crm:add-crm` adds a Salesforce-style CRM to an existing project in a `/CRM` folder, running on the user's own
Cloudflare account (Hono + React on Workers, D1 database). It scans the project, interviews the user (business,
database strategy, data mapping, custom objects, stages, modules, sign-in, email, style, branding), researches
similar Salesforce setups in the background, then generates, tests and deploys the CRM.

## Layout (plugin v3.0.0, add-crm-core 1.0.0)
- `.claude-plugin/marketplace.json` + `plugin.json`: the repo root is both the marketplace and the plugin.
- `packages/core/`: the CRM itself, published to npm as **`add-crm-core`** (Hono API in `src/api`, React UI in
  `src/web` prebuilt to `dist/web`, `bin/add-crm.mjs` CLI: `migrate`, `check`, `seed-admin`). Own `CHANGELOG.md`.
- `skills/add-crm/`: `SKILL.md`, `PLAN.md`, `CHANGELOG.md`, `docs/` (cloudflare-setup, data-model,
  custom-objects, legal-and-sources), `templates/base/` (the thin project template: `crm.model.mjs`,
  `src/worker.mjs`, `wrangler.toml.tmpl`, `package.json` pinning add-crm-core) and `templates/dependabot.yml`.
  Paths in SKILL.md use `${CLAUDE_SKILL_DIR}`.
- Root `SKILL.md`: a stub that tells old `git clone` installs to switch to the plugin.
- CI: `.github/workflows/test.yml` tests/builds `packages/core`, checks no vendor images are bundled, then
  generates a project from the template with the packed tarball (migrate, `npm test` = check + bundle, apply
  migrations to local D1). `publish-core.yml` publishes to npm when `packages/core/package.json`'s version changes
  on main (needs the `NPM_TOKEN` secret) and tags `core-vX.Y.Z`.

## How a project's CRM works now
`CRM/crm.model.mjs` (custom objects, custom fields on standard objects, stages, picklists, nav) →
`createCrm(model)` in `src/worker.mjs`. `applyModel` validates everything (names become SQL identifiers) and
layers it on the standard objects. `npm run migrate` diffs the model against `migrations/crm-schema.json` and writes
only the next numbered migration (CREATE TABLE / ADD COLUMN / indexes / seeded permissions; never drops). Package
data changes go in `CORE_STEPS` in `src/api/migrate.ts`. CRMs from plugin 2.x adopt the package with
`add-crm migrate --baseline` after moving their objects.ts edits into the model (tested).

## Data model (v2.0.0)
Follows the Salesforce Object Reference; details in `skills/add-crm/docs/data-model.md`.
- Object and field API names; 18-char IDs with key prefixes (001, 003, 00Q, 006, 00K, 500, 00T, 00U, 005, 00e, 00E).
- System audit fields; soft delete with Recycle Bin and undelete.
- Lookup, master-detail (cascade delete/restore, inherited access), polymorphic `WhoId`/`WhatId`,
  OpportunityContactRole junction.
- Profiles with object permissions, role hierarchy, organization-wide defaults.
- Salesforce-style REST (`/api/sobjects/...`, Salesforce error codes) and `/lightning/...` URLs.
- Standard objects: `packages/core/src/api/objects.ts`; project additions: `crm.model.mjs`.

## UI and legal
Lightning Design System **CSS only** (BSD-3) with our **own icons** (`packages/core/src/web/Icon.tsx`). The
package build strips every image/font reference from that CSS (vendor logo, mascot, banners), see
`packages/core/vite.config.ts`; licenses in `packages/core/NOTICE` and `THIRD-PARTY-LICENSES.txt`. The legal policy in
`skills/add-crm/docs/legal-and-sources.md` forbids vendor icons, logos, fonts and code; SLDS icons (CC BY-ND) must
not be used. Third-party use is recorded in `NOTICE`.

## Verified
56 unit tests (incl. migrations run against real SQLite via node:sqlite); a project generated from the template with
a custom object runs under `wrangler dev` (sign-in, CRUD, related lists, custom stages, browser screenshots);
a model change yields a second migration; a 2.1.0 CRM was upgraded to the package with its data intact;
`claude plugin validate .` passes. (Earlier: a 60-check end-to-end run on 2.x.)

## Releasing
CRM changes: bump `packages/core/package.json` version, add to `packages/core/CHANGELOG.md` (say whether a
migration results), update the pin in `skills/add-crm/templates/base/package.json` (CI checks they match), push to
main; `publish-core` publishes. Skill changes: bump `version` in `.claude-plugin/plugin.json`, add a
`skills/add-crm/CHANGELOG.md` entry, push to `main`. Users receive it through
plugin auto-update, which is off by default for third-party marketplaces (enabled in `/plugin` → Marketplaces).

## Develop locally
```bash
cd packages/core
npm install && npm test && npm run typecheck && npm run build
npm run dev   # standard objects only, http://localhost:8787
```
Test the plugin from a checkout: `claude plugin validate .`, then `claude plugin marketplace add ./` and
`claude plugin install add-crm@add-crm-skill`.

## Not built yet
Optional modules (email and marketing automation, personal emails, sales insights, social); generating views or
imports from the host database; Postgres (Supabase, Neon); Master CRM (a hub that switches between project CRMs
with short-lived sign-in tokens); report builder; Change Owner; sharing rules; field-level security; SOQL; activity
links on custom objects. Auto-update has not been seen firing yet (needs a release after 2.1.0). The 2.x → package update path was tested by hand;
the package → newer package path will first be exercised by add-crm-core 1.0.1.

## Status of the npm package move
Built on branch `core-package`, not merged. Before merging: the user creates an npm account and adds an `NPM_TOKEN`
repository secret; merging then publishes add-crm-core 1.0.0 and releases plugin 3.0.0 together. Merging without
the token would release a plugin whose template points at a package that isn't on npm.

## Working with the user
Plain language, recommend rather than list options, test before merging. Pushes to `main` have sometimes failed
with an HTTP 500 from GitHub; pushing `branch:main` after a fast-forward check worked.
Leftover remote branches: `slds-ui`, `sf-model`, `plugin` (all merged), `readme-url` (test branch, safe to delete),
`claude/relaxed-noether-kstquw` (from another session; ask before deleting).
