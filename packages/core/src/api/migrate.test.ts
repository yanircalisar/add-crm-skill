// Runs the generated migrations against a real SQLite database (node:sqlite), the engine D1 uses.
import { afterEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { applyModel, type SObjectDef } from "./objects.js";
import { initialPlan, planMigration } from "./migrate.js";
import { project, sampleModel } from "./test-fixtures.js";

// Loaded through require: Vite 5 doesn't know the node:sqlite builtin yet.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
type DatabaseSync = InstanceType<typeof DatabaseSync>;

const columns = (db: DatabaseSync, table: string) =>
  (db.prepare(`SELECT name FROM pragma_table_xinfo('${table}')`).all() as { name: string }[]).map((r) => r.name);

afterEach(() => applyModel({}));

describe("migrations", () => {
  it("the initial migration runs and seeds profiles, permissions and sharing", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(initialPlan().sql!);
    expect(db.prepare(`SELECT count(*) AS n FROM "Profile"`).get()).toEqual({ n: 3 });
    expect(db.prepare(`SELECT count(*) AS n FROM "OrgWideDefault"`).get()).toEqual({ n: 8 });
    expect(columns(db, "Account")).toContain("SystemModstamp");
  });

  it("an unchanged model needs no migration", () => {
    const { snapshot } = initialPlan();
    expect(planMigration(snapshot).sql).toBeNull();
  });

  it("adds new objects, fields and indexes without touching existing data", () => {
    const db = new DatabaseSync(":memory:");
    const first = initialPlan();
    db.exec(first.sql!);
    db.exec(`INSERT INTO "Account" ("Id", "Name", "OwnerId", "CreatedById", "LastModifiedById") VALUES ('001000000000001AAA', 'Acme', 'u', 'u', 'u')`);

    applyModel(sampleModel);
    const second = planMigration(first.snapshot);
    expect(second.sql).toContain(`CREATE TABLE "Project__c"`);
    expect(second.sql).toContain(`ALTER TABLE "Account" ADD COLUMN "Tier__c" TEXT;`);
    db.exec(second.sql!);
    expect(columns(db, "Account")).toContain("Tier__c");
    expect(columns(db, "Milestone__c")).toEqual(expect.arrayContaining(["Project__c", "Due__c", "IsDeleted"]));
    expect(db.prepare(`SELECT "Name" FROM "Account"`).get()).toEqual({ Name: "Acme" });
    expect(db.prepare(`SELECT count(*) AS n FROM "ObjectPermissions" WHERE "SobjectType" = 'Project__c'`).get()).toEqual({ n: 3 });
    expect(db.prepare(`SELECT "Access" FROM "OrgWideDefault" WHERE "SobjectType" = 'Milestone__c'`).get()).toEqual({ Access: "ControlledByParent" });
    // Permission IDs stay unique across migrations.
    const ids = db.prepare(`SELECT "Id" FROM "ObjectPermissions"`).all() as { Id: string }[];
    expect(new Set(ids.map((r) => r.Id)).size).toBe(ids.length);

    expect(planMigration(second.snapshot).sql).toBeNull();
  });

  it("adds required and autonumber fields in a way SQLite accepts", () => {
    applyModel({ objects: { Project__c: project } });
    const first = initialPlan();
    const db = new DatabaseSync(":memory:");
    db.exec(first.sql!);
    const withMore: SObjectDef = { ...project, fields: [...project.fields,
      { name: "Code__c", label: "Code", type: "string", required: true },
      { name: "Number__c", label: "Number", type: "autonumber", createable: false, updateable: false }] };
    applyModel({ objects: { Project__c: withMore } });
    const next = planMigration(first.snapshot);
    expect(next.warnings.join()).toMatch(/Code__c is required/);
    db.exec(next.sql!);
    expect(columns(db, "Project__c")).toEqual(expect.arrayContaining(["Code__c", "Number__c"]));
  });

  it("keeps data when an object or field leaves the model, and only warns", () => {
    applyModel(sampleModel);
    const first = initialPlan();
    applyModel({ objects: { Project__c: project } });
    const next = planMigration(first.snapshot);
    expect(next.sql).toBeNull();
    expect(next.warnings.join("\n")).toMatch(/Milestone__c is no longer in the model/);
    expect(next.warnings.join("\n")).toMatch(/Account.Tier__c is no longer in the model/);
    // Adding it back later must not try to create the column twice.
    applyModel(sampleModel);
    expect(planMigration(next.snapshot).sql).toBeNull();
  });
});
