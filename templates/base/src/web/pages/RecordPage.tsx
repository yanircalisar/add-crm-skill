import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, formatValue, recordName, type ObjectDef } from "../api";
import { useMeta } from "../App";
import { RecordForm } from "./RecordForm";

interface Detail {
  record: Record<string, any>;
  name: string;
  lookups: Record<string, { id: string; name: string; object: string } | null>;
  related: Record<string, Record<string, any>[]>;
  timeline: Record<string, any>[];
  tasks: Record<string, any>[];
  owner: { id: string; name: string } | null;
}

export function RecordPage() {
  const { object = "", id = "" } = useParams();
  const meta = useMeta();
  const def: ObjectDef | undefined = meta.objects[object];
  const navigate = useNavigate();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<"details" | "related">("details");
  const perm = meta.permissions.find((p) => p.object === object);

  const load = () => {
    setError("");
    api<Detail>(`/o/${object}/${id}`).then(setD).catch((e) => setError(e.message));
  };
  useEffect(() => { setD(null); load(); }, [object, id]);

  if (!def) return <div className="card empty">You don't have access to this object.</div>;
  if (error) return <div className="card"><p className="error" role="alert">{error}</p><Link to={`/o/${object}`}>Back to {def.plural}</Link></div>;
  if (!d) return <div className="card" role="status" aria-live="polite"><span className="skeleton skeleton-title" /><span className="skeleton" /></div>;

  const r = d.record;
  const remove = async () => {
    if (!confirm(`Delete this ${def.label.toLowerCase()}?`)) return;
    await api(`/o/${object}/${id}`, { method: "DELETE" }).then(() => navigate(`/o/${object}`)).catch((e) => setError(e.message));
  };
  const convert = async () => {
    const createOpportunity = confirm("Also create an opportunity?");
    const res = await api<{ accountId: string }>(`/leads/${id}/convert`, { method: "POST", body: { createOpportunity } }).catch((e) => { setError(e.message); return null; });
    if (res) navigate(`/o/accounts/${res.accountId}`);
  };
  const setStage = (stage: string) => api(`/o/${object}/${id}`, { method: "PATCH", body: { stage } }).then(load).catch((e) => setError(e.message));

  const highlights = def.listFields.slice(1, 5);
  const fieldOf = (n: string) => def.fields.find((f) => f.name === n);

  return (
    <div className="record">
      <section className="card record-header">
        <div>
          <p className="eyebrow">{def.label}</p>
          <h1>{d.name || "(no name)"}</h1>
        </div>
        <div className="record-actions">
          {object === "leads" && !r.converted_contact_id && perm?.can_edit ? <button className="btn" onClick={convert}>Convert</button> : null}
          {perm?.can_edit ? <button className="btn" onClick={() => setEditing(true)}>Edit</button> : null}
          {perm?.can_delete ? <button className="btn btn-danger" onClick={remove}>Delete</button> : null}
        </div>
        <dl className="highlights">
          {highlights.map((f) => (
            <div key={f}><dt>{fieldOf(f)?.label}</dt><dd>{formatValue(fieldOf(f), r[f]) || "—"}</dd></div>
          ))}
          <div><dt>Owner</dt><dd>{d.owner?.name ?? "—"}</dd></div>
        </dl>
      </section>

      {object === "opportunities" && (
        <nav className="card path" aria-label="Stage">
          <ol>
            {meta.stages.map((s, i) => {
              const cur = meta.stages.indexOf(r.stage);
              const state = s === r.stage ? "current" : i < cur ? "done" : "";
              return (
                <li key={s} className={state}>
                  <button disabled={!perm?.can_edit} aria-current={s === r.stage ? "step" : undefined} onClick={() => setStage(s)}>{s}</button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      <div className="record-body">
        <section className="card">
          <div role="tablist" className="subtabs">
            <button role="tab" aria-selected={tab === "details"} onClick={() => setTab("details")}>Details</button>
            <button role="tab" aria-selected={tab === "related"} onClick={() => setTab("related")}>Related</button>
          </div>
          {tab === "details" ? (
            <dl className="details">
              {def.fields.map((f) => {
                const lk = d.lookups[f.name];
                return (
                  <div key={f.name} className={f.type === "textarea" ? "span-2" : ""}>
                    <dt>{f.label}</dt>
                    <dd>{f.type === "lookup" ? (lk ? <Link to={`/o/${lk.object}/${lk.id}`}>{lk.name}</Link> : "—") : formatValue(f, r[f.name]) || "—"}</dd>
                  </div>
                );
              })}
            </dl>
          ) : (
            <RelatedLists object={object} id={id} related={d.related} onChange={load} />
          )}
        </section>
        <Activity object={object} id={id} timeline={d.timeline} tasks={d.tasks} onChange={load} />
      </div>

      {editing && <RecordForm object={object} def={def} record={r} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />}
    </div>
  );
}

function RelatedLists({ object, id, related, onChange }: { object: string; id: string; related: Detail["related"]; onChange: () => void }) {
  const meta = useMeta();
  const [creating, setCreating] = useState<{ object: string; field: string } | null>(null);
  const rels = (meta.related[object] ?? []).filter((r) => related[r.object]);
  if (!rels.length) return <p className="empty">No related lists.</p>;
  return (
    <div className="related">
      {rels.map((rel) => {
        const def = meta.objects[rel.object];
        const rows = related[rel.object] ?? [];
        const canCreate = meta.permissions.find((p) => p.object === rel.object)?.can_create;
        return (
          <section key={rel.object} className="related-list">
            <header>
              <h3>{def.plural} ({rows.length})</h3>
              {canCreate ? <button className="btn btn-small" onClick={() => setCreating(rel)}>New</button> : null}
            </header>
            {rows.length === 0 ? <p className="empty small">None yet.</p> : (
              <ul>{rows.map((row) => <li key={row.id}><Link to={`/o/${rel.object}/${row.id}`}>{recordName(def, row)}</Link></li>)}</ul>
            )}
          </section>
        );
      })}
      {creating && (
        <RecordForm object={creating.object} def={meta.objects[creating.object]} defaults={{ [creating.field]: id }}
          onClose={() => setCreating(null)} onSaved={() => { setCreating(null); onChange(); }} />
      )}
    </div>
  );
}

function Activity({ object, id, timeline, tasks, onChange }: { object: string; id: string; timeline: any[]; tasks: any[]; onChange: () => void }) {
  const meta = useMeta();
  const [type, setType] = useState("Call");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const canLog = meta.permissions.find((p) => p.object === "activities")?.can_create;
  const canTask = meta.permissions.find((p) => p.object === "tasks")?.can_create;

  const log = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (type === "Task") {
        await api("/o/tasks", { method: "POST", body: { subject, related_object: object, related_id: id } });
      } else {
        await api("/o/activities", { method: "POST", body: { type, subject, body, related_object: object, related_id: id } });
      }
      setSubject("");
      setBody("");
      onChange();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <aside className="card activity" aria-label="Activity">
      <h2>Activity</h2>
      {(canLog || canTask) ? (
        <form onSubmit={log} className="log-form">
          <div role="radiogroup" aria-label="Activity type" className="seg">
            {[...(canLog ? ["Call", "Note", "Email", "Meeting"] : []), ...(canTask ? ["Task"] : [])].map((t) => (
              <button type="button" key={t} role="radio" aria-checked={type === t} onClick={() => setType(t)}>{t}</button>
            ))}
          </div>
          <label className="sr-only" htmlFor="act-subject">Subject</label>
          <input id="act-subject" placeholder="Subject" required value={subject} onChange={(e) => setSubject(e.target.value)} />
          {type !== "Task" && (<><label className="sr-only" htmlFor="act-body">Details</label><textarea id="act-body" rows={2} placeholder="Details" value={body} onChange={(e) => setBody(e.target.value)} /></>)}
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn btn-brand btn-small">Save</button>
        </form>
      ) : null}

      <h3>Open tasks</h3>
      {tasks.filter((t) => t.status !== "Completed").length === 0 ? <p className="empty small">No open tasks.</p> : (
        <ul className="timeline">{tasks.filter((t) => t.status !== "Completed").map((t) => (
          <li key={t.id}><Link to={`/o/tasks/${t.id}`}>{t.subject}</Link><span className="muted small">{t.due_date ?? "No due date"}</span></li>
        ))}</ul>
      )}
      <h3>History</h3>
      {timeline.length === 0 ? <p className="empty small">No activity yet.</p> : (
        <ul className="timeline">{timeline.map((a) => (
          <li key={a.id}><strong>{a.type}:</strong> {a.subject}{a.body && <p className="small">{a.body}</p>}<span className="muted small">{new Date(a.created_at + "Z").toLocaleString()}</span></li>
        ))}</ul>
      )}
    </aside>
  );
}
