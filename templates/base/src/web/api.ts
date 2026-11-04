// Tiny fetch wrapper. Cookies carry the session; every mutation is JSON.
export class ApiError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string>) {
    super(message);
  }
}

export async function api<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init.method ?? "GET",
    credentials: "same-origin",
    headers: init.body !== undefined || (init.method && init.method !== "GET") ? { "Content-Type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : init.method && init.method !== "GET" ? "{}" : undefined,
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Request failed", data.fields);
  return data as T;
}

export interface Field {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  lookup?: string;
}
export interface ObjectDef {
  label: string;
  plural: string;
  nameFields: string[];
  listFields: string[];
  fields: Field[];
}
export interface Meta {
  crm: { name: string; brandColor: string };
  user: { id: string; name: string; email: string; role_id: string };
  objects: Record<string, ObjectDef>;
  related: Record<string, { object: string; field: string }[]>;
  stages: string[];
  closedStages: string[];
  permissions: { object: string; can_read: number; can_create: number; can_edit: number; can_delete: number }[];
}

export const recordName = (def: ObjectDef, r: Record<string, any>) =>
  def.nameFields.map((f) => r[f]).filter(Boolean).join(" ") || "(no name)";

export function formatValue(f: Field | undefined, v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (f?.type === "currency") return Number(v).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  if (f?.type === "date") return new Date(String(v) + "T00:00:00").toLocaleDateString();
  return String(v);
}
