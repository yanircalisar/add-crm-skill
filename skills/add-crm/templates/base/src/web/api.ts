// Fetch wrapper + describe cache. The API mirrors Salesforce REST shapes:
// records carry `attributes`, errors are arrays of { message, errorCode, fields }.
import { useEffect, useState } from "react";

export class ApiError extends Error {
  constructor(public status: number, message: string, public errorCode: string, public fieldErrors: Record<string, string> = {}) {
    super(message);
  }
}

export async function api<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = init.method ?? "GET";
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: method !== "GET" ? { "Content-Type": "application/json" } : undefined,
    body: method !== "GET" ? JSON.stringify(init.body ?? {}) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errs: { message: string; errorCode: string; fields?: string[] }[] = Array.isArray(data) ? data : [{ message: "Request failed", errorCode: "UNKNOWN" }];
    const fieldErrors: Record<string, string> = {};
    for (const e of errs) for (const f of e.fields ?? []) fieldErrors[f] = e.message;
    throw new ApiError(res.status, errs[0]?.message ?? "Request failed", errs[0]?.errorCode ?? "UNKNOWN", fieldErrors);
  }
  return data as T;
}

export interface SObjectSummary { name: string; label: string; labelPlural: string; keyPrefix: string; createable: boolean; updateable: boolean; deletable: boolean }
export interface Stage { name: string; isClosed: boolean; isWon: boolean; probability: number }
export interface Meta {
  crm: { name: string; brandColor: string };
  user: { Id: string; Name: string; Email: string; ProfileName: string; PermissionsManageUsers: number };
  stages: Stage[];
  sobjects: SObjectSummary[];
}
export interface Field {
  name: string; label: string; type: string; nillable: boolean; createable: boolean; updateable: boolean; calculated: boolean;
  picklistValues: { value: string; label: string }[]; referenceTo: string[]; relationshipName: string | null;
}
export interface Describe {
  name: string; label: string; labelPlural: string; keyPrefix: string; nameField: string;
  listFields: string[]; highlightFields: string[]; createable: boolean; updateable: boolean; deletable: boolean;
  fields: Field[];
  childRelationships: { childSObject: string; field: string; cascadeDelete: boolean }[];
}
export type SRecord = Record<string, any> & { Id: string; attributes: { type: string; url: string } };
export type Names = Record<string, { name: string; type: string }>;

const describeCache = new Map<string, Promise<Describe>>();
export function describe(type: string): Promise<Describe> {
  if (!describeCache.has(type)) {
    const p = api<Describe>(`/sobjects/${type}/describe`);
    p.catch(() => describeCache.delete(type));
    describeCache.set(type, p);
  }
  return describeCache.get(type)!;
}
export const clearDescribeCache = () => describeCache.clear();

/** React hook: describe result for an object (null while loading). */
export function useDescribe(type: string | undefined): { d: Describe | null; error: string } {
  const [d, setD] = useState<Describe | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setD(null);
    setError("");
    if (type) describe(type).then(setD).catch((e) => setError(e.message));
  }, [type]);
  return { d, error };
}

export const recordUrl = (type: string, id: string) => `/lightning/r/${type}/${id}/view`;
export const listUrl = (type: string) => `/lightning/o/${type}/list`;

export function fieldOf(d: Describe, name: string) {
  return d.fields.find((f) => f.name === name);
}

export function formatValue(f: Pick<Field, "type"> | undefined, v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  switch (f?.type) {
    case "currency": return Number(v).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    case "percent": return `${v}%`;
    case "date": return new Date(String(v) + "T00:00:00").toLocaleDateString();
    case "datetime": return new Date(String(v)).toLocaleString();
    case "boolean": return v ? "Yes" : "No";
    default: return String(v);
  }
}
