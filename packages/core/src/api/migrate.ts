// Writes the database migrations a project needs, as new numbered files only. Applied migrations are never
// rewritten, and nothing is ever dropped. `migrations/crm-schema.json` records what the existing migrations
// already create, so a package update or a model change produces just the difference:
//   - new objects     -> CREATE TABLE + indexes + permissions and sharing defaults for the seeded profiles
//   - new fields      -> ALTER TABLE ADD COLUMN (nullable when SQLite can't add it as NOT NULL; the API still enforces "required")
//   - new indexes     -> CREATE INDEX
//   - core data steps -> one-off SQL the package ships (CORE_STEPS), each applied once
// Removed objects or fields only produce a warning: their data stays in the database.
import { OBJECTS, allFields, type FieldDef, type SObjectDef } from "./objects.js";
import { columnSql, objectIndexes, schemaSql, seedId, SEED } from "./schema.js";

export interface SchemaSnapshot {
  format: 1;
  /** Columns per object table. */
  tables: Record<string, string[]>;
  /** Index names created so far. */
  indexes: string[];
  /** Next free number for seeded ObjectPermissions IDs (110 prefix). */
  nextPermission: number;
  /** CORE_STEPS ids already written. */
  coreSteps: string[];
}

/** One-off data or structure changes shipped by a package release, applied once per project in this order. */
export const CORE_STEPS: { id: string; sql: string }[] = [];

export interface MigrationPlan {
  /** SQL for the next migration file, or null when the database is up to date. */
  sql: string | null;
  snapshot: SchemaSnapshot;
  warnings: string[];
}

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const permissionFlags = (def: SObjectDef) => [1, 1, 1, def.name === "Task" || def.name === "Event" ? 1 : 0, 0, 0];

function snapshotOfCurrentModel(nextPermission: number, coreSteps: string[]): SchemaSnapshot {
  const tables: Record<string, string[]> = {};
  const indexes: string[] = [];
  for (const def of Object.values(OBJECTS)) {
    tables[def.name] = allFields(def).map((f) => f.name);
    indexes.push(...objectIndexes(def).map((i) => i.name));
  }
  return { format: 1, tables, indexes, nextPermission, coreSteps };
}

/** First migration for a new project: the full schema plus seed data. */
export function initialPlan(): MigrationPlan {
  const permissionRows = Object.keys(OBJECTS).length * 3;
  return { sql: schemaSql(), snapshot: snapshotOfCurrentModel(permissionRows + 1, CORE_STEPS.map((s) => s.id)), warnings: [] };
}

/** Snapshot for a CRM whose database already matches the current model (used once when adopting the package). */
export function baselineSnapshot(): SchemaSnapshot {
  return initialPlan().snapshot;
}

/** SQLite's ALTER TABLE ADD COLUMN can't add UNIQUE or NOT NULL-without-default columns. */
function addColumnSql(def: SObjectDef, f: FieldDef, warnings: string[]): string[] {
  let col = columnSql(f);
  const out: string[] = [];
  if (/ UNIQUE$/.test(col)) {
    col = col.replace(/ UNIQUE$/, "");
    out.push(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_${def.name}_${f.name}" ON "${def.name}" ("${f.name}");`);
  }
  if (/ NOT NULL$/.test(col)) {
    col = col.replace(/ NOT NULL$/, "");
    warnings.push(`${def.name}.${f.name} is required; existing rows will have it empty (new and edited records are still checked).`);
  }
  return [`ALTER TABLE "${def.name}" ADD COLUMN ${col};`, ...out];
}

/** Compare the current model with what the existing migrations created. */
export function planMigration(prev: SchemaSnapshot): MigrationPlan {
  const warnings: string[] = [];
  const parts: string[] = [];
  let nextPermission = prev.nextPermission;
  const known = new Set(prev.indexes);
  const newIndexes: string[] = [];

  for (const def of Object.values(OBJECTS)) {
    const cols = prev.tables[def.name];
    if (!cols) {
      const flags = permissionFlags(def);
      const rows = ([[SEED.profiles.admin, [1, 1, 1, 1, 1, 1]], [SEED.profiles.standard, flags], [SEED.profiles.readOnly, [1, 0, 0, 0, 0, 0]]] as const)
        .map(([profile, f]) => `  (${q(seedId("110", nextPermission++))}, ${q(profile)}, ${q(def.name)}, ${f.join(", ")})`);
      parts.push(
        `-- New object: ${def.name}`,
        objectTableSqlNoIndexes(def),
        `INSERT OR IGNORE INTO "ObjectPermissions" ("Id", "ParentId", "SobjectType", "PermissionsRead", "PermissionsCreate", "PermissionsEdit", "PermissionsDelete", "PermissionsViewAllRecords", "PermissionsModifyAllRecords") VALUES\n${rows.join(",\n")};`,
        `INSERT OR IGNORE INTO "OrgWideDefault" ("SobjectType", "Access") VALUES (${q(def.name)}, ${q(def.defaultSharing)});`,
      );
    } else {
      const have = new Set(cols);
      const added = allFields(def).filter((f) => !have.has(f.name));
      if (added.length) parts.push(`-- New fields on ${def.name}`, ...added.flatMap((f) => addColumnSql(def, f, warnings)));
      const now = new Set(allFields(def).map((f) => f.name));
      for (const c of cols) if (!now.has(c)) warnings.push(`${def.name}.${c} is no longer in the model; its column and data are kept.`);
    }
    for (const idx of objectIndexes(def)) if (!known.has(idx.name)) newIndexes.push(idx.sql);
  }
  for (const name of Object.keys(prev.tables)) {
    if (!OBJECTS[name]) warnings.push(`${name} is no longer in the model; its table and data are kept.`);
  }
  if (newIndexes.length) parts.push("-- Indexes", ...newIndexes);

  const done = new Set(prev.coreSteps);
  for (const step of CORE_STEPS) if (!done.has(step.id)) parts.push(`-- Core update: ${step.id}`, step.sql);

  const snapshot = snapshotOfCurrentModel(nextPermission, [...prev.coreSteps, ...CORE_STEPS.filter((s) => !done.has(s.id)).map((s) => s.id)]);
  // Columns that left the model stay in the snapshot: they still exist in the database.
  for (const [name, cols] of Object.entries(prev.tables)) {
    snapshot.tables[name] = snapshot.tables[name] ? [...new Set([...cols, ...snapshot.tables[name]!])] : cols;
  }
  snapshot.indexes = [...new Set([...prev.indexes, ...snapshot.indexes])];
  if (!parts.length) return { sql: null, snapshot: prev, warnings };
  return { sql: ["-- GENERATED by `add-crm migrate`. Do not edit by hand.", ...parts, ""].join("\n"), snapshot, warnings };
}

function objectTableSqlNoIndexes(def: SObjectDef): string {
  const cols = allFields(def).map((f) => "  " + columnSql(f));
  return `CREATE TABLE "${def.name}" (\n${cols.join(",\n")}\n);`;
}
