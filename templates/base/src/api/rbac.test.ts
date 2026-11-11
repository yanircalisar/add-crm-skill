import { describe, expect, it } from "vitest";
import { can, canAccessRecord, readFilter, subordinateRoleIds, type ObjectPermission, type SecurityContext } from "./rbac";
import { getObject, type SObjectDef } from "./objects";

const P = (SobjectType: string, flags: number[]): ObjectPermission => {
  const [r, c, e, d, va, ma] = flags;
  return { SobjectType, PermissionsRead: r!, PermissionsCreate: c!, PermissionsEdit: e!, PermissionsDelete: d!, PermissionsViewAllRecords: va!, PermissionsModifyAllRecords: ma! };
};
const ctx = (over: Partial<SecurityContext> = {}): SecurityContext => ({
  userId: "rep", modifyAllData: false, sharing: {}, visibleOwnerIds: ["rep"],
  perms: [P("Account", [1, 1, 1, 0, 0, 0]), P("Opportunity", [1, 1, 1, 1, 0, 0])],
  ...over,
});
const Account = getObject("Account")!;
const Opportunity = getObject("Opportunity")!;
const OCR = getObject("OpportunityContactRole")!;
const masterOf = (d: SObjectDef) => (d.name === "OpportunityContactRole" ? { master: Opportunity, field: "OpportunityId" } : null);

describe("profile object permissions", () => {
  it("grants listed actions only", () => {
    expect(can(ctx(), "Account", "edit")).toBe(true);
    expect(can(ctx(), "Account", "delete")).toBe(false);
    expect(can(ctx(), "Case", "read")).toBe(false);
  });
  it("Modify All Data grants everything", () => {
    expect(can(ctx({ modifyAllData: true }), "Case", "delete")).toBe(true);
  });
});

describe("role hierarchy", () => {
  const roles = [
    { Id: "ceo", ParentRoleId: null },
    { Id: "mgr", ParentRoleId: "ceo" },
    { Id: "rep1", ParentRoleId: "mgr" },
    { Id: "rep2", ParentRoleId: "mgr" },
    { Id: "other", ParentRoleId: "ceo" },
  ];
  it("returns every role below, not the role itself or siblings", () => {
    expect(subordinateRoleIds(roles, "mgr").sort()).toEqual(["rep1", "rep2"]);
    expect(subordinateRoleIds(roles, "ceo")).toHaveLength(4);
    expect(subordinateRoleIds(roles, "rep1")).toEqual([]);
    expect(subordinateRoleIds(roles, null)).toEqual([]);
  });
  it("survives cycles", () => {
    expect(subordinateRoleIds([{ Id: "a", ParentRoleId: "b" }, { Id: "b", ParentRoleId: "a" }], "a")).toEqual(["b"]);
  });
});

describe("record visibility", () => {
  it("Private: only own and subordinates' records", () => {
    const f = readFilter(ctx({ visibleOwnerIds: ["mgr", "rep"] }), Account, masterOf);
    expect(f.sql).toBe("OwnerId IN (?, ?)");
    expect(f.params).toEqual(["mgr", "rep"]);
  });
  it("Public Read and View All see everything", () => {
    expect(readFilter(ctx({ sharing: { Account: "Read" } }), Account, masterOf).sql).toBe("1=1");
    expect(readFilter(ctx({ perms: [P("Account", [1, 0, 0, 0, 1, 0])] }), Account, masterOf).sql).toBe("1=1");
  });
  it("detail records inherit visibility from their master", () => {
    const f = readFilter(ctx(), OCR, masterOf);
    expect(f.sql).toContain(`OpportunityId IN (SELECT Id FROM "Opportunity"`);
    expect(f.params).toEqual(["rep"]);
  });
});

describe("record access", () => {
  it("owner can edit, others can't under Private", () => {
    expect(canAccessRecord(ctx(), Account, "edit", "rep")).toBe(true);
    expect(canAccessRecord(ctx(), Account, "read", "someone")).toBe(false);
  });
  it("managers act on their reps' records through the hierarchy", () => {
    const mgr = ctx({ userId: "mgr", visibleOwnerIds: ["mgr", "rep"] });
    expect(canAccessRecord(mgr, Opportunity, "delete", "rep")).toBe(true);
  });
  it("Public Read lets others read but not edit", () => {
    const c = ctx({ sharing: { Account: "Read" } });
    expect(canAccessRecord(c, Account, "read", "someone")).toBe(true);
    expect(canAccessRecord(c, Account, "edit", "someone")).toBe(false);
  });
  it("Public Read/Write allows edit but not delete", () => {
    const c = ctx({ sharing: { Opportunity: "ReadWrite" } });
    expect(canAccessRecord(c, Opportunity, "edit", "someone")).toBe(true);
    expect(canAccessRecord(c, Opportunity, "delete", "someone")).toBe(false);
  });
  it("still requires the object permission", () => {
    expect(canAccessRecord(ctx(), Account, "delete", "rep")).toBe(false);
  });
});
