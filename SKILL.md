---
name: add-crm
description: Legacy entry point for old git-clone installs of add-crm. The skill is now distributed as a Claude Code plugin. Use when the user runs /add-crm from a git-clone install; tell them how to switch to the plugin.
---

# /add-crm has moved to a plugin

This copy was installed with `git clone`, which no longer receives the skill. Tell the user to switch to the plugin
(one time), which can also update itself automatically:

```bash
claude plugin marketplace add yanircalisar/add-crm-skill
claude plugin install add-crm@add-crm-skill
```

Then, in Claude Code: `/plugin` → **Marketplaces** → **add-crm-skill** → **Enable auto-update**.
After that they can delete this old copy (for example `rm -rf ~/.claude/skills/add-crm`) and start a new session.
The skill is then available as `/add-crm:add-crm`.

Do not run the old CRM steps from here.
