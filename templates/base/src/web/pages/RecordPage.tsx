import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, formatValue, recordName, type ObjectDef } from "../api";
import { useMeta } from "../App";
import { ObjectIcon, UtilityIcon, ErrorAlert, Spinner } from "../Icon";
import { RecordForm } from "./RecordForm";
import standardSprite from "@salesforce-ux/design-system/assets/icons/standard-sprite/svg/symbols.svg?url";

interface Detail {
  record: Record<string, any>;
  name: string;
  lookups: Record<string, { id: string; name: string; object: string } | null>;
  related: Record<string, Record<string, any>[]>;
  timeline: Record<string, any>[];
  tasks: Record<string, any>[];
  owner: { id: string; name: string } | null;
}

/** Lightning record page: highlights panel, path, Details/Related tabs, activity on the right. */
export function RecordPage() {
  const { object = "", id = "" } = useParams();
  const meta = useMeta();
  const def: ObjectDef | undefined = meta.objects[object];
  const navigate = useNavigate();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<"related" | "details">("details");
  const perm = meta.permissions.find((p) => p.object === object);

  const load = () => {
    setError("");
    api<Detail>(`/o/${object}/${id}`).then(setD).catch((e) => setError(e.message));
  };
  useEffect(() => { setD(null); load(); }, [object, id]);

  if (!def) return <article className="slds-card"><div className="slds-card__body slds-card__body_inner">You don't have access to this object.</div></article>;
  if (error && !d) return <><ErrorAlert message={error} /><Link to={`/o/${object}`}>Back to {def.plural}</Link></>;
  if (!d) return <Spinner />;

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

  const fieldOf = (n: string) => def.fields.find((f) => f.name === n);
  const highlights = def.listFields.filter((f) => !def.nameFields.includes(f)).slice(0, 4);
  const hasPath = object === "opportunities" || object === "leads" || object === "cases";
  const pathField = object === "opportunities" ? "stage" : "status";
  const pathSteps = object === "opportunities" ? meta.stages : fieldOf(pathField)?.options ?? [];

  return (
    <div className="crm-record">
      {error && <ErrorAlert message={error} />}
      <div className="slds-page-header slds-page-header_record-home">
        <div className="slds-page-header__row">
          <div className="slds-page-header__col-title">
            <div className="slds-media">
              <div className="slds-media__figure"><ObjectIcon object={object} size="medium" /></div>
              <div className="slds-media__body">
                <div className="slds-page-header__name">
                  <div className="slds-page-header__name-title">
                    <h1>
                      <span>{def.label}</span>
                      <span className="slds-page-header__title slds-truncate" title={d.name}>{d.name || "(no name)"}</span>
                    </h1>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="slds-page-header__col-actions">
            <div className="slds-page-header__controls">
              <div className="slds-page-header__control">
                <ul className="slds-button-group-list">
                  {object === "leads" && !r.converted_contact_id && perm?.can_edit ? <li><button className="slds-button slds-button_neutral" onClick={convert}>Convert</button></li> : null}
                  {perm?.can_edit ? <li><button className="slds-button slds-button_neutral" onClick={() => setEditing(true)}>Edit</button></li> : null}
                  {perm?.can_delete ? <li><button className="slds-button slds-button_neutral" onClick={remove}>Delete</button></li> : null}
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div className="slds-page-header__row slds-page-header__row_gutters">
          <div className="slds-page-header__col-details">
            <ul className="slds-page-header__detail-row">
              {highlights.map((f) => (
                <li key={f} className="slds-page-header__detail-block">
                  <div className="slds-text-title slds-truncate" title={fieldOf(f)?.label}>{fieldOf(f)?.label}</div>
                  <div className="slds-truncate">{formatValue(fieldOf(f), r[f]) || " "}</div>
                </li>
              ))}
              <li className="slds-page-header__detail-block">
                <div className="slds-text-title slds-truncate">{def.label} Owner</div>
                <div className="slds-truncate">{d.owner?.name ?? " "}</div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {hasPath && pathSteps.length > 0 && (
        <article className="slds-card slds-m-top_small">
          <div className="slds-card__body slds-card__body_inner slds-p-vertical_small">
            <Path steps={pathSteps} current={r[pathField]} closed={object === "opportunities" ? meta.closedStages : []}
              disabled={!perm?.can_edit}
              onSelect={(s) => api(`/o/${object}/${id}`, { method: "PATCH", body: { [pathField]: s } }).then(load).catch((e) => setError(e.message))} />
          </div>
        </article>
      )}

      <div className="slds-grid slds-wrap slds-gutters_x-small slds-m-top_small">
        <div className="slds-col slds-size_1-of-1 slds-large-size_8-of-12">
          <article className="slds-card">
            <div className="slds-tabs_default slds-p-horizontal_medium">
              <ul className="slds-tabs_default__nav" role="tablist">
                {(["related", "details"] as const).map((t) => (
                  <li key={t} className={`slds-tabs_default__item ${tab === t ? "slds-is-active" : ""}`} role="presentation">
                    <a className="slds-tabs_default__link" href="#" role="tab" aria-selected={tab === t} onClick={(e) => { e.preventDefault(); setTab(t); }}>
                      {t === "related" ? "Related" : "Details"}
                    </a>
                  </li>
                ))}
              </ul>
              <div className="slds-tabs_default__content slds-show" role="tabpanel">
                {tab === "details" ? (
                  <div className="slds-form" role="list">
                    <div className="slds-grid slds-wrap slds-gutters_small">
                      {def.fields.map((f) => {
                        const lk = d.lookups[f.name];
                        return (
                          <div key={f.name} className={`slds-col slds-size_1-of-1 ${f.type === "textarea" ? "" : "slds-medium-size_1-of-2"}`} role="listitem">
                            <div className="slds-form-element slds-form-element_edit slds-form-element_readonly slds-form-element_stacked slds-hint-parent">
                              <span className="slds-form-element__label">{f.label}</span>
                              <div className="slds-form-element__control">
                                <div className="slds-form-element__static">
                                  {f.type === "lookup" ? (lk ? <Link to={`/o/${lk.object}/${lk.id}`}>{lk.name}</Link> : " ") : formatValue(f, r[f.name]) || " "}
                                </div>
                                {perm?.can_edit ? (
                                  <button className="slds-button slds-button_icon" title={`Edit ${f.label}`} onClick={() => setEditing(true)}>
                                    <UtilityIcon name="edit" className="slds-button__icon slds-button__icon_hint" label={`Edit ${f.label}`} />
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <RelatedLists object={object} id={id} related={d.related} onChange={load} />
                )}
              </div>
            </div>
          </article>
        </div>
        <div className="slds-col slds-size_1-of-1 slds-large-size_4-of-12">
          <Activity object={object} id={id} timeline={d.timeline} tasks={d.tasks} onChange={load} />
        </div>
      </div>

      {editing && <RecordForm object={object} def={def} record={r} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />}
    </div>
  );
}

/** SLDS Path (the chevron stage bar). */
function Path({ steps, current, closed, disabled, onSelect }: { steps: string[]; current: string; closed: string[]; disabled?: boolean; onSelect: (s: string) => void }) {
  const cur = steps.indexOf(current);
  const [selected, setSelected] = useState(current);
  useEffect(() => setSelected(current), [current]);
  return (
    <div className="slds-path">
      <div className="slds-grid slds-path__track">
        <div className="slds-grid slds-path__scroller-container">
          <div className="slds-path__scroller">
            <div className="slds-path__scroller_inner">
              <ul className="slds-path__nav" role="listbox" aria-orientation="horizontal">
                {steps.map((s, i) => {
                  const state = s === current ? (closed.includes(s) && s !== closed[0] ? "slds-is-lost" : closed.includes(s) ? "slds-is-won" : "slds-is-current slds-is-active")
                    : i < cur ? "slds-is-complete" : "slds-is-incomplete";
                  const isSel = s === selected && s !== current;
                  return (
                    <li key={s} className={`slds-path__item ${state} ${isSel ? "slds-is-active" : ""}`} role="presentation">
                      <a aria-selected={s === current} className="slds-path__link" href="#" role="option" tabIndex={0}
                        onClick={(e) => { e.preventDefault(); if (!disabled) setSelected(s); }}>
                        <span className="slds-path__stage">
                          <UtilityIcon name="check" className="slds-icon slds-icon_x-small" />
                          <span className="slds-assistive-text">{i < cur ? "Stage Complete" : s === current ? "Current Stage:" : ""}</span>
                        </span>
                        <span className="slds-path__title">{s}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
        {!disabled && (
          <div className="slds-grid slds-path__action">
            <button className="slds-button slds-button_brand slds-path__mark-complete"
              onClick={() => {
                if (selected !== current) return onSelect(selected);
                const next = steps[cur + 1];
                if (next) onSelect(next);
              }}
              disabled={selected === current && cur >= steps.length - 1}>
              <UtilityIcon name="check" className="slds-button__icon slds-button__icon_left" />
              {selected !== current ? "Mark as Current Stage" : "Mark Stage as Complete"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RelatedLists({ object, id, related, onChange }: { object: string; id: string; related: Detail["related"]; onChange: () => void }) {
  const meta = useMeta();
  const [creating, setCreating] = useState<{ object: string; field: string } | null>(null);
  const rels = (meta.related[object] ?? []).filter((r) => related[r.object]);
  if (!rels.length) return <p className="slds-text-color_weak slds-p-around_medium">No related lists.</p>;
  return (
    <div>
      {rels.map((rel) => {
        const def = meta.objects[rel.object];
        const rows = related[rel.object] ?? [];
        const canCreate = meta.permissions.find((p) => p.object === rel.object)?.can_create;
        const cols = def.listFields.slice(0, 3);
        return (
          <article key={rel.object} className="slds-card slds-card_boundary slds-m-bottom_small">
            <div className="slds-card__header slds-grid">
              <header className="slds-media slds-media_center slds-has-flexi-truncate">
                <div className="slds-media__figure"><ObjectIcon object={rel.object} size="small" /></div>
                <div className="slds-media__body">
                  <h2 className="slds-card__header-title">
                    <Link to={`/o/${rel.object}`} className="slds-card__header-link slds-truncate"><span>{def.plural} ({rows.length})</span></Link>
                  </h2>
                </div>
                {canCreate ? <div className="slds-no-flex"><button className="slds-button slds-button_neutral" onClick={() => setCreating(rel)}>New</button></div> : null}
              </header>
            </div>
            {rows.length > 0 && (
              <div className="slds-card__body">
                <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-table_fixed-layout crm-table">
                  <thead><tr className="slds-line-height_reset">{cols.map((c) => <th key={c} scope="col"><div className="slds-truncate">{def.fields.find((f) => f.name === c)?.label}</div></th>)}</tr></thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="slds-hint-parent">
                        {cols.map((c, i) => {
                          const f = def.fields.find((x) => x.name === c);
                          return <td key={c} data-label={f?.label}><div className="slds-truncate">{i === 0 ? <Link to={`/o/${rel.object}/${row.id}`}>{recordName(def, row)}</Link> : formatValue(f, row[c])}</div></td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {rows.length > 0 && <footer className="slds-card__footer"><Link className="slds-card__footer-action" to={`/o/${rel.object}`}>View All</Link></footer>}
          </article>
        );
      })}
      {creating && (
        <RecordForm object={creating.object} def={meta.objects[creating.object]} defaults={{ [creating.field]: id }}
          onClose={() => setCreating(null)} onSaved={() => { setCreating(null); onChange(); }} />
      )}
    </div>
  );
}

const ACTIVITY_STYLE: Record<string, { cls: string; icon: string }> = {
  Call: { cls: "slds-timeline__item_call", icon: "log_a_call" },
  Email: { cls: "slds-timeline__item_email", icon: "email" },
  Meeting: { cls: "slds-timeline__item_event", icon: "event" },
  Note: { cls: "slds-timeline__item_task", icon: "note" },
  Task: { cls: "slds-timeline__item_task", icon: "task" },
};

function Activity({ object, id, timeline, tasks, onChange }: { object: string; id: string; timeline: any[]; tasks: any[]; onChange: () => void }) {
  const meta = useMeta();
  const [type, setType] = useState("Call");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const canLog = meta.permissions.find((p) => p.object === "activities")?.can_create;
  const canTask = meta.permissions.find((p) => p.object === "tasks")?.can_create;
  const types = [...(canLog ? ["Call", "Email", "Meeting", "Note"] : []), ...(canTask ? ["Task"] : [])];

  const log = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (type === "Task") await api("/o/tasks", { method: "POST", body: { subject, related_object: object, related_id: id } });
      else await api("/o/activities", { method: "POST", body: { type, subject, body, related_object: object, related_id: id } });
      setSubject("");
      setBody("");
      onChange();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const open = tasks.filter((t) => t.status !== "Completed");

  return (
    <article className="slds-card" aria-label="Activity">
      <div className="slds-tabs_default slds-p-horizontal_medium">
        <ul className="slds-tabs_default__nav" role="tablist">
          <li className="slds-tabs_default__item slds-is-active" role="presentation"><span className="slds-tabs_default__link" role="tab" aria-selected="true">Activity</span></li>
        </ul>
      </div>
      <div className="slds-card__body slds-card__body_inner">
        {types.length > 0 && (
          <form onSubmit={log} className="slds-m-bottom_medium">
            <div className="slds-button-group slds-m-bottom_x-small crm-activity-types" role="radiogroup" aria-label="Activity type">
              {types.map((t) => (
                <button type="button" key={t} role="radio" aria-checked={type === t}
                  className={`slds-button ${type === t ? "slds-button_brand" : "slds-button_neutral"}`} onClick={() => setType(t)}>
                  {t === "Call" ? "Log a Call" : t === "Task" ? "New Task" : t}
                </button>
              ))}
            </div>
            <div className="slds-form-element slds-m-bottom_x-small">
              <label className="slds-assistive-text" htmlFor="act-subject">Subject</label>
              <input id="act-subject" className="slds-input" placeholder="Subject" required value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            {type !== "Task" && (
              <div className="slds-form-element slds-m-bottom_x-small">
                <label className="slds-assistive-text" htmlFor="act-body">Comments</label>
                <textarea id="act-body" className="slds-textarea" rows={2} placeholder="Comments" value={body} onChange={(e) => setBody(e.target.value)} />
              </div>
            )}
            {error && <ErrorAlert message={error} />}
            <div className="slds-text-align_right"><button className="slds-button slds-button_brand">Save</button></div>
          </form>
        )}

        <h3 className="slds-section__title slds-theme_shade slds-p-horizontal_small slds-m-bottom_x-small">Upcoming &amp; Overdue</h3>
        {open.length === 0 ? <p className="slds-text-color_weak slds-p-around_small slds-text-align_center">No next steps. To get things moving, add a task.</p> : (
          <ul className="slds-timeline">
            {open.map((t) => <TimelineItem key={t.id} kind="Task" title={<Link to={`/o/tasks/${t.id}`}>{t.subject}</Link>} date={t.due_date ?? "No due date"} />)}
          </ul>
        )}
        <h3 className="slds-section__title slds-theme_shade slds-p-horizontal_small slds-m-vertical_x-small">Past Activity</h3>
        {timeline.length === 0 ? <p className="slds-text-color_weak slds-p-around_small slds-text-align_center">No past activity.</p> : (
          <ul className="slds-timeline">
            {timeline.map((a) => <TimelineItem key={a.id} kind={a.type} title={a.subject} body={a.body} date={new Date(a.created_at + "Z").toLocaleString()} />)}
          </ul>
        )}
      </div>
    </article>
  );
}

function TimelineItem({ kind, title, body, date }: { kind: string; title: React.ReactNode; body?: string; date: string }) {
  const s = ACTIVITY_STYLE[kind] ?? ACTIVITY_STYLE.Note!;
  return (
    <li>
      <div className={`slds-timeline__item_expandable ${s.cls}`}>
        <div className="slds-media">
          <div className="slds-media__figure">
            <div className={`slds-icon_container slds-icon-standard-${s.icon.replace(/_/g, "-")} slds-timeline__icon`} title={kind}>
              <svg className="slds-icon slds-icon_small" aria-hidden="true"><use href={`${standardSprite}#${s.icon}`} /></svg>
            </div>
          </div>
          <div className="slds-media__body">
            <div className="slds-grid slds-grid_align-spread slds-timeline__trigger">
              <h3 className="slds-truncate"><strong>{title}</strong></h3>
              <p className="slds-timeline__date">{date}</p>
            </div>
            {body && <p className="slds-m-top_xx-small slds-text-body_small">{body}</p>}
          </div>
        </div>
      </div>
    </li>
  );
}
