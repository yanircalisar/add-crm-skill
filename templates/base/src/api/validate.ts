import type { ObjectDef } from "./objects";

export type Values = Record<string, string | number | null>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT = 255;
const MAX_LONG = 32_000;

/** Keep only known fields, coerce types, and validate. `partial` is for updates. */
export function validateRecord(
  def: ObjectDef,
  input: unknown,
  partial = false,
): { values: Values; errors: Record<string, string> } {
  const values: Values = {};
  const errors: Record<string, string> = {};
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  for (const f of def.fields) {
    if (!Object.prototype.hasOwnProperty.call(src, f.name)) {
      if (!partial && f.required) errors[f.name] = `${f.label} is required`;
      continue;
    }
    const raw = src[f.name];
    if (raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "")) {
      if (f.required) errors[f.name] = `${f.label} is required`;
      else values[f.name] = null;
      continue;
    }
    if (f.type === "number" || f.type === "currency") {
      const n = typeof raw === "number" ? raw : Number(String(raw).trim());
      if (!Number.isFinite(n)) errors[f.name] = `${f.label} must be a number`;
      else values[f.name] = n;
      continue;
    }
    if (typeof raw !== "string") {
      errors[f.name] = `${f.label} is invalid`;
      continue;
    }
    const s = raw.trim();
    if (s.length > (f.type === "textarea" ? MAX_LONG : MAX_TEXT)) errors[f.name] = `${f.label} is too long`;
    else if (f.type === "email" && !EMAIL.test(s)) errors[f.name] = `${f.label} must be a valid email`;
    else if (f.type === "date" && !DATE.test(s)) errors[f.name] = `${f.label} must be YYYY-MM-DD`;
    else if (f.type === "url" && !/^https?:\/\//i.test(s)) errors[f.name] = `${f.label} must start with http(s)://`;
    else if (f.type === "picklist" && f.options && !f.options.includes(s)) errors[f.name] = `${f.label} has an invalid value`;
    else values[f.name] = s;
  }
  return { values, errors };
}
