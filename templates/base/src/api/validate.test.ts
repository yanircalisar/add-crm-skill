import { describe, expect, it } from "vitest";
import { validateRecord } from "./validate";
import { getObject, childRelationships, objectForId, OBJECTS } from "./objects";
import { newId } from "./ids";

const Opportunity = getObject("Opportunity")!;
const Contact = getObject("Contact")!;
const Task = getObject("Task")!;
const codes = (r: { errors: { errorCode: string; fields: string[] }[] }) => r.errors.map((e) => `${e.fields[0]}:${e.errorCode}`);

describe("validateRecord", () => {
  it("reports missing required fields with REQUIRED_FIELD_MISSING", () => {
    expect(codes(validateRecord(Opportunity, {}, "create"))).toEqual(
      expect.arrayContaining(["Name:REQUIRED_FIELD_MISSING", "StageName:REQUIRED_FIELD_MISSING", "CloseDate:REQUIRED_FIELD_MISSING"]),
    );
  });
  it("allows partial updates", () => {
    expect(validateRecord(Opportunity, { Amount: 5 }, "update").errors).toEqual([]);
  });
  it("rejects unknown and system fields so they never reach SQL", () => {
    const r = validateRecord(Contact, { LastName: "Doe", OwnerId: newId("005"), Id: "x", "Name; DROP": 1 }, "create");
    expect(codes(r)).toEqual(["OwnerId:INVALID_FIELD_FOR_INSERT_UPDATE", "Id:INVALID_FIELD_FOR_INSERT_UPDATE", "Name; DROP:INVALID_FIELD_FOR_INSERT_UPDATE"]);
    expect(r.values).toEqual({ LastName: "Doe" });
  });
  it("rejects calculated fields like Contact.Name", () => {
    expect(codes(validateRecord(Contact, { Name: "x", LastName: "y" }, "create"))).toEqual(["Name:INVALID_FIELD_FOR_INSERT_UPDATE"]);
  });
  it("validates picklists, numbers, dates, emails and URLs", () => {
    expect(codes(validateRecord(Opportunity, { StageName: "Made Up" }, "update"))).toEqual(["StageName:INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST"]);
    expect(codes(validateRecord(Opportunity, { Amount: "abc" }, "update"))).toEqual(["Amount:INVALID_TYPE_ON_FIELD_IN_RECORD"]);
    expect(codes(validateRecord(Opportunity, { Probability: 120 }, "update"))).toEqual(["Probability:NUMBER_OUTSIDE_VALID_RANGE"]);
    expect(codes(validateRecord(Opportunity, { CloseDate: "12/01/2026" }, "update"))).toEqual(["CloseDate:INVALID_TYPE_ON_FIELD_IN_RECORD"]);
    expect(codes(validateRecord(Contact, { Email: "nope" }, "update"))).toEqual(["Email:INVALID_EMAIL_ADDRESS"]);
    expect(codes(validateRecord(getObject("Account")!, { Website: "javascript:alert(1)" }, "update"))).toEqual(["Website:INVALID_TYPE_ON_FIELD_IN_RECORD"]);
  });
  it("coerces numbers and booleans", () => {
    expect(validateRecord(Opportunity, { Amount: "1200.5" }, "update").values.Amount).toBe(1200.5);
    expect(validateRecord(getObject("OpportunityContactRole")!, { IsPrimary: true }, "update").values.IsPrimary).toBe(1);
  });
  it("checks reference IDs by key prefix, including polymorphic WhoId/WhatId", () => {
    expect(validateRecord(Contact, { AccountId: newId("001") }, "update").errors).toEqual([]);
    expect(codes(validateRecord(Contact, { AccountId: newId("006") }, "update"))).toEqual(["AccountId:FIELD_INTEGRITY_EXCEPTION"]);
    expect(codes(validateRecord(Contact, { AccountId: "bad" }, "update"))).toEqual(["AccountId:MALFORMED_ID"]);
    expect(validateRecord(Task, { WhoId: newId("00Q"), WhatId: newId("006") }, "update").errors).toEqual([]);
    expect(codes(validateRecord(Task, { WhoId: newId("001") }, "update"))).toEqual(["WhoId:FIELD_INTEGRITY_EXCEPTION"]);
  });
  it("normalizes 15-char reference IDs to 18", () => {
    const id18 = newId("001");
    expect(validateRecord(Contact, { AccountId: id18.slice(0, 15) }, "update").values.AccountId).toBe(id18);
  });
  it("rejects too-long strings and clears optional fields", () => {
    expect(codes(validateRecord(Contact, { Title: "x".repeat(300) }, "update"))).toEqual(["Title:STRING_TOO_LONG"]);
    expect(validateRecord(Contact, { Email: "" }, "update").values.Email).toBeNull();
  });
});

describe("object registry", () => {
  it("has unique key prefixes", () => {
    const prefixes = Object.values(OBJECTS).map((o) => o.keyPrefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });
  it("resolves the object type from an ID", () => {
    expect(objectForId(newId("500"))?.name).toBe("Case");
    expect(objectForId("zzz000000000000AAA")).toBeNull();
  });
  it("derives child relationships, with cascade delete for master-detail", () => {
    const rels = childRelationships("Opportunity");
    expect(rels).toContainEqual(expect.objectContaining({ childSObject: "OpportunityContactRole", field: "OpportunityId", cascadeDelete: true }));
    expect(childRelationships("Account").map((r) => r.childSObject)).toEqual(expect.arrayContaining(["Contact", "Opportunity", "Case", "Account"]));
    // Lead conversion fields are read-only, so they don't create related lists
    expect(childRelationships("Account").some((r) => r.childSObject === "Lead")).toBe(false);
  });
  it("does not resolve prototype keys", () => {
    expect(getObject("constructor")).toBeNull();
  });
});
