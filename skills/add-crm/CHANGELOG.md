# Changelog

## 3.0.0 — 2026-11-11
**The CRM is now an npm package, [`add-crm-core`](../../packages/core/README.md).** A project's `/CRM` keeps only its
model and generated migrations; CRM updates arrive as a dependency bump (Dependabot or Renovate pull request), so
every project can stay current without regenerating code.
- New projects: `/CRM` contains `crm.model.mjs` (custom objects, custom fields, stages, picklists, tabs),
  `src/worker.mjs`, `wrangler.toml` and `migrations/`. The interface is prebuilt inside the package.
- `npm run migrate` writes append-only migrations from the model; `npm test` validates the model and fails if a
  migration is missing; `npm run deploy` applies migrations, then deploys.
- Custom objects get their own navigation tab.
- The skill offers to add a Dependabot (or Renovate) entry so new CRM versions arrive as pull requests.
- Vendor images and fonts are removed from the bundled design system stylesheet; licenses are listed in
  `packages/core/NOTICE` and `THIRD-PARTY-LICENSES.txt`.
- **CRMs generated with 2.x keep working.** To move one to the package, run `/add-crm:add-crm` in that project and
  choose "update": your customizations move into `crm.model.mjs` and the existing database is kept as is.

## 2.1.0 — 2026-11-11
- Distributed as a Claude Code plugin with its own marketplace: install with
  `claude plugin marketplace add yanircalisar/add-crm-skill` then `claude plugin install add-crm@add-crm-skill`.
  Turn on auto-update in `/plugin` → Marketplaces to receive new releases automatically.
- The command is now `/add-crm:add-crm`.
- Old `git clone` installs get a notice explaining how to switch.
- The version check at the start of each run now compares the plugin version with the latest release.

## 2.0.0 — 2026-11-11
**Breaking for CRMs generated with 1.x:** new database schema and API. 1.x CRMs keep working; to move one to 2.0,
run `/add-crm` in that project and choose "update" (data is migrated with a new migration, never dropped).

- Data model follows the Salesforce Object Reference: object and field API names, 18-character IDs with key
  prefixes, system audit fields, `IsDeleted` soft delete with Recycle Bin and undelete.
- Relationships: lookup, self lookup, master-detail (cascade delete and restore, inherited access), polymorphic
  `WhoId`/`WhatId` on Task and Event, junction objects (OpportunityContactRole).
- Security: profiles with object permissions (View All / Modify All), role hierarchy, organization-wide defaults.
- New objects: OpportunityContactRole, Event. Calls and emails are Tasks with `TaskSubtype`.
- Lead conversion creates Account, Contact, Opportunity and a primary contact role, and moves activities.
- Salesforce-style REST API and error codes; Salesforce-style URLs (`/lightning/r/Account/{Id}/view`).
- UI uses the Lightning Design System CSS with our own icons (see NOTICE).
- Schema is generated from the object registry (`npm run schema`).
- The skill checks for a newer version at the start of each run.

## 1.0.0 — 2026-11-04
- First release: core objects, Lightning-inspired UI, invites, roles and permissions, Cloudflare Workers + D1.
