# Custom objects from the host database

Used in SKILL.md Phase 2b. Goal: turn the tables a project already has into useful CRM objects and connect them to
the standard ones (Lead, Account, Contact, Opportunity, Case, Task).

## 1. Find candidates
A host table is a candidate when it is not already mapped to a standard object and at least one holds:
- it has a foreign key (or a `*_id` column) to a user, customer, organization or order table
- it has a status, amount or date column (something a salesperson would track)
- it has a meaningful row count (not a lookup table with a handful of rows or a log with millions)
- the name hints at a business entity: subscriptions, bookings, events, registrations, products, projects,
  invoices, shipments, listings, courses, devices, licenses

Skip: framework tables (migrations, sessions, jobs), pure logs, auth tables, tables whose columns look secret.

## 2. Rank
Score by links to customer tables, then row count, then presence of status/amount/date columns. Show the top 5-8.

## 3. Pick the relationship
| Pattern in the host schema | Relationship | Example |
|---|---|---|
| Child has one required parent and makes no sense alone | master-detail (cascade, inherits visibility) | Invoice line -> Invoice |
| Child references a parent but lives on its own | lookup (many-to-one) | Subscription -> Account |
| Table with two foreign keys and few other columns | many-to-many via a junction object | Registration: Contact <-> Event |
| Notes, files, tasks or timeline items that point at any record | activity link | Task attached to a Booking |

When unsure, use lookup: it is the safest, and can be tightened later.

## 4. Present
Ranked list, then a text diagram, for example:
```
Account 1--* Subscription *--1 Plan
Contact *--* Event   (junction: Registration)
Subscription 1--* Invoice  (master-detail)
```
Each entry: source table, why it was suggested, proposed fields (with types and picklist options from
low-cardinality columns), relationship and parent. The user accepts, edits or rejects each one.

## 5. Config shape (`CRM/crm.config.json`)
```json
{
  "customObjects": [{ "name": "Subscription__c", "label": "Subscription", "keyPrefix": "a00", "source": "subscriptions", "fields": [] }],
  "relationships": [{ "from": "Subscription__c", "to": "Account", "type": "lookup", "field": "Account__c" }]
}
```
`type` is one of `lookup`, `master-detail`, `many-to-many`, `activity`.

## Template support
- **Available now:** custom objects in the project's `CRM/crm.model.mjs` (`objects`, `fields`), lookup relationships,
  master-detail (`cascadeDelete: true`, `ownerable: false`, `defaultSharing: "ControlledByParent"`: cascade delete
  and restore, inherited access), and many-to-many through a junction object with two master-detail fields
  (`OpportunityContactRole` is the built-in example). Related lists appear automatically.
- **Planned:** activity links (`WhoId`/`WhatId`) to custom objects. The skill must say so and not fake them.
- **Naming:** follow `docs/data-model.md`: API names end in `__c` (`Subscription__c`, `Plan__c`), reference fields
  end in `__c` too (`Account__c`), and each custom object gets the next free key prefix from `a00`.
  After editing `crm.model.mjs` run `npm run migrate`: it writes only the next numbered migration (new tables and
  columns), never edits an applied one and never drops data. `npm run check` validates the model.

## Example `crm.model.mjs`
```js
import { defineModel } from "add-crm-core";

export default defineModel({
  objects: {
    Subscription__c: {
      name: "Subscription__c", label: "Subscription", labelPlural: "Subscriptions", keyPrefix: "a00",
      ownerable: true, defaultSharing: "Private",
      listFields: ["Name", "Account__c", "Plan__c"], highlightFields: ["Account__c", "Plan__c"], searchFields: ["Name"],
      fields: [
        { name: "Name", label: "Subscription Name", type: "string", required: true },
        { name: "Account__c", label: "Account", type: "reference", referenceTo: ["Account"] },
        { name: "Plan__c", label: "Plan", type: "picklist", picklistValues: ["Free", "Pro", "Team"] },
      ],
    },
    // Master-detail child: ownerable false, sharing ControlledByParent, one field with cascadeDelete.
    Invoice__c: {
      name: "Invoice__c", label: "Invoice", labelPlural: "Invoices", keyPrefix: "a01",
      ownerable: false, defaultSharing: "ControlledByParent",
      listFields: ["Name", "Amount__c"], highlightFields: ["Amount__c"], searchFields: ["Name"],
      fields: [
        { name: "Name", label: "Invoice Number", type: "string", required: true },
        { name: "Subscription__c", label: "Subscription", type: "reference", referenceTo: ["Subscription__c"], cascadeDelete: true },
        { name: "Amount__c", label: "Amount", type: "currency" },
      ],
    },
  },
  fields: { Account: [{ name: "Tier__c", label: "Tier", type: "picklist", picklistValues: ["Gold", "Silver"] }] },
  picklists: { "Lead.LeadSource": ["Website", "Referral", "Event"] },
  // stages: [...]  // Opportunity stages; one must be closed+won and one closed+lost
  // nav: [...]     // tabs; default is the standard tabs followed by the custom objects
});
```
Field types: `string`, `textarea`, `email`, `phone`, `url`, `picklist`, `boolean`, `int`, `double`, `currency`,
`percent`, `date`, `datetime`, `reference`, `autonumber`. The model is checked when the CRM starts, by `npm run check`
and before every deploy; every problem is listed with its path (e.g. `objects.Invoice__c.Amount__c`).

## Privacy
The scan reads schema and aggregate counts only. No raw rows, and personal or secret-looking columns are only noted
as existing. Nothing from the user's database leaves their machine except through the tools they approved.
