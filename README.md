# add-crm-skill

A [Claude Code](https://claude.com/claude-code) skill that adds a Salesforce-style CRM to a project you already have.
Run `/add-crm` inside the project. It looks at your code and data, asks how your business works, then builds a CRM
in a `/CRM` folder that runs on your own Cloudflare account.

> Not affiliated with Salesforce. The CRM is built with the open-source [Salesforce Lightning Design System](https://www.lightningdesignsystem.com/),
> so it looks and feels like Lightning, but it carries your own name and logo. See [NOTICE.md](NOTICE.md).

## What you get
- **Records:** Leads (with conversion), Accounts, Contacts, Opportunities, Cases, Tasks, and an activity timeline
- **Screens:** list views with search and sorting, record pages with a stage bar and related lists, a drag-and-drop
  pipeline board, and a home dashboard
- **User management:** invite users by link, roles (Admin, Manager, Rep), per-role permissions, and reps see only their own records
- Lightning look: app launcher, object icons, path (stage bar), highlights panel, activity timeline, kanban
- Works on mobile
- Built with Hono + React on Cloudflare Workers, with a Cloudflare D1 database

## Requirements
- **Claude Code**
- **Node.js 20+** and npm
- **A Cloudflare account** (the free plan is enough). The skill walks you through signing up.
  On a machine without a browser, use an API token with *Workers* and *D1 Edit* permissions instead of logging in.
- **A Resend API key**, only if you turn on email features. The skill can reuse a key your project already has.
- Your project in a **git** repository

## Install
User level (available in every project):
```bash
git clone https://github.com/yanircalisar/add-crm-skill ~/.claude/skills/add-crm
```
Or project level (only this project):
```bash
git clone https://github.com/yanircalisar/add-crm-skill .claude/skills/add-crm
```

## Use
Open Claude Code in your project and type:
```
/add-crm
```
The skill will:
1. Scan your project: framework, database, existing users and customers, email provider
2. Ask about your business, how to use your existing data, pipeline stages, sign-in and branding.
   In the background it looks up how similar companies set up Salesforce and suggests those patterns
3. Guide you through Cloudflare setup (see [docs/cloudflare-setup.md](docs/cloudflare-setup.md))
4. Generate `/CRM`, run its tests, start it locally, and deploy when you approve

It never changes your existing database, secrets or code outside `/CRM` without asking first.

## Status
Version 1. **Working:** everything under "What you get".

**Not built yet:**
- Optional modules: email & marketing automation, personal emails, sales insights, social media
- Linking to or importing from your project's existing database (the skill asks the questions; generating the views/import is next)
- Postgres support (Supabase, Neon)
- Master CRM: one hub that switches between the CRMs of several projects
- Custom report builder

Design notes and roadmap: [PLAN.md](PLAN.md).

## Develop
```bash
cd templates/base
npm install
npm test && npm run typecheck && npm run build
```

## License
[MIT](LICENSE)
