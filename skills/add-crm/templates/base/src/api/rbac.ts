// Salesforce-style security model, as pure functions:
// 1. Profile object permissions (CRUD + View All / Modify All) decide what a user can do with an object.
// 2. Org-wide defaults (Private / Read / ReadWrite / ControlledByParent) set baseline record visibility.
// 3. Ownership + role hierarchy: users see records owned by themselves and by users in roles below them.
// 4. Detail objects in a master-detail relationship inherit access from their master record.
import type { SObjectDef, Sharing } from "./objects";

export type Action = "read" | "create" | "edit" | "delete";

export interface ObjectPermission {
  SobjectType: string;
  PermissionsRead: number;
  PermissionsCreate: number;
  PermissionsEdit: number;
  PermissionsDelete: number;
  PermissionsViewAllRecords: number;
  PermissionsModifyAllRecords: number;
}

export interface SecurityContext {
  userId: string;
  modifyAllData: boolean;              // profile-level "Modify All Data" (System Administrator)
  perms: ObjectPermission[];
  sharing: Record<string, Sharing>;    // org-wide defaults by object
  visibleOwnerIds: string[];           // self + users in subordinate roles
}

const perm = (ctx: SecurityContext, obj: string) => ctx.perms.find((p) => p.SobjectType === obj);

/** Object-level permission (CRUD), like a profile's object settings. */
export function can(ctx: SecurityContext, obj: string, action: Action): boolean {
  if (ctx.modifyAllData) return true;
  const p = perm(ctx, obj);
  if (!p) return false;
  return Boolean({ read: p.PermissionsRead, create: p.PermissionsCreate, edit: p.PermissionsEdit, delete: p.PermissionsDelete }[action]);
}

const viewAll = (ctx: SecurityContext, obj: string) => ctx.modifyAllData || !!perm(ctx, obj)?.PermissionsViewAllRecords || !!perm(ctx, obj)?.PermissionsModifyAllRecords;
const modifyAll = (ctx: SecurityContext, obj: string) => ctx.modifyAllData || !!perm(ctx, obj)?.PermissionsModifyAllRecords;

/** Role IDs below `roleId` in the hierarchy (not including it). */
export function subordinateRoleIds(roles: { Id: string; ParentRoleId: string | null }[], roleId: string | null): string[] {
  if (!roleId) return [];
  const out: string[] = [];
  const queue = [roleId];
  const seen = new Set(queue);
  while (queue.length) {
    const parent = queue.shift()!;
    for (const r of roles) {
      if (r.ParentRoleId === parent && !seen.has(r.Id)) {
        seen.add(r.Id);
        out.push(r.Id);
        queue.push(r.Id);
      }
    }
  }
  return out;
}

/**
 * SQL fragment restricting rows of `def` to what the user may READ.
 * `masterOf` returns the master object + field for a ControlledByParent object.
 */
export function readFilter(
  ctx: SecurityContext,
  def: SObjectDef,
  masterOf: (def: SObjectDef) => { master: SObjectDef; field: string } | null,
  alias = "",
): { sql: string; params: string[] } {
  const col = (c: string) => (alias ? `${alias}.${c}` : c);
  const owd = ctx.sharing[def.name] ?? def.defaultSharing;
  if (owd === "ControlledByParent" || !def.ownerable) {
    const m = masterOf(def);
    if (!m) return { sql: "1=0", params: [] };
    const inner = readFilter(ctx, m.master, masterOf);
    return { sql: `${col(m.field)} IN (SELECT Id FROM "${m.master.name}" WHERE IsDeleted = 0 AND ${inner.sql})`, params: inner.params };
  }
  if (viewAll(ctx, def.name) || owd === "Read" || owd === "ReadWrite") return { sql: "1=1", params: [] };
  const ids = ctx.visibleOwnerIds.length ? ctx.visibleOwnerIds : [ctx.userId];
  return { sql: `${col("OwnerId")} IN (${ids.map(() => "?").join(", ")})`, params: ids };
}

/** Record-level access for an ownerable record the caller has loaded. */
export function canAccessRecord(ctx: SecurityContext, def: SObjectDef, action: Exclude<Action, "create">, ownerId: string): boolean {
  if (!can(ctx, def.name, action)) return false;
  const owns = ownerId === ctx.userId || ctx.visibleOwnerIds.includes(ownerId);
  const owd = ctx.sharing[def.name] ?? def.defaultSharing;
  if (action === "read") return owns || viewAll(ctx, def.name) || owd === "Read" || owd === "ReadWrite";
  if (action === "edit") return owns || modifyAll(ctx, def.name) || owd === "ReadWrite";
  return owns || modifyAll(ctx, def.name); // delete: owner, hierarchy, or Modify All
}
