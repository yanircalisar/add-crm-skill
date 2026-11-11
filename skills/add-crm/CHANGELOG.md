# Changelog

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
