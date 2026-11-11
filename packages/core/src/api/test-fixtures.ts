// Sample project model shared by the tests.
import type { CrmModel, SObjectDef } from "./objects.js";

export const project: SObjectDef = {
  name: "Project__c", label: "Project", labelPlural: "Projects", keyPrefix: "a00", ownerable: true, defaultSharing: "Private",
  listFields: ["Name", "Account__c", "Status__c"], highlightFields: ["Status__c"], searchFields: ["Name"],
  fields: [
    { name: "Name", label: "Project Name", type: "string", required: true },
    { name: "Account__c", label: "Account", type: "reference", referenceTo: ["Account"] },
    { name: "Status__c", label: "Status", type: "picklist", picklistValues: ["Planned", "Active", "Done"] },
  ],
};
export const milestone: SObjectDef = {
  name: "Milestone__c", label: "Milestone", labelPlural: "Milestones", keyPrefix: "a01", ownerable: false, defaultSharing: "ControlledByParent",
  listFields: ["Name", "Due__c"], highlightFields: ["Due__c"], searchFields: ["Name"],
  fields: [
    { name: "Name", label: "Milestone", type: "string", required: true },
    { name: "Project__c", label: "Project", type: "reference", referenceTo: ["Project__c"], cascadeDelete: true },
    { name: "Due__c", label: "Due", type: "date" },
  ],
};
export const sampleModel: CrmModel = {
  stages: [
    { name: "Discovery", isClosed: false, isWon: false, probability: 20, forecastCategory: "Pipeline" },
    { name: "Proposal", isClosed: false, isWon: false, probability: 60, forecastCategory: "BestCase" },
    { name: "Won", isClosed: true, isWon: true, probability: 100, forecastCategory: "Closed" },
    { name: "Lost", isClosed: true, isWon: false, probability: 0, forecastCategory: "Omitted" },
  ],
  objects: { Project__c: project, Milestone__c: milestone },
  fields: { Account: [{ name: "Tier__c", label: "Tier", type: "picklist", picklistValues: ["Gold", "Silver"] }] },
  picklists: { "Lead.LeadSource": ["Website", "Referral"] },
};

