import { Link } from "react-router-dom";
import { formatValue, recordUrl, type Field, type Names } from "./api";

/** Render a field value; reference fields become links named via the `names` map (works for polymorphic IDs). */
export function FieldValue({ field, value, names }: { field: Field | undefined; value: unknown; names: Names }) {
  if (field?.type === "reference" && typeof value === "string") {
    const n = names[value];
    if (!n) return <span className="slds-text-color_weak">{value.slice(0, 15)}</span>;
    if (n.type === "User") return <span>{n.name}</span>;
    return <Link to={recordUrl(n.type, value)}>{n.name || "(no name)"}</Link>;
  }
  if (field?.type === "boolean") {
    return (
      <span className="slds-checkbox crm-readonly-checkbox">
        <input type="checkbox" checked={!!value} disabled aria-label={field.label} readOnly />
        <span className="slds-checkbox_faux" />
      </span>
    );
  }
  return <>{formatValue(field, value)}</>;
}
