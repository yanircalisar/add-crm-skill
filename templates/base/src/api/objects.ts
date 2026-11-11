// Object registry, modeled on the Salesforce Object Reference: API names, key prefixes, standard fields,
// system fields, lookup / master-detail / polymorphic relationships. Table and column names equal API names.
// Column names used in SQL come ONLY from here (never from user input).

export type FieldType =
  | "id" | "string" | "textarea" | "email" | "phone" | "url" | "picklist" | "boolean"
  | "int" | "double" | "currency" | "percent" | "date" | "datetime" | "reference" | "autonumber";

export interface FieldDef {
  name: string;            // API name, e.g. "AccountId"; custom fields end in "__c"
  label: string;
  type: FieldType;
  required?: boolean;      // nillable = false
  length?: number;
  picklistValues?: string[];
  referenceTo?: string[];  // more than one entry = polymorphic (e.g. Task.WhoId -> Contact | Lead)
  relationshipName?: string; // e.g. "Account" for AccountId
  cascadeDelete?: boolean; // master-detail: deleting the parent deletes the children
  createable?: boolean;    // default true
  updateable?: boolean;    // default true
  calculated?: boolean;    // formula / compound (read-only)
}

export type Sharing = "Private" | "Read" | "ReadWrite" | "ControlledByParent";

export interface SObjectDef {
  name: string;            // API name, e.g. "Account"; custom objects end in "__c"
  label: string;
  labelPlural: string;
  keyPrefix: string;       // first 3 chars of every record ID
  ownerable: boolean;      // has OwnerId (detail objects in a master-detail don't)
  defaultSharing: Sharing; // org-wide default
  listFields: string[];
  highlightFields: string[];
  searchFields: string[];
  fields: FieldDef[];      // standard + custom fields (system fields are added by withSystemFields)
}

export interface StageDef { name: string; isClosed: boolean; isWon: boolean; probability: number; forecastCategory: string }

// Opportunity stages (filled in by /add-crm from the interview, Phase 3d).
export const OPPORTUNITY_STAGES: StageDef[] = [
  { name: "Prospecting", isClosed: false, isWon: false, probability: 10, forecastCategory: "Pipeline" },
  { name: "Qualification", isClosed: false, isWon: false, probability: 20, forecastCategory: "Pipeline" },
  { name: "Needs Analysis", isClosed: false, isWon: false, probability: 40, forecastCategory: "Pipeline" },
  { name: "Proposal/Price Quote", isClosed: false, isWon: false, probability: 60, forecastCategory: "BestCase" },
  { name: "Negotiation/Review", isClosed: false, isWon: false, probability: 80, forecastCategory: "Commit" },
  { name: "Closed Won", isClosed: true, isWon: true, probability: 100, forecastCategory: "Closed" },
  { name: "Closed Lost", isClosed: true, isWon: false, probability: 0, forecastCategory: "Omitted" },
];

export const LEAD_STATUSES = ["Open - Not Contacted", "Working - Contacted", "Closed - Converted", "Closed - Not Converted"];
export const LEAD_CONVERTED_STATUS = "Closed - Converted";
export const CASE_STATUSES = ["New", "Working", "Escalated", "Closed"];
export const CASE_CLOSED_STATUSES = ["Closed"];
export const TASK_STATUSES = ["Not Started", "In Progress", "Completed", "Waiting on someone else", "Deferred"];
export const TASK_CLOSED_STATUSES = ["Completed"];
const LEAD_SOURCES = ["Web", "Phone Inquiry", "Partner Referral", "Purchased List", "Other"];
const INDUSTRIES = ["Agriculture", "Banking", "Construction", "Consulting", "Education", "Energy", "Entertainment",
  "Finance", "Healthcare", "Hospitality", "Insurance", "Manufacturing", "Media", "Retail", "Technology",
  "Telecommunications", "Transportation", "Other"];

const WHO = ["Contact", "Lead"];
const WHAT = ["Account", "Opportunity", "Case"];

export const OBJECTS: Record<string, SObjectDef> = {
  Account: {
    name: "Account", label: "Account", labelPlural: "Accounts", keyPrefix: "001", ownerable: true, defaultSharing: "Private",
    listFields: ["Name", "Type", "Industry", "Phone", "BillingCity"],
    highlightFields: ["Type", "Phone", "Website", "Industry"],
    searchFields: ["Name", "Phone", "Website"],
    fields: [
      { name: "Name", label: "Account Name", type: "string", required: true },
      { name: "ParentId", label: "Parent Account", type: "reference", referenceTo: ["Account"], relationshipName: "Parent" },
      { name: "Type", label: "Type", type: "picklist", picklistValues: ["Prospect", "Customer - Direct", "Customer - Channel", "Partner", "Other"] },
      { name: "Industry", label: "Industry", type: "picklist", picklistValues: INDUSTRIES },
      { name: "Website", label: "Website", type: "url" },
      { name: "Phone", label: "Phone", type: "phone" },
      { name: "AnnualRevenue", label: "Annual Revenue", type: "currency" },
      { name: "NumberOfEmployees", label: "Employees", type: "int" },
      { name: "AccountSource", label: "Account Source", type: "picklist", picklistValues: LEAD_SOURCES },
      { name: "BillingStreet", label: "Billing Street", type: "textarea", length: 255 },
      { name: "BillingCity", label: "Billing City", type: "string" },
      { name: "BillingState", label: "Billing State/Province", type: "string" },
      { name: "BillingPostalCode", label: "Billing Zip/Postal Code", type: "string" },
      { name: "BillingCountry", label: "Billing Country", type: "string" },
      { name: "Description", label: "Description", type: "textarea" },
    ],
  },
  Contact: {
    name: "Contact", label: "Contact", labelPlural: "Contacts", keyPrefix: "003", ownerable: true, defaultSharing: "Private",
    listFields: ["Name", "AccountId", "Title", "Phone", "Email"],
    highlightFields: ["Title", "AccountId", "Phone", "Email"],
    searchFields: ["FirstName", "LastName", "Email", "Phone"],
    fields: [
      { name: "Name", label: "Name", type: "string", calculated: true, createable: false, updateable: false },
      { name: "Salutation", label: "Salutation", type: "picklist", picklistValues: ["Mr.", "Ms.", "Mrs.", "Dr.", "Prof."] },
      { name: "FirstName", label: "First Name", type: "string" },
      { name: "LastName", label: "Last Name", type: "string", required: true },
      { name: "AccountId", label: "Account Name", type: "reference", referenceTo: ["Account"], relationshipName: "Account" },
      { name: "Title", label: "Title", type: "string" },
      { name: "Department", label: "Department", type: "string" },
      { name: "Email", label: "Email", type: "email" },
      { name: "Phone", label: "Phone", type: "phone" },
      { name: "MobilePhone", label: "Mobile", type: "phone" },
      { name: "ReportsToId", label: "Reports To", type: "reference", referenceTo: ["Contact"], relationshipName: "ReportsTo" },
      { name: "LeadSource", label: "Lead Source", type: "picklist", picklistValues: LEAD_SOURCES },
      { name: "MailingCity", label: "Mailing City", type: "string" },
      { name: "MailingCountry", label: "Mailing Country", type: "string" },
      { name: "Description", label: "Description", type: "textarea" },
    ],
  },
  Lead: {
    name: "Lead", label: "Lead", labelPlural: "Leads", keyPrefix: "00Q", ownerable: true, defaultSharing: "Private",
    listFields: ["Name", "Company", "Email", "Status", "LeadSource"],
    highlightFields: ["Title", "Company", "Phone", "Email"],
    searchFields: ["FirstName", "LastName", "Company", "Email", "Phone"],
    fields: [
      { name: "Name", label: "Name", type: "string", calculated: true, createable: false, updateable: false },
      { name: "Salutation", label: "Salutation", type: "picklist", picklistValues: ["Mr.", "Ms.", "Mrs.", "Dr.", "Prof."] },
      { name: "FirstName", label: "First Name", type: "string" },
      { name: "LastName", label: "Last Name", type: "string", required: true },
      { name: "Company", label: "Company", type: "string", required: true },
      { name: "Title", label: "Title", type: "string" },
      { name: "Email", label: "Email", type: "email" },
      { name: "Phone", label: "Phone", type: "phone" },
      { name: "Status", label: "Lead Status", type: "picklist", picklistValues: LEAD_STATUSES, required: true },
      { name: "LeadSource", label: "Lead Source", type: "picklist", picklistValues: LEAD_SOURCES },
      { name: "Industry", label: "Industry", type: "picklist", picklistValues: INDUSTRIES },
      { name: "Rating", label: "Rating", type: "picklist", picklistValues: ["Hot", "Warm", "Cold"] },
      { name: "AnnualRevenue", label: "Annual Revenue", type: "currency" },
      { name: "NumberOfEmployees", label: "No. of Employees", type: "int" },
      { name: "Description", label: "Description", type: "textarea" },
      { name: "IsConverted", label: "Converted", type: "boolean", createable: false, updateable: false },
      { name: "ConvertedDate", label: "Converted Date", type: "date", createable: false, updateable: false },
      { name: "ConvertedAccountId", label: "Converted Account", type: "reference", referenceTo: ["Account"], relationshipName: "ConvertedAccount", createable: false, updateable: false },
      { name: "ConvertedContactId", label: "Converted Contact", type: "reference", referenceTo: ["Contact"], relationshipName: "ConvertedContact", createable: false, updateable: false },
      { name: "ConvertedOpportunityId", label: "Converted Opportunity", type: "reference", referenceTo: ["Opportunity"], relationshipName: "ConvertedOpportunity", createable: false, updateable: false },
    ],
  },
  Opportunity: {
    name: "Opportunity", label: "Opportunity", labelPlural: "Opportunities", keyPrefix: "006", ownerable: true, defaultSharing: "Private",
    listFields: ["Name", "AccountId", "StageName", "Amount", "CloseDate"],
    highlightFields: ["AccountId", "CloseDate", "Amount", "StageName"],
    searchFields: ["Name"],
    fields: [
      { name: "Name", label: "Opportunity Name", type: "string", required: true },
      { name: "AccountId", label: "Account Name", type: "reference", referenceTo: ["Account"], relationshipName: "Account" },
      { name: "StageName", label: "Stage", type: "picklist", picklistValues: OPPORTUNITY_STAGES.map((s) => s.name), required: true },
      { name: "Amount", label: "Amount", type: "currency" },
      { name: "CloseDate", label: "Close Date", type: "date", required: true },
      { name: "Probability", label: "Probability (%)", type: "percent" },
      { name: "Type", label: "Type", type: "picklist", picklistValues: ["New Customer", "Existing Customer - Upgrade", "Existing Customer - Replacement", "Existing Customer - Downgrade"] },
      { name: "LeadSource", label: "Lead Source", type: "picklist", picklistValues: LEAD_SOURCES },
      { name: "NextStep", label: "Next Step", type: "string" },
      { name: "Description", label: "Description", type: "textarea" },
      { name: "ForecastCategoryName", label: "Forecast Category", type: "string", createable: false, updateable: false },
      { name: "IsClosed", label: "Closed", type: "boolean", createable: false, updateable: false },
      { name: "IsWon", label: "Won", type: "boolean", createable: false, updateable: false },
    ],
  },
  OpportunityContactRole: {
    name: "OpportunityContactRole", label: "Contact Role", labelPlural: "Contact Roles", keyPrefix: "00K", ownerable: false, defaultSharing: "ControlledByParent",
    listFields: ["ContactId", "Role", "IsPrimary"],
    highlightFields: ["OpportunityId", "ContactId", "Role"],
    searchFields: ["Role"],
    fields: [
      { name: "OpportunityId", label: "Opportunity", type: "reference", referenceTo: ["Opportunity"], relationshipName: "Opportunity", required: true, cascadeDelete: true, updateable: false },
      { name: "ContactId", label: "Contact", type: "reference", referenceTo: ["Contact"], relationshipName: "Contact", required: true },
      { name: "Role", label: "Role", type: "picklist", picklistValues: ["Business User", "Decision Maker", "Economic Buyer", "Evaluator", "Executive Sponsor", "Influencer", "Technical Buyer", "Other"] },
      { name: "IsPrimary", label: "Primary", type: "boolean" },
    ],
  },
  Case: {
    name: "Case", label: "Case", labelPlural: "Cases", keyPrefix: "500", ownerable: true, defaultSharing: "Private",
    listFields: ["CaseNumber", "Subject", "Status", "Priority", "AccountId"],
    highlightFields: ["Priority", "Status", "AccountId", "ContactId"],
    searchFields: ["CaseNumber", "Subject"],
    fields: [
      { name: "CaseNumber", label: "Case Number", type: "autonumber", createable: false, updateable: false },
      { name: "Subject", label: "Subject", type: "string", required: true },
      { name: "AccountId", label: "Account Name", type: "reference", referenceTo: ["Account"], relationshipName: "Account" },
      { name: "ContactId", label: "Contact Name", type: "reference", referenceTo: ["Contact"], relationshipName: "Contact" },
      { name: "Status", label: "Status", type: "picklist", picklistValues: CASE_STATUSES, required: true },
      { name: "Priority", label: "Priority", type: "picklist", picklistValues: ["High", "Medium", "Low"] },
      { name: "Origin", label: "Case Origin", type: "picklist", picklistValues: ["Phone", "Email", "Web"] },
      { name: "Type", label: "Type", type: "picklist", picklistValues: ["Question", "Problem", "Feature Request"] },
      { name: "Description", label: "Description", type: "textarea" },
      { name: "IsClosed", label: "Closed", type: "boolean", createable: false, updateable: false },
      { name: "ClosedDate", label: "Date/Time Closed", type: "datetime", createable: false, updateable: false },
    ],
  },
  Task: {
    name: "Task", label: "Task", labelPlural: "Tasks", keyPrefix: "00T", ownerable: true, defaultSharing: "Private",
    listFields: ["Subject", "WhoId", "WhatId", "ActivityDate", "Status"],
    highlightFields: ["ActivityDate", "Status", "Priority", "WhoId"],
    searchFields: ["Subject"],
    fields: [
      { name: "Subject", label: "Subject", type: "string", required: true },
      { name: "TaskSubtype", label: "Task Subtype", type: "picklist", picklistValues: ["Task", "Call", "Email"], updateable: false },
      { name: "ActivityDate", label: "Due Date", type: "date" },
      { name: "Status", label: "Status", type: "picklist", picklistValues: TASK_STATUSES, required: true },
      { name: "Priority", label: "Priority", type: "picklist", picklistValues: ["High", "Normal", "Low"] },
      { name: "WhoId", label: "Name", type: "reference", referenceTo: WHO, relationshipName: "Who" },
      { name: "WhatId", label: "Related To", type: "reference", referenceTo: WHAT, relationshipName: "What" },
      { name: "Description", label: "Comments", type: "textarea" },
      { name: "IsClosed", label: "Closed", type: "boolean", createable: false, updateable: false },
    ],
  },
  Event: {
    name: "Event", label: "Event", labelPlural: "Events", keyPrefix: "00U", ownerable: true, defaultSharing: "Private",
    listFields: ["Subject", "StartDateTime", "WhoId", "WhatId"],
    highlightFields: ["StartDateTime", "EndDateTime", "Location", "WhoId"],
    searchFields: ["Subject", "Location"],
    fields: [
      { name: "Subject", label: "Subject", type: "string", required: true },
      { name: "StartDateTime", label: "Start", type: "datetime", required: true },
      { name: "EndDateTime", label: "End", type: "datetime", required: true },
      { name: "IsAllDayEvent", label: "All-Day Event", type: "boolean" },
      { name: "Location", label: "Location", type: "string" },
      { name: "WhoId", label: "Name", type: "reference", referenceTo: WHO, relationshipName: "Who" },
      { name: "WhatId", label: "Related To", type: "reference", referenceTo: WHAT, relationshipName: "What" },
      { name: "Description", label: "Description", type: "textarea" },
    ],
  },
};

/** System fields every object has (Salesforce audit fields). */
export function systemFields(def: SObjectDef): FieldDef[] {
  const ro = { createable: false, updateable: false };
  return [
    { name: "Id", label: `${def.label} ID`, type: "id", ...ro },
    ...(def.ownerable ? [{ name: "OwnerId", label: `${def.label} Owner`, type: "reference", referenceTo: ["User"], relationshipName: "Owner", createable: false, updateable: false } as FieldDef] : []),
    { name: "CreatedDate", label: "Created Date", type: "datetime", ...ro },
    { name: "CreatedById", label: "Created By", type: "reference", referenceTo: ["User"], relationshipName: "CreatedBy", ...ro },
    { name: "LastModifiedDate", label: "Last Modified Date", type: "datetime", ...ro },
    { name: "LastModifiedById", label: "Last Modified By", type: "reference", referenceTo: ["User"], relationshipName: "LastModifiedBy", ...ro },
    { name: "SystemModstamp", label: "System Modstamp", type: "datetime", ...ro },
    { name: "IsDeleted", label: "Deleted", type: "boolean", ...ro },
  ];
}

export const allFields = (def: SObjectDef): FieldDef[] => [...systemFields(def), ...def.fields];

export function getObject(name: string): SObjectDef | null {
  return Object.prototype.hasOwnProperty.call(OBJECTS, name) ? OBJECTS[name]! : null;
}

/** Look up the object type from a record ID's key prefix (how Salesforce resolves polymorphic IDs). */
export function objectForId(id: string): SObjectDef | null {
  const prefix = id.slice(0, 3);
  return Object.values(OBJECTS).find((o) => o.keyPrefix === prefix) ?? null;
}

export interface ChildRelationship { childSObject: string; field: string; relationshipName: string; cascadeDelete: boolean }

/** Child relationships of an object, derived from the reference fields that point at it (describe().childRelationships). */
export function childRelationships(name: string): ChildRelationship[] {
  const out: ChildRelationship[] = [];
  for (const child of Object.values(OBJECTS)) {
    for (const f of child.fields) {
      // Single-target, user-settable lookups only; polymorphic activity links (WhoId/WhatId) show in the activity timeline.
      if (f.type === "reference" && f.referenceTo?.length === 1 && f.referenceTo[0] === name && f.createable !== false) {
        out.push({ childSObject: child.name, field: f.name, relationshipName: child.labelPlural.replace(/\s+/g, ""), cascadeDelete: !!f.cascadeDelete });
      }
    }
  }
  return out;
}

export const stageByName = (name: string) => OPPORTUNITY_STAGES.find((s) => s.name === name);

/** The display name of a record (the "Name" field, or CaseNumber/Subject for objects without one). */
export function nameFieldOf(def: SObjectDef): string {
  if (def.fields.some((f) => f.name === "Name")) return "Name";
  if (def.name === "Case") return "CaseNumber";
  if (def.fields.some((f) => f.name === "Subject")) return "Subject";
  return "Id";
}
