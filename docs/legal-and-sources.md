# Legal and sources

This project must stay clean to use and redistribute. These rules apply to the skill, the template and anything the
skill generates for users.

## Rules
1. **No trademarks or brand assets.** No Salesforce, HubSpot or other vendor names, logos, icons, fonts, product
   screenshots or marketing copy in the generated UI or in the repo. Product names appear only in docs, to describe
   style or compatibility ("Salesforce-style"), with the disclaimer in the README.
2. **No copied code or content.** Do not copy vendor source, CSS, vendor docs text or Trailhead content. Write our own.
3. **Public and allowed only.** Reuse an external resource only if its license clearly permits it. Before using one:
   read its license file, confirm it covers the specific assets (code, icons and fonts are often licensed
   separately), and record it in `NOTICE` with the name, URL, license and what we use.
4. **Ideas are fine.** Layout patterns, object models (leads, accounts, contacts, deals), pipeline stages and
   general UX conventions are not protected. We implement them ourselves.
5. **No scraping.** The research step reads public pages for ideas and cites URLs. It must not bulk-copy or
   redistribute their content and must respect robots.txt and site terms.
6. **Third-party packages** are limited to permissive licenses (MIT, BSD, Apache-2.0, ISC) and are pinned exactly.

## Design systems
- Vendor design systems (for example Salesforce Lightning Design System) may be open source for their CSS and
  tokens, while their fonts, icons and logos carry separate, often restrictive terms. Check the current license
  before use. Default: don't depend on them. Our own tokens in `styles.css` take inspiration only, with system
  fonts and our own icons.
- If a permissively licensed asset is adopted, add it to `NOTICE` and keep its license text.

## Marketing automation and user data
- Send only to contacts with recorded consent, include a working unsubscribe link and the sender's postal details
  where the law requires it (CAN-SPAM, GDPR/ePrivacy, CASL).
- Keep each user's data in their own database. This project never receives it.
- Keep secrets out of the repo: see `.gitignore`, `wrangler secret put` and `.dev.vars`.
