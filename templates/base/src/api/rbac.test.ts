import { describe, expect, it } from "vitest";
import { can, canAccessRecord, visibility, type Permission } from "./rbac";

const rep: Permission[] = [{ object: "leads", can_read: 1, can_create: 1, can_edit: 1, can_delete: 0, view_all: 0 }];
const manager: Permission[] = [{ object: "leads", can_read: 1, can_create: 1, can_edit: 1, can_delete: 1, view_all: 1 }];

describe("can", () => {
  it("allows granted actions and denies others", () => {
    expect(can(rep, "leads", "read")).toBe(true);
    expect(can(rep, "leads", "delete")).toBe(false);
  });
  it("denies objects with no profile row", () => {
    expect(can(rep, "accounts", "read")).toBe(false);
  });
});

describe("visibility", () => {
  it("restricts to own records without view_all", () => {
    expect(visibility(rep, "leads", "u1")).toEqual({ sql: "owner_id = ?", params: ["u1"] });
  });
  it("is unrestricted with view_all", () => {
    expect(visibility(manager, "leads", "u1")).toEqual({ sql: "1=1", params: [] });
  });
  it("defaults to own records for unknown objects", () => {
    expect(visibility(rep, "cases", "u1").sql).toBe("owner_id = ?");
  });
});

describe("canAccessRecord", () => {
  it("lets a rep edit their own record", () => {
    expect(canAccessRecord(rep, "leads", "edit", "u1", "u1")).toBe(true);
  });
  it("blocks a rep from someone else's record (IDOR)", () => {
    expect(canAccessRecord(rep, "leads", "read", "u1", "u2")).toBe(false);
  });
  it("lets view_all access any record", () => {
    expect(canAccessRecord(manager, "leads", "delete", "u1", "u2")).toBe(true);
  });
  it("still requires the action permission", () => {
    expect(canAccessRecord(rep, "leads", "delete", "u1", "u1")).toBe(false);
  });
});
