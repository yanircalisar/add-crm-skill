// @ts-check
// This project's CRM model: everything that makes this CRM yours. The standard objects (Account, Contact, Lead,
// Opportunity, Case, Task, Event) and the app itself come from add-crm-core and update with it.
// After changing this file run `npm run migrate`, then commit the new file in migrations/.
// Reference: https://github.com/yanircalisar/add-crm-skill/blob/main/skills/add-crm/docs/custom-objects.md
import { defineModel } from "add-crm-core";

export default defineModel({
  // Opportunity stages in pipeline order. Leave out to use the defaults.
  // stages: [
  //   { name: "Discovery", isClosed: false, isWon: false, probability: 20, forecastCategory: "Pipeline" },
  //   { name: "Closed Won", isClosed: true, isWon: true, probability: 100, forecastCategory: "Closed" },
  //   { name: "Closed Lost", isClosed: true, isWon: false, probability: 0, forecastCategory: "Omitted" },
  // ],

  // Custom objects (API names end in __c, key prefixes start at "a00").
  objects: {},

  // Custom fields on standard objects, e.g. { Account: [{ name: "Tier__c", label: "Tier", type: "picklist", picklistValues: ["Gold", "Silver"] }] }
  fields: {},

  // Picklist values for standard fields, e.g. { "Lead.LeadSource": ["Website", "Referral", "Event"] }
  picklists: {},

  // Navigation tabs, in order. Leave out for the standard tabs followed by your custom objects.
  // nav: ["Lead", "Account", "Contact", "Opportunity", "Case", "Task"],
});
