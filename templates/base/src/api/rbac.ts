// Profile permissions + record ownership. Pure functions so they're easy to test.
export type Action = "read" | "create" | "edit" | "delete";

export interface Permission {
  object: string;
  can_read: number;
  can_create: number;
  can_edit: number;
  can_delete: number;
  view_all: number;
}

export function can(perms: Permission[], object: string, action: Action): boolean {
  const p = perms.find((x) => x.object === object);
  if (!p) return false;
  return Boolean({ read: p.can_read, create: p.can_create, edit: p.can_edit, delete: p.can_delete }[action]);
}

/** SQL fragment + params restricting rows to what the user may see. */
export function visibility(perms: Permission[], object: string, userId: string): { sql: string; params: string[] } {
  const p = perms.find((x) => x.object === object);
  if (p?.view_all) return { sql: "1=1", params: [] };
  return { sql: "owner_id = ?", params: [userId] };
}

/** Whether the user may act on a specific record they've loaded. */
export function canAccessRecord(perms: Permission[], object: string, action: Action, userId: string, ownerId: string): boolean {
  if (!can(perms, object, action)) return false;
  const p = perms.find((x) => x.object === object)!;
  return Boolean(p.view_all) || ownerId === userId;
}
