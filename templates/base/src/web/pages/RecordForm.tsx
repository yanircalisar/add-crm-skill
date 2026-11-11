import { useEffect, useState } from "react";
import { api, ApiError, describe as loadDescribe, type Describe, type Field, type SRecord } from "../api";
import { useMeta } from "../App";
import { UtilityIcon, ErrorAlert } from "../Icon";

/** New / Edit record modal. Fields and rules come from describe (createable / updateable / nillable / picklists). */
export function RecordForm({
  describe: d, record, defaults, onClose, onSaved,
}: {
  describe: Describe;
  record?: SRecord;
  defaults?: Record<string, unknown>;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const editable = d.fields.filter((f) => (record ? f.updateable : f.createable) && !f.calculated && f.name !== "OwnerId");
  const [values, setValues] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    for (const f of editable) {
      const v = record?.[f.name] ?? defaults?.[f.name];
      init[f.name] = v ?? (f.type === "boolean" ? false : f.type === "picklist" && !f.nillable ? f.picklistValues[0]?.value ?? "" : "");
    }
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
    // Send only fields that changed (PATCH) or have a value (POST).
    const payload: Record<string, unknown> = {};
    for (const f of editable) {
      const v = values[f.name];
      if (record ? v !== (record[f.name] ?? (f.type === "boolean" ? false : "")) : v !== "" && v !== false) payload[f.name] = v === "" ? null : v;
    }
    try {
      if (record) {
        await api(`/sobjects/${d.name}/${record.Id}`, { method: "PATCH", body: payload });
        onSaved(record.Id);
      } else {
        const r = await api<{ id: string }>(`/sobjects/${d.name}`, { method: "POST", body: payload });
        onSaved(r.id);
      }
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      setError(err instanceof ApiError && Object.keys(err.fieldErrors).length ? "Review the errors on this page." : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const title = record ? `Edit ${record[d.nameField] ?? d.label}` : `New ${d.label}`;

  return (
    <>
      <section role="dialog" tabIndex={-1} aria-modal="true" aria-labelledby="form-title" className="slds-modal slds-fade-in-open slds-modal_medium">
        <form className="slds-modal__container" onSubmit={submit} noValidate>
          <button type="button" className="slds-button slds-button_icon slds-modal__close slds-button_icon-inverse" onClick={onClose} title="Close">
            <UtilityIcon name="close" className="slds-button__icon slds-button__icon_large" label="Cancel and close" />
          </button>
          <div className="slds-modal__header"><h1 id="form-title" className="slds-modal__title slds-hyphenate">{title}</h1></div>
          <div className="slds-modal__content slds-p-around_medium">
            {error && <ErrorAlert message={error} />}
            <h3 className="slds-section__title slds-theme_shade slds-p-horizontal_small slds-m-bottom_small"><span className="slds-truncate">{d.label} Information</span></h3>
            <div className="slds-form" role="list">
              <div className="slds-grid slds-wrap slds-gutters_small">
                {editable.map((f) => (
                  <div key={f.name} className={`slds-col slds-size_1-of-1 ${f.type === "textarea" ? "" : "slds-medium-size_1-of-2"}`} role="listitem">
                    <FieldInput field={f} value={values[f.name]} error={errors[f.name]} onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))} />
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
  const required = !field.nillable && field.type !== "boolean";
  const common = { id, required, "aria-invalid": !!error, "aria-describedby": error ? `${id}-err` : undefined };
  let input: React.ReactNode;
  if (field.type === "boolean") {
    return (
      <div className="slds-form-element slds-form-element_stacked">
        <div className="slds-checkbox">
          <input type="checkbox" id={id} checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          <label className="slds-checkbox__label" htmlFor={id}><span className="slds-checkbox_faux" /><span className="slds-form-element__label">{field.label}</span></label>
        </div>
      </div>
    );
  } else if (field.type === "picklist") {
    input = (
      <div className="slds-select_container">
        <select className="slds-select" {...common} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
          {field.nillable && <option value="">--None--</option>}
          {field.picklistValues.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  } else if (field.type === "textarea") {
    input = <textarea className="slds-textarea" {...common} value={value ?? ""} rows={3} onChange={(e) => onChange(e.target.value)} />;
  } else if (field.type === "reference") {
    input = <LookupInput field={field} id={id} value={value} onChange={onChange} />;
  } else {
    const type = { email: "email", phone: "tel", url: "url", int: "number", double: "number", currency: "number", percent: "number", date: "date", datetime: "datetime-local" }[field.type] ?? "text";
    const shown = field.type === "datetime" && value ? String(value).slice(0, 16) : value ?? "";
    input = (
      <input className="slds-input" {...common} type={type} value={shown} step={field.type === "currency" ? "0.01" : undefined}
        onChange={(e) => onChange(field.type === "datetime" && e.target.value ? new Date(e.target.value).toISOString() : e.target.value)} />
    );
  }
  return (
    <div className={`slds-form-element slds-form-element_stacked ${error ? "slds-has-error" : ""}`}>
      <label className="slds-form-element__label" htmlFor={id}>{required && <abbr className="slds-required" title="required">* </abbr>}{field.label}</label>
      <div className="slds-form-element__control">{input}</div>
      {error && <div className="slds-form-element__help" id={`${id}-err`}>{error}</div>}
    </div>
  );
}

/** Lookup: pick the object (for polymorphic fields like WhoId/WhatId), then a record of that object. */
function LookupInput({ field, id, value, onChange }: { field: Field; id: string; value: string; onChange: (v: string) => void }) {
  const meta = useMeta();
  const targets = field.referenceTo.filter((t) => meta.sobjects.some((s) => s.name === t));
  const initialTarget = (value && targets.find((t) => value.startsWith(meta.sobjects.find((s) => s.name === t)!.keyPrefix))) || targets[0];
  const [target, setTarget] = useState(initialTarget);
  const [options, setOptions] = useState<{ Id: string; label: string }[]>([]);
  useEffect(() => {
    if (!target) return;
    loadDescribe(target).then((td) =>
      api<{ records: SRecord[] }>(`/sobjects/${target}?limit=200&sort=${td.nameField}&dir=asc`).then((r) =>
        setOptions(r.records.map((x) => ({ Id: x.Id, label: String(x[td.nameField] ?? x.Id) })))),
    ).catch(() => setOptions([]));
  }, [target]);
  if (!targets.length) return <input id={id} className="slds-input" disabled value="" />;
  return (
    <div className="slds-grid slds-gutters_xx-small">
      {targets.length > 1 && (
        <div className="slds-col slds-shrink-none">
          <div className="slds-select_container">
            <label className="slds-assistive-text" htmlFor={`${id}-type`}>{field.label} object</label>
            <select id={`${id}-type`} className="slds-select" value={target} onChange={(e) => { setTarget(e.target.value); onChange(""); }}>
              {targets.map((t) => <option key={t} value={t}>{meta.sobjects.find((s) => s.name === t)!.label}</option>)}
            </select>
          </div>
        </div>
      )}
      <div className="slds-col">
        <div className="slds-select_container">
          <select id={id} className="slds-select" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
            <option value="">Search {meta.sobjects.find((s) => s.name === target)?.labelPlural ?? ""}...</option>
            {options.map((o) => <option key={o.Id} value={o.Id}>{o.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
