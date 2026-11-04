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
  "customObjects": [{ "key": "subscriptions", "label": "Subscription", "source": "subscriptions", "fields": [] }],
  "relationships": [{ "from": "subscriptions", "to": "accounts", "type": "lookup", "field": "account_id" }]
}
```
`type` is one of `lookup`, `master-detail`, `many-to-many`, `activity`.

## Template support
- **Available now:** custom objects via the object registry, and lookup relationships with related lists.
- **Planned:** master-detail (cascade delete, inherited sharing), junction objects for many-to-many, and
  activity links on custom objects. The skill must say so and not fake them.

## Privacy
The scan reads schema and aggregate counts only. No raw rows, and personal or secret-looking columns are only noted
as existing. Nothing from the user's database leaves their machine except through the tools they approved.
