import { describe, expect, it } from "vitest";
import { validateRecord } from "./validate";
import { OBJECTS, getObject } from "./objects";

const opp = OBJECTS.opportunities;
const leads = OBJECTS.leads;

describe("validateRecord", () => {
  it("requires required fields on create", () => {
    const { errors } = validateRecord(opp, {});
    expect(errors.name).toBeDefined();
    expect(errors.stage).toBeDefined();
  });
  it("does not require missing fields on partial update", () => {
    expect(validateRecord(opp, { amount: 5 }, true).errors).toEqual({});
  });
  it("drops unknown fields so they never reach SQL", () => {
    const { values } = validateRecord(leads, { last_name: "Doe", owner_id: "x", "id; DROP TABLE": 1 });
    expect(values).toEqual({ last_name: "Doe" });
  });
  it("coerces numbers and rejects non-numbers", () => {
    expect(validateRecord(opp, { amount: "1200.5" }, true).values.amount).toBe(1200.5);
    expect(validateRecord(opp, { amount: "abc" }, true).errors.amount).toBeDefined();
  });
  it("validates email, date, url and picklist", () => {
    expect(validateRecord(leads, { email: "nope" }, true).errors.email).toBeDefined();
    expect(validateRecord(opp, { close_date: "12/01/2025" }, true).errors.close_date).toBeDefined();
    expect(validateRecord(OBJECTS.accounts, { website: "javascript:alert(1)" }, true).errors.website).toBeDefined();
    expect(validateRecord(opp, { stage: "Made Up" }, true).errors.stage).toBeDefined();
  });
  it("clears optional fields set to empty", () => {
    expect(validateRecord(leads, { email: "" }, true).values.email).toBeNull();
  });
  it("rejects clearing required fields", () => {
    expect(validateRecord(leads, { last_name: "  " }, true).errors.last_name).toBeDefined();
  });
  it("rejects over-long text", () => {
    expect(validateRecord(leads, { company: "x".repeat(300) }, true).errors.company).toBeDefined();
  });
});

describe("getObject", () => {
  it("returns known objects only, not prototype keys", () => {
    expect(getObject("leads")?.table).toBe("leads");
    expect(getObject("constructor")).toBeNull();
    expect(getObject("users")).toBeNull();
  });
});
