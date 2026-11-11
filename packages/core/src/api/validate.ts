import type { SObjectDef } from "./objects.js";
import { getObject } from "./objects.js";
import { normalizeId } from "./ids.js";

export type Values = Record<string, string | number | null>;
export interface FieldError { message: string; errorCode: string; fields: string[] }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?$/;
const MAX_STRING = 255;
const MAX_TEXTAREA = 32_000;

/**
 * Keep only known, writable fields; coerce types; validate. Errors use Salesforce error codes
 * (REQUIRED_FIELD_MISSING, INVALID_FIELD, FIELD_INTEGRITY_EXCEPTION, INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST,
 * STRING_TOO_LONG, MALFORMED_ID, INVALID_TYPE_ON_FIELD_IN_RECORD).
 */
export function validateRecord(def: SObjectDef, input: unknown, mode: "create" | "update"): { values: Values; errors: FieldError[] } {
  const values: Values = {};
  const errors: FieldError[] = [];
  const src = (input && typeof input === "object" && !Array.isArray(input) ? input : {}) as Record<string, unknown>;
  const err = (field: string, errorCode: string, message: string) => errors.push({ message, errorCode, fields: [field] });

  for (const key of Object.keys(src)) {
    if (key === "attributes") continue;
    const f = def.fields.find((x) => x.name === key);
    const writable = f && (mode === "create" ? f.createable !== false : f.updateable !== false) && !f.calculated;
    if (!writable) err(key, "INVALID_FIELD_FOR_INSERT_UPDATE", `Unable to create/update field: ${key}`);
  }

  for (const f of def.fields) {
    if (f.calculated || (mode === "create" ? f.createable === false : f.updateable === false)) continue;
    const present = Object.prototype.hasOwnProperty.call(src, f.name);
    if (!present) {
      if (mode === "create" && f.required) err(f.name, "REQUIRED_FIELD_MISSING", `Required fields are missing: [${f.name}]`);
      continue;
    }
    const raw = src[f.name];
    const empty = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");
    if (empty) {
      if (f.required) err(f.name, "REQUIRED_FIELD_MISSING", `Required fields are missing: [${f.name}]`);
      else values[f.name] = f.type === "boolean" ? 0 : null;
      continue;
    }
    switch (f.type) {
      case "boolean":
        if (typeof raw !== "boolean") err(f.name, "INVALID_TYPE_ON_FIELD_IN_RECORD", `${f.label}: value not of required type: ${String(raw)}`);
        else values[f.name] = raw ? 1 : 0;
        break;
      case "int": case "double": case "currency": case "percent": {
        const n = typeof raw === "number" ? raw : Number(String(raw).trim());
        if (!Number.isFinite(n) || (f.type === "int" && !Number.isInteger(n))) err(f.name, "INVALID_TYPE_ON_FIELD_IN_RECORD", `${f.label}: value not of required type: ${String(raw)}`);
        else if (f.type === "percent" && (n < 0 || n > 100)) err(f.name, "NUMBER_OUTSIDE_VALID_RANGE", `${f.label}: must be between 0 and 100`);
        else values[f.name] = n;
        break;
      }
      case "reference": {
        const id = normalizeId(raw);
        const target = id ? Object.values(f.referenceTo ?? []).map(getObject).find((o) => o && id.startsWith(o.keyPrefix)) : null;
        if (!id) err(f.name, "MALFORMED_ID", `${f.label}: id value of incorrect type: ${String(raw)}`);
        else if (!target) err(f.name, "FIELD_INTEGRITY_EXCEPTION", `${f.label}: id value of incorrect type: ${id}`);
        else values[f.name] = id;
        break;
      }
      default: {
        if (typeof raw !== "string") { err(f.name, "INVALID_TYPE_ON_FIELD_IN_RECORD", `${f.label}: value not of required type`); break; }
        const s = raw.trim();
        const max = f.type === "textarea" ? (f.length ?? MAX_TEXTAREA) : (f.length ?? MAX_STRING);
        if (s.length > max) err(f.name, "STRING_TOO_LONG", `${f.label}: data value too large (max length=${max})`);
        else if (f.type === "email" && !EMAIL.test(s)) err(f.name, "INVALID_EMAIL_ADDRESS", `${f.label}: invalid email address: ${s}`);
        else if (f.type === "date" && !DATE.test(s)) err(f.name, "INVALID_TYPE_ON_FIELD_IN_RECORD", `${f.label}: value not of required type (YYYY-MM-DD): ${s}`);
        else if (f.type === "datetime" && !DATETIME.test(s)) err(f.name, "INVALID_TYPE_ON_FIELD_IN_RECORD", `${f.label}: value not of required type (ISO 8601): ${s}`);
        else if (f.type === "url" && !/^https?:\/\//i.test(s)) err(f.name, "INVALID_TYPE_ON_FIELD_IN_RECORD", `${f.label}: must start with http:// or https://`);
        else if (f.type === "picklist" && f.picklistValues && !f.picklistValues.includes(s)) err(f.name, "INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST", `${f.label}: bad value for restricted picklist field: ${s}`);
        else values[f.name] = s;
      }
    }
  }
  return { values, errors };
}
