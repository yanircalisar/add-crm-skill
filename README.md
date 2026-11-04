# CRM skill (`/add-crm`)

A Claude Code skill that adds a Salesforce-style CRM to an existing project, in a `/CRM` folder, on the user's own database.

- `SKILL.md`: the skill itself (discovery, interview, Cloudflare setup, generation)
- `PLAN.md`: design decisions and roadmap
- `docs/cloudflare-setup.md`: onboarding guide the skill walks users through
- `templates/base/`: the CRM app copied into `<project>/CRM` (Hono API + React on Cloudflare Workers + D1)

## Install
- User level: copy this folder to `~/.claude/skills/add-crm/`
- Project level: copy it to `<project>/.claude/skills/add-crm/`

## Status (v1)
Done: core objects (leads + conversion, accounts, contacts, opportunities + pipeline board, cases, tasks, activity timeline),
home dashboard, users/invites, roles + profiles + record ownership, Setup page, mobile layout, dark mode.
Planned: optional modules (email & marketing automation, personal emails, sales insights, social), Postgres support,
Master CRM, host-DB view/import generators, report builder.

## Develop the template
```bash
cd templates/base && npm install && npm test && npm run typecheck
```
