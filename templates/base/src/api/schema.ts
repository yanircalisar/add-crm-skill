// Generates the SQL schema from the object registry, so tables/columns always equal API names.
// `npm run schema` writes migrations/0001_init.sql; a test checks the committed file is up to date.
import { OBJECTS, allFields, type FieldDef, type SObjectDef } from "./objects";
import { to18 } from "./ids";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
/** Fixed, valid IDs for seed rows: prefix + zero-padded number. */
export const seedId = (prefix: string, n: number) => to18(prefix + String(n).padStart(12, "0"));

export const SEED = {
  profiles: {
    admin: seedId("00e", 1),    // System Administrator
    standard: seedId("00e", 2), // Standard User
    readOnly: seedId("00e", 3), // Read Only
  },
  roles: {
    ceo: seedId("00E", 1),
    salesManager: seedId("00E", 2),
    salesRep: seedId("00E", 3),
  },
};

function columnSql(def: SObjectDef, f: FieldDef): string {
  if (f.name === "Id") return `"Id" TEXT PRIMARY KEY`;
  if (f.calculated && f.name === "Name") {
    return `"Name" TEXT GENERATED ALWAYS AS (trim(coalesce("FirstName", '') || ' ' || coalesce("LastName", ''))) VIRTUAL`;
  }
  const notNull = f.required || ["OwnerId", "CreatedById", "LastModifiedById"].includes(f.name);
  switch (f.type) {
    case "boolean": return `"${f.name}" INTEGER NOT NULL DEFAULT 0`;
    case "int": return `"${f.name}" INTEGER${notNull ? " NOT NULL" : ""}`;
    case "double": case "currency": case "percent": return `"${f.name}" REAL${notNull ? " NOT NULL" : ""}`;
    case "datetime":
      if (["CreatedDate", "LastModifiedDate", "SystemModstamp"].includes(f.name)) return `"${f.name}" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;
      return `"${f.name}" TEXT${notNull ? " NOT NULL" : ""}`;
    case "autonumber": return `"${f.name}" TEXT UNIQUE`;
    default: return `"${f.name}" TEXT${notNull ? " NOT NULL" : ""}`;
  }
}

export function objectTableSql(def: SObjectDef): string {
  const cols = allFields(def).map((f) => "  " + columnSql(def, f));
  const lines = [`CREATE TABLE "${def.name}" (\n${cols.join(",\n")}\n);`];
  const idx = (cols: string[]) => lines.push(`CREATE INDEX "idx_${def.name}_${cols.join("_")}" ON "${def.name}" (${cols.map((c) => `"${c}"`).join(", ")});`);
  if (def.ownerable) idx(["OwnerId", "IsDeleted"]);
  for (const f of def.fields) if (f.type === "reference" && f.createable !== false) idx([f.name]);
  idx(["IsDeleted", "LastModifiedDate"]);
  return lines.join("\n");
}

const SECURITY_SQL = `-- Users, profiles, roles and permissions (Salesforce: User 005, Profile 00e, UserRole 00E, ObjectPermissions 110)
CREATE TABLE "Profile" (
  "Id" TEXT PRIMARY KEY,
  "Name" TEXT NOT NULL UNIQUE,
  "PermissionsModifyAllData" INTEGER NOT NULL DEFAULT 0,
  "PermissionsViewAllData" INTEGER NOT NULL DEFAULT 0,
  "PermissionsManageUsers" INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE "UserRole" (
  "Id" TEXT PRIMARY KEY,
  "Name" TEXT NOT NULL,
  "ParentRoleId" TEXT REFERENCES "UserRole"("Id")
);
CREATE TABLE "User" (
  "Id" TEXT PRIMARY KEY,
  "Username" TEXT NOT NULL UNIQUE,
  "Email" TEXT NOT NULL,
  "FirstName" TEXT,
  "LastName" TEXT NOT NULL,
  "Name" TEXT GENERATED ALWAYS AS (trim(coalesce("FirstName", '') || ' ' || "LastName")) VIRTUAL,
  "Alias" TEXT,
  "Title" TEXT,
  "ProfileId" TEXT NOT NULL REFERENCES "Profile"("Id"),
  "UserRoleId" TEXT REFERENCES "UserRole"("Id"),
  "ManagerId" TEXT REFERENCES "User"("Id"),
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "PasswordHash" TEXT,
  "LastLoginDate" TEXT,
  "CreatedDate" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "LastModifiedDate" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX "idx_User_UserRoleId" ON "User" ("UserRoleId");
CREATE TABLE "ObjectPermissions" (
  "Id" TEXT PRIMARY KEY,
  "ParentId" TEXT NOT NULL REFERENCES "Profile"("Id"),
  "SobjectType" TEXT NOT NULL,
  "PermissionsRead" INTEGER NOT NULL DEFAULT 0,
  "PermissionsCreate" INTEGER NOT NULL DEFAULT 0,
  "PermissionsEdit" INTEGER NOT NULL DEFAULT 0,
  "PermissionsDelete" INTEGER NOT NULL DEFAULT 0,
  "PermissionsViewAllRecords" INTEGER NOT NULL DEFAULT 0,
  "PermissionsModifyAllRecords" INTEGER NOT NULL DEFAULT 0,
  UNIQUE ("ParentId", "SobjectType")
);
-- Org-wide defaults (Setup > Sharing Settings)
CREATE TABLE "OrgWideDefault" (
  "SobjectType" TEXT PRIMARY KEY,
  "Access" TEXT NOT NULL CHECK ("Access" IN ('Private', 'Read', 'ReadWrite', 'ControlledByParent'))
);

-- Internal auth tables (not Salesforce objects)
CREATE TABLE "_session" ("id" TEXT PRIMARY KEY, "user_id" TEXT NOT NULL REFERENCES "User"("Id"), "expires_at" TEXT NOT NULL);
CREATE INDEX "idx__session_user" ON "_session" ("user_id");
CREATE TABLE "_invite" ("token_hash" TEXT PRIMARY KEY, "user_id" TEXT NOT NULL REFERENCES "User"("Id"), "expires_at" TEXT NOT NULL);
CREATE TABLE "_login_attempt" ("key" TEXT PRIMARY KEY, "count" INTEGER NOT NULL, "window_start" TEXT NOT NULL);`;

function seedSql(): string {
  const { profiles: p, roles: r } = SEED;
  const out = [
    "-- Seed: standard profiles, a starter role hierarchy, object permissions and sharing defaults",
    `INSERT INTO "Profile" ("Id", "Name", "PermissionsModifyAllData", "PermissionsViewAllData", "PermissionsManageUsers") VALUES`,
    `  (${q(p.admin)}, 'System Administrator', 1, 1, 1),`,
    `  (${q(p.standard)}, 'Standard User', 0, 0, 0),`,
    `  (${q(p.readOnly)}, 'Read Only', 0, 0, 0);`,
    `INSERT INTO "UserRole" ("Id", "Name", "ParentRoleId") VALUES`,
    `  (${q(r.ceo)}, 'CEO', NULL),`,
    `  (${q(r.salesManager)}, 'Sales Manager', ${q(r.ceo)}),`,
    `  (${q(r.salesRep)}, 'Sales Rep', ${q(r.salesManager)});`,
  ];
  const rows: string[] = [];
  let n = 1;
  for (const def of Object.values(OBJECTS)) {
    const std = [1, 1, 1, def.name === "Task" || def.name === "Event" ? 1 : 0, 0, 0];
    for (const [profile, flags] of [[p.admin, [1, 1, 1, 1, 1, 1]], [p.standard, std], [p.readOnly, [1, 0, 0, 0, 0, 0]]] as const) {
      rows.push(`  (${q(seedId("110", n++))}, ${q(profile)}, ${q(def.name)}, ${flags.join(", ")})`);
    }
  }
  out.push(`INSERT INTO "ObjectPermissions" ("Id", "ParentId", "SobjectType", "PermissionsRead", "PermissionsCreate", "PermissionsEdit", "PermissionsDelete", "PermissionsViewAllRecords", "PermissionsModifyAllRecords") VALUES\n${rows.join(",\n")};`);
  out.push(`INSERT INTO "OrgWideDefault" ("SobjectType", "Access") VALUES\n${Object.values(OBJECTS).map((d) => `  (${q(d.name)}, ${q(d.defaultSharing)})`).join(",\n")};`);
  return out.join("\n");
}

export function schemaSql(): string {
  return [
    "-- GENERATED by `npm run schema` from src/api/objects.ts. Do not edit by hand.",
    SECURITY_SQL,
    "",
    "-- Standard objects",
    ...Object.values(OBJECTS).map(objectTableSql),
    "",
    seedSql(),
    "",
  ].join("\n");
}
