import { useEffect, useState } from "react";
import { api, ApiError, recordName, type ObjectDef, type Field } from "../api";
import { useMeta } from "../App";
import { UtilityIcon, ErrorAlert } from "../Icon";

/** New / Edit record modal, like a Lightning record form. */
export function RecordForm({
  object, def, record, defaults, onClose, onSaved,
}: {
  object: string;
  def: ObjectDef;
  record?: Record<string, any>;
  defaults?: Record<string, any>;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [values, setValues] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = { ...defaults };
    for (const f of def.fields) init[f.name] = record?.[f.name] ?? init[f.name] ?? (f.type === "picklist" && f.required ? f.options?.[0] : "");
    return init;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setErrors({});
    try {
      if (record) {
        await api(`/o/${object}/${record.id}`, { method: "PATCH", body: values });
        onSaved(record.id);
      } else {
        const r = await api<{ id: string }>(`/o/${object}`, { method: "POST", body: values });
        onSaved(r.id);
      }
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      setError(err instanceof ApiError && err.fields ? "Review the errors on this page." : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const title = record ? `Edit ${recordName(def, record)}` : `New ${def.label}`;

  return (
    <>
      <section role="dialog" tabIndex={-1} aria-modal="true" aria-labelledby="form-title" className="slds-modal slds-fade-in-open slds-modal_medium">
        <form className="slds-modal__container" onSubmit={submit} noValidate>
          <button type="button" className="slds-button slds-button_icon slds-modal__close slds-button_icon-inverse" onClick={onClose} title="Close">
            <UtilityIcon name="close" className="slds-button__icon slds-button__icon_large" label="Cancel and close" />
          </button>
          <div className="slds-modal__header">
            <h1 id="form-title" className="slds-modal__title slds-hyphenate">{title}</h1>
          </div>
          <div className="slds-modal__content slds-p-around_medium">
            {error && <ErrorAlert message={error} />}
            <h3 className="slds-section__title slds-theme_shade slds-p-horizontal_small slds-m-bottom_small">
              <span className="slds-truncate">{def.label} Information</span>
            </h3>
            <div className="slds-form" role="list">
              <div className="slds-grid slds-wrap slds-gutters_small">
                {def.fields.map((f) => (
                  <div key={f.name} className={`slds-col slds-size_1-of-1 ${f.type === "textarea" ? "" : "slds-medium-size_1-of-2"}`} role="listitem">
                    <FieldInput field={f} value={values[f.name]} error={errors[f.name]}
                      onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="slds-modal__footer">
            <button type="button" className="slds-button slds-button_neutral" onClick={onClose}>Cancel</button>
            <button className="slds-button slds-button_brand" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </section>
      <div className="slds-backdrop slds-backdrop_open" role="presentation" />
    </>
  );
}

function FieldInput({ field, value, error, onChange }: { field: Field; value: any; error?: string; onChange: (v: any) => void }) {
  const id = `f-${field.name}`;
  const common = { id, value: value ?? "", required: field.required, "aria-invalid": !!error, "aria-describedby": error ? `${id}-err` : undefined };
  let input: React.ReactNode;
  if (field.type === "picklist") {
    input = (
      <div className="slds-select_container">
        <select className="slds-select" {...common} onChange={(e) => onChange(e.target.value)}>
          {!field.required && <option value="">--None--</option>}
          {field.options?.map((o) => <option key={o}>{o}</option>)}
        </select>
      </div>
    );
  } else if (field.type === "textarea") {
    input = <textarea className="slds-textarea" {...common} rows={4} onChange={(e) => onChange(e.target.value)} />;
  } else if (field.type === "lookup") {
    input = <LookupInput object={field.lookup!} id={id} value={value} onChange={onChange} />;
  } else {
    const type = { email: "email", phone: "tel", url: "url", number: "number", currency: "number", date: "date" }[field.type] ?? "text";
    input = <input className="slds-input" {...common} type={type} step={field.type === "currency" ? "0.01" : undefined} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <div className={`slds-form-element slds-form-element_stacked ${error ? "slds-has-error" : ""}`}>
      <label className="slds-form-element__label" htmlFor={id}>
        {field.required && <abbr className="slds-required" title="required">* </abbr>}
        {field.label}
      </label>
      <div className="slds-form-element__control">{input}</div>
      {error && <div className="slds-form-element__help" id={`${id}-err`}>{error}</div>}
    </div>
  );
}

function LookupInput({ object, id, value, onChange }: { object: string; id: string; value: string; onChange: (v: string) => void }) {
  const meta = useMeta();
  const def = meta.objects[object];
  const [options, setOptions] = useState<Record<string, any>[]>([]);
  useEffect(() => {
    if (!def) return;
    api<{ records: Record<string, any>[] }>(`/o/${object}?limit=100&sort=${def.nameFields[0]}&dir=asc`).then((r) => setOptions(r.records)).catch(() => {});
  }, [object]);
  if (!def) return <input id={id} className="slds-input" disabled value="" />;
  return (
    <div className="slds-select_container">
      <select id={id} className="slds-select" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">Search {def.plural}...</option>
        {options.map((o) => <option key={o.id} value={o.id}>{recordName(def, o)}</option>)}
      </select>
    </div>
  );
}
