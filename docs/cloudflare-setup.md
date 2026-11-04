# Cloudflare setup guide (for the CRM)

The skill walks the user through these steps. Steps marked 👤 need the user in a browser.

## 1. Account 👤
- Have an account? Go to step 2.
- No account: sign up at https://dash.cloudflare.com/sign-up (email + password, verify the email).
  The free plan covers Workers and D1 for a small team CRM.

## 2. Log in the CLI 👤
```bash
cd CRM
npx wrangler login      # opens the browser, click "Allow"
npx wrangler whoami     # confirms the account
```
No browser (cloud/CI)? Create an API token at https://dash.cloudflare.com/profile/api-tokens
with "Edit Cloudflare Workers" + "D1 Edit", then `export CLOUDFLARE_API_TOKEN=...` (never commit it).

## 3. Create the database
```bash
npx wrangler d1 create crm-db
```
Copy the printed `database_id` into `wrangler.toml` (`{{D1_DATABASE_ID}}`).

## 4. Secrets
Local development uses `CRM/.dev.vars` (gitignored, copy from `.dev.vars.example`).
Production:
```bash
npx wrangler secret put SESSION_SECRET   # any long random string: openssl rand -hex 32
npx wrangler secret put RESEND_API_KEY   # only if email is enabled; reuse the host's key if approved
```

## 5. Migrate, seed, deploy
```bash
npm run db:migrate:local && npm run dev          # local check
npm run db:migrate:remote && npm run deploy      # production, after approval
npm run seed:admin -- you@example.com            # one-time invite link for the first admin
```

## Troubleshooting
- `Authentication error`: run `npx wrangler login` again or check the API token's permissions.
- `no such table`: migrations weren't applied to that environment (local vs remote).
