import { useEffect, useRef, useState } from "react";
import { api, ApiError, recordName, type ObjectDef, type Field } from "../api";
import { useMeta } from "../App";

/** Modal used for New and Edit, like a Lightning record form. */
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
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
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
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={dialog} className="modal" onClose={onClose} aria-labelledby="form-title">
      <form onSubmit={submit}>
        <h2 id="form-title">{record ? `Edit ${recordName(def, record)}` : `New ${def.label}`}</h2>
        <div className="form-grid">
          {def.fields.map((f) => (
            <FieldInput key={f.name} field={f} value={values[f.name]} error={errors[f.name]}
              onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))} />
          ))}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={() => dialog.current?.close()}>Cancel</button>
          <button className="btn btn-brand" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </dialog>
  );
}

function FieldInput({ field, value, error, onChange }: { field: Field; value: any; error?: string; onChange: (v: any) => void }) {
  const id = `f-${field.name}`;
  const common = { id, value: value ?? "", required: field.required, "aria-invalid": !!error, "aria-describedby": error ? `${id}-err` : undefined };
  let input: React.ReactNode;
  if (field.type === "picklist") {
    input = (
      <select {...common} onChange={(e) => onChange(e.target.value)}>
        {!field.required && <option value="">--None--</option>}
        {field.options?.map((o) => <option key={o}>{o}</option>)}
      </select>
    );
  } else if (field.type === "textarea") {
    input = <textarea {...common} rows={4} onChange={(e) => onChange(e.target.value)} />;
  } else if (field.type === "lookup") {
    input = <LookupInput object={field.lookup!} {...common} onChange={onChange} />;
  } else {
    const type = { email: "email", phone: "tel", url: "url", number: "number", currency: "number", date: "date" }[field.type] ?? "text";
    input = <input {...common} type={type} step={field.type === "currency" ? "0.01" : undefined} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <div className={`field ${field.type === "textarea" ? "span-2" : ""}`}>
      <label htmlFor={id}>{field.required && <abbr title="required" className="req">*</abbr>}{field.label}</label>
      {input}
      {error && <p id={`${id}-err`} className="error">{error}</p>}
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
  if (!def) return <input id={id} disabled value="" />;
  return (
    <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">--None--</option>
      {options.map((o) => <option key={o.id} value={o.id}>{recordName(def, o)}</option>)}
    </select>
  );
}
