import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { schemaSql, SEED } from "./schema";
import { isValidId } from "./ids";

describe("schema", () => {
  it("committed migration matches the object registry (run `npm run schema` if this fails)", () => {
    const file = readFileSync(new URL("../../migrations/0001_init.sql", import.meta.url), "utf8");
    expect(file).toBe(schemaSql());
  });
  it("seed IDs are valid Salesforce-style IDs with the right prefixes", () => {
    for (const id of Object.values(SEED.profiles)) expect(isValidId(id) && id.startsWith("00e")).toBe(true);
    for (const id of Object.values(SEED.roles)) expect(isValidId(id) && id.startsWith("00E")).toBe(true);
  });
  it("every object table has the system fields", () => {
    const sql = schemaSql();
    for (const col of ["CreatedDate", "CreatedById", "LastModifiedDate", "LastModifiedById", "SystemModstamp", "IsDeleted"]) {
      expect(sql.match(new RegExp(`"${col}"`, "g"))!.length).toBeGreaterThanOrEqual(8);
    }
  });
});
