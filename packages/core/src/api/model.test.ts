import { afterEach, describe, expect, it } from "vitest";
import { applyModel, childRelationships, getObject, NAV, OBJECTS, OPPORTUNITY_STAGES, type CrmModel } from "./objects.js";
import { project, sampleModel } from "./test-fixtures.js";
import { validateRecord } from "./validate.js";

afterEach(() => applyModel({}));

describe("applyModel", () => {
  it("adds custom objects, custom fields, stages, picklists and nav", () => {
    applyModel(sampleModel);
    expect(getObject("Project__c")?.keyPrefix).toBe("a00");
    expect(OBJECTS.Account!.fields.some((f) => f.name === "Tier__c")).toBe(true);
    expect(OPPORTUNITY_STAGES.map((s) => s.name)).toEqual(["Discovery", "Proposal", "Won", "Lost"]);
    expect(getObject("Opportunity")!.fields.find((f) => f.name === "StageName")!.picklistValues).toEqual(["Discovery", "Proposal", "Won", "Lost"]);
    expect(getObject("Lead")!.fields.find((f) => f.name === "LeadSource")!.picklistValues).toEqual(["Website", "Referral"]);
    expect(NAV).toEqual(["Lead", "Account", "Contact", "Opportunity", "Case", "Task", "Project__c", "Milestone__c"]);
    expect(childRelationships("Project__c")).toEqual([{ childSObject: "Milestone__c", field: "Project__c", relationshipName: "Milestones", cascadeDelete: true }]);
    expect(validateRecord(getObject("Opportunity")!, { Name: "x", StageName: "Prospecting", CloseDate: "2026-01-01" }, "create").errors[0]?.errorCode)
      .toBe("INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST");
  });
  it("starts from the standard objects every time", () => {
    applyModel(sampleModel);
    applyModel({});
    expect(getObject("Project__c")).toBeNull();
    expect(OBJECTS.Account!.fields.some((f) => f.name === "Tier__c")).toBe(false);
    expect(OPPORTUNITY_STAGES[0]!.name).toBe("Prospecting");
    expect(NAV).toEqual(["Lead", "Account", "Contact", "Opportunity", "Case", "Task"]);
  });
  it("leaves the registry untouched when the model is invalid", () => {
    expect(() => applyModel({ objects: { Project__c: { ...project, keyPrefix: "001" } } })).toThrow(/already used by Account/);
    expect(getObject("Project__c")).toBeNull();
  });
  it.each<[string, CrmModel, RegExp]>([
    ["redefining a standard object", { objects: { Account: project } }, /standard objects can't be redefined/],
    ["a bad object name", { objects: { "Bad Name": { ...project, name: "Bad Name" } } }, /look like Project__c/],
    ["SQL in a field name", { objects: { Project__c: { ...project, fields: [{ name: 'x"; DROP TABLE User; --__c', label: "x", type: "string" }] } } }, /custom field API names/],
    ["a non-custom field on a standard object", { fields: { Account: [{ name: "Tier", label: "Tier", type: "string" }] } }, /look like Tier__c/],
    ["an unknown reference", { objects: { Project__c: { ...project, fields: [...project.fields, { name: "X__c", label: "X", type: "reference", referenceTo: ["Nope__c"] }] } } }, /unknown object "Nope__c"/],
    ["no won stage", { stages: [{ name: "Lost", isClosed: true, isWon: false, probability: 0, forecastCategory: "Omitted" }] }, /closed and won/],
    ["dropping the converted lead status", { picklists: { "Lead.Status": ["Open"] } }, /must keep "Closed - Converted"/],
    ["a picklist override on a text field", { picklists: { "Account.Name": ["a"] } }, /not a picklist field/],
    ["an unknown nav entry", { nav: ["Lead", "Nope__c"] }, /nav: unknown object/],
    ["an unknown list field", { objects: { Project__c: { ...project, listFields: ["Nope__c"] } } }, /unknown field "Nope__c"/],
    ["ControlledByParent without a master", { objects: { Project__c: { ...project, ownerable: false, defaultSharing: "ControlledByParent" } } }, /needs a master-detail/],
  ])("rejects %s", (_, model, message) => {
    expect(() => applyModel(model)).toThrow(message);
  });
});
