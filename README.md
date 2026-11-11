# add-crm-skill

A [Claude Code](https://claude.com/claude-code) skill that adds a CRM to a project (Salesforce-style, HubSpot-style or neutral, with marketing automation planned) you already have.
Run `/add-crm:add-crm` inside the project. It looks at your code and data, asks how your business works, then builds a CRM
in a `/CRM` folder that runs on your own Cloudflare account.

> Not affiliated with, endorsed by or sponsored by Salesforce, HubSpot or any other vendor. All product names are
> trademarks of their owners. The CRM follows familiar layouts but uses your own name and colors, and only public,
> permitted material. See [docs/legal-and-sources.md](skills/add-crm/docs/legal-and-sources.md).

## What you get
- **Salesforce data model:** standard objects and field API names (Account, Contact, Lead, Opportunity,
  OpportunityContactRole, Case, Task, Event), 18-character IDs with key prefixes, system audit fields, lookup,
  master-detail and polymorphic (`WhoId`/`WhatId`) relationships. See [docs/data-model.md](skills/add-crm/docs/data-model.md)
- **Salesforce behavior:** Lead conversion, stage-driven probability and forecast, Case auto-numbers, Recycle Bin
- **Security model:** profiles with object permissions, a role hierarchy, organization-wide sharing defaults, invite-only users
- **Lightning-style UI** (Lightning Design System CSS, our own icons): app launcher, list views, record pages with
  path and highlights panel, related lists, activity timeline, kanban, global search, Setup
- **Salesforce-style REST API:** `/api/sobjects/{Type}/describe`, `/api/sobjects/{Type}/{Id}`, Salesforce error codes
- Works on mobile
- Built with Hono + React on Cloudflare Workers, with a Cloudflare D1 database
- **Stays up to date:** the CRM is the npm package [`add-crm-core`](packages/core/README.md). Your `/CRM` folder
  holds only your own setup (custom objects, stages, picklists), so a new version is a one-line dependency update,
  delivered as a pull request by Dependabot or Renovate if you want

## Requirements
- **Claude Code**
- **Node.js 20+** and npm
- **A Cloudflare account** (the free plan is enough). The skill walks you through signing up.
  On a machine without a browser, use an API token with *Workers* and *D1 Edit* permissions instead of logging in.
- **A Resend API key**, only if you turn on email features. The skill can reuse a key your project already has.
- Your project in a **git** repository

## Install
Install it as a Claude Code plugin (once per computer):
```bash
claude plugin marketplace add yanircalisar/add-crm-skill
claude plugin install add-crm@add-crm-skill
```
Or inside Claude Code: `/plugin marketplace add yanircalisar/add-crm-skill`, then `/plugin install add-crm@add-crm-skill`.

**Turn on automatic updates** (recommended): in Claude Code run `/plugin`, open **Marketplaces**, pick
**add-crm-skill** and choose **Enable auto-update**. New releases then install by themselves at the start of a
session. To update by hand: `claude plugin update add-crm@add-crm-skill`.

Installed it earlier with `git clone`? Run the two commands above, then delete the old copy
(`rm -rf ~/.claude/skills/add-crm`).

## Use
Open Claude Code in your project and type:
```
/add-crm:add-crm
```
In a hurry? `/add-crm:add-crm quick` asks only for the style, a name and your admin email.
The skill will:
1. Scan your project: framework, database (schema and counts only), existing users and customers, email provider, and suggest custom objects with their links to the standard ones
2. Ask about your business, how to use your existing data, pipeline stages, sign-in and branding.
   In the background it looks up how similar companies set up their CRM and suggests those patterns
3. Guide you through Cloudflare setup (see [docs/cloudflare-setup.md](skills/add-crm/docs/cloudflare-setup.md))
4. Generate `/CRM`, run its tests, start it locally, and deploy when you approve
5. Offer to turn on automatic CRM updates (a pull request when `add-crm-core` has a new release)

## Customize and update your CRM
Everything that's yours lives in `CRM/crm.model.mjs` ([example](skills/add-crm/docs/custom-objects.md)). After
changing it, or after updating `add-crm-core`, run `npm run migrate` in `CRM/` and commit the new migration file.
`npm test` tells you if one is missing. Migrations only ever add tables and columns; your data is never dropped.

It never changes your existing database, secrets or code outside `/CRM` without asking first.

## Status
Version 3 (see [CHANGELOG.md](skills/add-crm/CHANGELOG.md)). **Working:** everything under "What you get".

**Not built yet:**
- Activity links on custom objects, Change Owner, sharing rules, field-level security, SOQL
- Optional modules: email & marketing automation, personal emails, sales insights, social media
- Linking to or importing from your project's existing database (the skill asks the questions; generating the views/import is next)
- Postgres support (Supabase, Neon)
- Master CRM: one hub that switches between the CRMs of several projects
- Custom report builder

Design notes and roadmap: [PLAN.md](skills/add-crm/PLAN.md).

## Develop
The CRM lives in [`packages/core`](packages/core) (published to npm as `add-crm-core`); the skill and the
project template are in [`skills/add-crm`](skills/add-crm).
```bash
cd packages/core
npm install
npm test && npm run typecheck && npm run build
npm run dev          # the CRM with the standard objects only, on http://localhost:8787
```
Releasing the package: bump `version` in `packages/core/package.json`, update its `CHANGELOG.md` and the pin in
`skills/add-crm/templates/base/package.json`, and push to `main`. The `publish-core` workflow publishes it to npm
(needs the `NPM_TOKEN` repository secret).

## License
[MIT](LICENSE)
