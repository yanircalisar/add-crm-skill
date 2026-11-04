// Object registry: the single source of truth for CRM objects, fields and layouts.
// Column names used in SQL come ONLY from here (never from user input).

export type FieldType = "text" | "email" | "phone" | "url" | "number" | "currency" | "date" | "picklist" | "textarea" | "lookup";

export interface Field {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  lookup?: string; // key of OBJECTS
}

export interface ObjectDef {
  table: string;
  label: string;
  plural: string;
  nameFields: string[]; // fields joined to display the record name
  listFields: string[];
  fields: Field[];
}

// Filled in by /add-crm from the interview (Phase 3d).
export const STAGES = ["Prospecting", "Qualification", "Proposal", "Negotiation", "Closed Won", "Closed Lost"];
export const CLOSED_STAGES = ["Closed Won", "Closed Lost"];

export const OBJECTS = {
  leads: {
    table: "leads", label: "Lead", plural: "Leads",
    nameFields: ["first_name", "last_name"],
    listFields: ["first_name", "last_name", "company", "email", "status"],
    fields: [
      { name: "first_name", label: "First Name", type: "text" },
      { name: "last_name", label: "Last Name", type: "text", required: true },
      { name: "company", label: "Company", type: "text" },
      { name: "email", label: "Email", type: "email" },
      { name: "phone", label: "Phone", type: "phone" },
      { name: "status", label: "Lead Status", type: "picklist", options: ["Open", "Working", "Nurturing", "Qualified", "Unqualified"] },
      { name: "source", label: "Lead Source", type: "picklist", options: ["Web", "Referral", "Event", "Social", "Partner", "Other"] },
    ],
  },
  accounts: {
    table: "accounts", label: "Account", plural: "Accounts",
    nameFields: ["name"],
    listFields: ["name", "industry", "phone", "billing_city"],
    fields: [
      { name: "name", label: "Account Name", type: "text", required: true },
      { name: "industry", label: "Industry", type: "text" },
      { name: "website", label: "Website", type: "url" },
      { name: "phone", label: "Phone", type: "phone" },
      { name: "billing_city", label: "Billing City", type: "text" },
      { name: "billing_country", label: "Billing Country", type: "text" },
      { name: "annual_revenue", label: "Annual Revenue", type: "currency" },
      { name: "employees", label: "Employees", type: "number" },
    ],
  },
  contacts: {
    table: "contacts", label: "Contact", plural: "Contacts",
    nameFields: ["first_name", "last_name"],
    listFields: ["first_name", "last_name", "email", "phone", "title"],
    fields: [
      { name: "first_name", label: "First Name", type: "text" },
      { name: "last_name", label: "Last Name", type: "text", required: true },
      { name: "account_id", label: "Account", type: "lookup", lookup: "accounts" },
      { name: "email", label: "Email", type: "email" },
      { name: "phone", label: "Phone", type: "phone" },
      { name: "title", label: "Title", type: "text" },
    ],
  },
  opportunities: {
    table: "opportunities", label: "Opportunity", plural: "Opportunities",
    nameFields: ["name"],
    listFields: ["name", "stage", "amount", "close_date"],
    fields: [
      { name: "name", label: "Opportunity Name", type: "text", required: true },
      { name: "account_id", label: "Account", type: "lookup", lookup: "accounts" },
      { name: "stage", label: "Stage", type: "picklist", options: STAGES, required: true },
      { name: "amount", label: "Amount", type: "currency" },
      { name: "close_date", label: "Close Date", type: "date" },
      { name: "probability", label: "Probability (%)", type: "number" },
    ],
  },
  cases: {
    table: "cases", label: "Case", plural: "Cases",
    nameFields: ["subject"],
    listFields: ["subject", "status", "priority"],
    fields: [
      { name: "subject", label: "Subject", type: "text", required: true },
      { name: "account_id", label: "Account", type: "lookup", lookup: "accounts" },
      { name: "contact_id", label: "Contact", type: "lookup", lookup: "contacts" },
      { name: "status", label: "Status", type: "picklist", options: ["New", "Working", "Escalated", "Closed"] },
      { name: "priority", label: "Priority", type: "picklist", options: ["Low", "Medium", "High"] },
      { name: "description", label: "Description", type: "textarea" },
    ],
  },
  tasks: {
    table: "tasks", label: "Task", plural: "Tasks",
    nameFields: ["subject"],
    listFields: ["subject", "due_date", "status", "priority"],
    fields: [
      { name: "subject", label: "Subject", type: "text", required: true },
      { name: "due_date", label: "Due Date", type: "date" },
      { name: "status", label: "Status", type: "picklist", options: ["Not Started", "In Progress", "Completed"] },
      { name: "priority", label: "Priority", type: "picklist", options: ["Low", "Normal", "High"] },
      { name: "related_object", label: "Related To (object)", type: "text" },
      { name: "related_id", label: "Related To (id)", type: "text" },
    ],
  },
  activities: {
    table: "activities", label: "Activity", plural: "Activities",
    nameFields: ["subject"],
    listFields: ["type", "subject", "created_at"],
    fields: [
      { name: "type", label: "Type", type: "picklist", options: ["Call", "Note", "Email", "Meeting"], required: true },
      { name: "subject", label: "Subject", type: "text", required: true },
      { name: "body", label: "Details", type: "textarea" },
      { name: "related_object", label: "Related To (object)", type: "text", required: true },
      { name: "related_id", label: "Related To (id)", type: "text", required: true },
    ],
  },
} satisfies Record<string, ObjectDef>;

export type ObjectName = keyof typeof OBJECTS;

export function getObject(name: string): ObjectDef | null {
  return Object.prototype.hasOwnProperty.call(OBJECTS, name) ? (OBJECTS as Record<string, ObjectDef>)[name] : null;
}

// Child relationships shown as related lists on record pages.
export const RELATED: Record<string, { object: ObjectName; field: string }[]> = {
  accounts: [
    { object: "contacts", field: "account_id" },
    { object: "opportunities", field: "account_id" },
    { object: "cases", field: "account_id" },
  ],
  contacts: [{ object: "cases", field: "contact_id" }],
};
