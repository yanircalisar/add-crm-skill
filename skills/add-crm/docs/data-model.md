# Data model

The generated CRM follows the concepts of the Salesforce Object Reference
(https://developer.salesforce.com/docs/platform/object-reference/guide): object and field API names, record IDs,
system fields, relationship types and the security model. The code is our own; only the public concepts are reused
(see `legal-and-sources.md`, rule 4).

The standard objects live in the `add-crm-core` package (`packages/core/src/api/objects.ts`); each project adds its
own in `CRM/crm.model.mjs` (see `custom-objects.md`). `npm run migrate` generates the SQL migrations from both, so
table names equal object API names and column names equal field API names.

## Record IDs
- 18 characters: a 3-character **key prefix** (the object type), 12 characters, and a 3-character case-safe suffix.
- The API accepts 15- or 18-character IDs and always returns 18.
- The type of any ID is known from its prefix, which is how polymorphic fields (`WhoId`, `WhatId`) and
  `/lightning/r/{Id}` work.

| Object | Prefix | | Object | Prefix |
|---|---|---|---|---|
| Account | 001 | | Task | 00T |
| Contact | 003 | | Event | 00U |
| Lead | 00Q | | User | 005 |
| Opportunity | 006 | | Profile | 00e |
| OpportunityContactRole | 00K | | UserRole | 00E |
| Case | 500 | | ObjectPermissions | 110 |

Custom objects get the next free prefix starting at `a00` and an API name ending in `__c` (custom fields too).

## System fields (every object)
`Id`, `OwnerId` (except detail objects), `CreatedDate`, `CreatedById`, `LastModifiedDate`, `LastModifiedById`,
`SystemModstamp`, `IsDeleted`. They are read-only through the API.

## Standard objects and key fields
- **Account**: `Name`, `ParentId` (Account), `Type`, `Industry`, `AnnualRevenue`, `NumberOfEmployees`, billing address.
- **Contact**: `FirstName`, `LastName`, compound `Name`, `AccountId`, `ReportsToId` (Contact), `Email`, `Phone`, `Title`.
- **Lead**: `FirstName`, `LastName`, `Company`, `Status`, `LeadSource`, `Rating`, plus `IsConverted`,
  `ConvertedAccountId`, `ConvertedContactId`, `ConvertedOpportunityId`, `ConvertedDate`.
- **Opportunity**: `Name`, `AccountId`, `StageName`, `Amount`, `CloseDate`, `Probability`, `ForecastCategoryName`,
  `IsClosed`, `IsWon`. Stage metadata (closed/won/probability/forecast) lives in `OPPORTUNITY_STAGES`.
- **OpportunityContactRole**: `OpportunityId` (master), `ContactId`, `Role`, `IsPrimary`.
- **Case**: auto-number `CaseNumber`, `Subject`, `Status`, `Priority`, `Origin`, `AccountId`, `ContactId`, `IsClosed`, `ClosedDate`.
- **Task**: `Subject`, `Status`, `ActivityDate`, `Priority`, `TaskSubtype` (Task, Call, Email), `WhoId`, `WhatId`, `IsClosed`.
- **Event**: `Subject`, `StartDateTime`, `EndDateTime`, `IsAllDayEvent`, `Location`, `WhoId`, `WhatId`.

## Relationships
| Type | How it works here | Example |
|---|---|---|
| Lookup | reference field, optional, record lives on its own | `Contact.AccountId` |
| Self lookup / hierarchy | lookup to the same object | `Account.ParentId`, `Contact.ReportsToId` |
| Master-detail | required reference with `cascadeDelete`; the child has no owner, inherits access from its master, and is deleted/restored with it | `OpportunityContactRole.OpportunityId` |
| Polymorphic | one field, several targets, resolved by ID prefix | `Task.WhoId` → Contact or Lead, `Task.WhatId` → Account, Opportunity or Case |
| Many-to-many | a junction object with two master-detail fields | `OpportunityContactRole` links Opportunity and Contact |

Related lists on record pages come from `childRelationships`, derived from the reference fields.

## Business logic Salesforce users expect
- Opportunity stage sets `IsClosed`, `IsWon`, `ForecastCategoryName` and a default `Probability`.
- Closing a Case sets `IsClosed` and `ClosedDate`; completing a Task sets `IsClosed`.
- **Convert Lead** creates an Account (or uses an existing one), a Contact and optionally an Opportunity with a primary
  contact role, moves the lead's activities to the contact, and locks the lead.
- **Recycle Bin**: delete sets `IsDeleted`; undelete restores the record and its detail records.

## Security model
1. **Profiles**: object permissions (Read, Create, Edit, Delete, View All, Modify All), with Salesforce's dependencies
   (delete needs edit, edit needs read). Seeded: System Administrator (Modify All Data), Standard User, Read Only.
2. **Organization-wide defaults** per object: Private, Public Read Only, Public Read/Write, Controlled by Parent.
3. **Role hierarchy**: users see and edit records owned by users in roles below them. Seeded: CEO → Sales Manager → Sales Rep.
4. **Ownership**: the owner always has access (within their profile's object permissions).
Forbidden and missing records both return 404, so IDs can't be probed.

## API (Salesforce REST shapes)
| Salesforce | Here |
|---|---|
| `GET /services/data/vXX/sobjects` | `GET /api/sobjects` |
| `GET .../sobjects/Account/describe` | `GET /api/sobjects/Account/describe` |
| `POST .../sobjects/Account` → `{ id, success, errors }` | `POST /api/sobjects/Account` |
| `GET/PATCH/DELETE .../sobjects/Account/{id}` | same under `/api/sobjects` (PATCH/DELETE return 204) |
| UI API record | `GET /api/ui-api/records/{id}` |
| errors `[{ message, errorCode, fields }]` | same, with Salesforce error codes |

Lists use simple query parameters (`q`, `sort`, `dir`, `field`/`value`, `scope`, `limit`, `offset`); SOQL is not implemented.

## Not yet
Change Owner (record transfer), sharing rules and manual shares, field-level security, record types, page layouts,
validation rules, field history, SOQL, Notes/Files.
