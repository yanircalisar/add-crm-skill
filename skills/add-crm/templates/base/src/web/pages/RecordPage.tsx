import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, describe as loadDescribe, fieldOf, formatValue, listUrl, recordUrl, type Describe, type Names, type SRecord } from "../api";
import { useMeta } from "../App";
import { ObjectIcon, UtilityIcon, ErrorAlert, Spinner } from "../Icon";
import { FieldValue } from "../components";
import { RecordForm } from "./RecordForm";

interface RecordUi {
  record: SRecord;
  name: string;
  names: Names;
  related: Record<string, { relationship: { childSObject: string; field: string }; records: SRecord[]; totalSize: number }>;
  activities: SRecord[];
}

/** Lightning record page. URL: /lightning/r/{Type}/{Id}/view (or /lightning/r/{Id}: type comes from the key prefix). */
export function RecordPage() {
  const { id = "" } = useParams();
  const meta = useMeta();
  const navigate = useNavigate();
  const [ui, setUi] = useState<RecordUi | null>(null);
  const [d, setD] = useState<Describe | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [tab, setTab] = useState<"related" | "details">("details");

  const load = () => {
    setError("");
    api<RecordUi>(`/ui-api/records/${id}`)
      .then(async (r) => { setD(await loadDescribe(r.record.attributes.type)); setUi(r); })
      .catch((e) => setError(e.message));
  };
  useEffect(() => { setUi(null); setEditing(false); setConverting(false); setTab("details"); load(); }, [id]);

  if (error && !ui) return <ErrorAlert message={error} />;
  if (!ui || !d) return <Spinner />;

  const r = ui.record;
  const type = d.name;
  const remove = async () => {
    if (!confirm(`Delete this ${d.label.toLowerCase()}? You can restore it from the Recycle Bin.`)) return;
    await api(`/sobjects/${type}/${r.Id}`, { method: "DELETE" }).then(() => navigate(listUrl(type))).catch((e) => setError(e.message));
  };
  const save = (patch: Record<string, unknown>) => api(`/sobjects/${type}/${r.Id}`, { method: "PATCH", body: patch }).then(load).catch((e) => setError(e.message));

  const path = type === "Opportunity" ? { field: "StageName", steps: meta.stages.map((s) => s.name), closed: meta.stages.filter((s) => s.isClosed) }
    : type === "Lead" ? { field: "Status", steps: fieldOf(d, "Status")!.picklistValues.map((p) => p.value), closed: [] }
    : type === "Case" ? { field: "Status", steps: fieldOf(d, "Status")!.picklistValues.map((p) => p.value), closed: [] }
    : null;
  const converted = type === "Lead" && r.IsConverted;

  return (
    <div className="crm-record">
      {error && <ErrorAlert message={error} />}
      <div className="slds-page-header slds-page-header_record-home">
        <div className="slds-page-header__row">
          <div className="slds-page-header__col-title">
            <div className="slds-media">
              <div className="slds-media__figure"><ObjectIcon object={type} size="medium" /></div>
              <div className="slds-media__body">
                <div className="slds-page-header__name"><div className="slds-page-header__name-title"><h1>
                  <span>{d.label}</span>
                  <span className="slds-page-header__title slds-truncate" title={ui.name}>{ui.name || "(no name)"}</span>
                </h1></div></div>
              </div>
            </div>
          </div>
          <div className="slds-page-header__col-actions">
            <div className="slds-page-header__controls"><div className="slds-page-header__control">
              <ul className="slds-button-group-list">
                {type === "Lead" && !converted && d.updateable && <li><button className="slds-button slds-button_neutral" onClick={() => setConverting(true)}>Convert</button></li>}
                {d.updateable && !converted && <li><button className="slds-button slds-button_neutral" onClick={() => setEditing(true)}>Edit</button></li>}
                {d.deletable && <li><button className="slds-button slds-button_neutral" onClick={remove}>Delete</button></li>}
              </ul>
            </div></div>
          </div>
        </div>
        <div className="slds-page-header__row slds-page-header__row_gutters">
          <div className="slds-page-header__col-details">
            <ul className="slds-page-header__detail-row">
              {d.highlightFields.map((f) => (
                <li key={f} className="slds-page-header__detail-block">
                  <div className="slds-text-title slds-truncate" title={fieldOf(d, f)?.label}>{fieldOf(d, f)?.label}</div>
                  <div className="slds-truncate"><FieldValue field={fieldOf(d, f)} value={r[f]} names={ui.names} />{" "}</div>
                </li>
              ))}
              {"OwnerId" in r && (
                <li className="slds-page-header__detail-block">
                  <div className="slds-text-title slds-truncate">{d.label} Owner</div>
                  <div className="slds-truncate">{ui.names[r.OwnerId]?.name ?? " "}</div>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {converted && (
        <div className="slds-notify slds-notify_alert slds-alert_offline slds-m-top_small crm-converted" role="status">
          <span>This lead was converted on {formatValue({ type: "date" }, r.ConvertedDate)}.&nbsp;</span>
          {r.ConvertedAccountId && <Link to={recordUrl("Account", r.ConvertedAccountId)}>Account</Link>}
          {r.ConvertedContactId && <>&nbsp;·&nbsp;<Link to={recordUrl("Contact", r.ConvertedContactId)}>Contact</Link></>}
          {r.ConvertedOpportunityId && <>&nbsp;·&nbsp;<Link to={recordUrl("Opportunity", r.ConvertedOpportunityId)}>Opportunity</Link></>}
        </div>
      )}

      {path && !converted && (
        <article className="slds-card slds-m-top_small">
          <div className="slds-card__body slds-card__body_inner slds-p-vertical_small">
            <Path steps={path.steps.filter((s) => s !== "Closed - Converted")} current={r[path.field]} won={path.closed.find((s) => s.isWon)?.name}
              lost={path.closed.filter((s) => !s.isWon).map((s) => s.name)} disabled={!d.updateable} onSelect={(s) => save({ [path.field]: s })} />
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
                    <a className="slds-tabs_default__link" href="#" role="tab" aria-selected={tab === t} onClick={(e) => { e.preventDefault(); setTab(t); }}>{t === "related" ? "Related" : "Details"}</a>
                  </li>
                ))}
              </ul>
              <div className="slds-tabs_default__content slds-show" role="tabpanel">
                {tab === "details" ? <Details d={d} r={r} names={ui.names} canEdit={d.updateable && !converted} onEdit={() => setEditing(true)} />
                  : <RelatedLists parentId={r.Id} related={ui.related} names={ui.names} onChange={load} />}
              </div>
            </div>
          </article>
        </div>
        <div className="slds-col slds-size_1-of-1 slds-large-size_4-of-12">
          {["Account", "Contact", "Lead", "Opportunity", "Case"].includes(type) && <Activity type={type} id={r.Id} activities={ui.activities} names={ui.names} onChange={load} />}
        </div>
      </div>

      {editing && <RecordForm describe={d} record={r} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />}
      {converting && <ConvertLead lead={r} onClose={() => setConverting(false)} onDone={(accountId) => navigate(recordUrl("Account", accountId))} />}
    </div>
  );
}

const SYSTEM_SECTION = ["CreatedById", "CreatedDate", "LastModifiedById", "LastModifiedDate"];

function Details({ d, r, names, canEdit, onEdit }: { d: Describe; r: SRecord; names: Names; canEdit: boolean; onEdit: () => void }) {
  const main = d.fields.filter((f) => !["Id", "IsDeleted", "SystemModstamp", ...SYSTEM_SECTION].includes(f.name) && !(f.calculated && f.name === "Name" && d.fields.some((x) => x.name === "LastName")));
  const cell = (fname: string) => {
    const f = fieldOf(d, fname)!;
    return (
      <div key={f.name} className={`slds-col slds-size_1-of-1 ${f.type === "textarea" ? "" : "slds-medium-size_1-of-2"}`} role="listitem">
        <div className="slds-form-element slds-form-element_edit slds-form-element_readonly slds-form-element_stacked slds-hint-parent">
          <span className="slds-form-element__label">{f.label}</span>
          <div className="slds-form-element__control">
            <div className="slds-form-element__static"><FieldValue field={f} value={r[f.name]} names={names} />{" "}</div>
            {canEdit && f.updateable && (
              <button className="slds-button slds-button_icon" title={`Edit ${f.label}`} onClick={onEdit}>
                <UtilityIcon name="edit" className="slds-button__icon slds-button__icon_hint" label={`Edit ${f.label}`} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="slds-form" role="list">
      <div className="slds-grid slds-wrap slds-gutters_small">{main.map((f) => cell(f.name))}</div>
      <h3 className="slds-section__title slds-theme_shade slds-p-horizontal_small slds-m-vertical_small">System Information</h3>
      <div className="slds-grid slds-wrap slds-gutters_small">
        {["CreatedById", "LastModifiedById"].map((f) => (
          <div key={f} className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2" role="listitem">
            <div className="slds-form-element slds-form-element_readonly slds-form-element_stacked">
              <span className="slds-form-element__label">{fieldOf(d, f)!.label}</span>
              <div className="slds-form-element__control"><div className="slds-form-element__static">
                {names[r[f]]?.name ?? ""}, {formatValue({ type: "datetime" }, r[f === "CreatedById" ? "CreatedDate" : "LastModifiedDate"])}
              </div></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Stage path (chevrons). Closed stages show as won (green) or lost. */
function Path({ steps, current, won, lost, disabled, onSelect }: { steps: string[]; current: string; won?: string; lost: string[]; disabled?: boolean; onSelect: (s: string) => void }) {
  const cur = steps.indexOf(current);
  const [selected, setSelected] = useState(current);
  useEffect(() => setSelected(current), [current]);
  return (
    <div className="slds-path">
      <div className="slds-grid slds-path__track">
        <div className="slds-grid slds-path__scroller-container"><div className="slds-path__scroller"><div className="slds-path__scroller_inner">
          <ul className="slds-path__nav" role="listbox" aria-orientation="horizontal">
            {steps.map((s, i) => {
              const state = s === current ? (s === won ? "slds-is-won" : lost.includes(s) ? "slds-is-lost" : "slds-is-current slds-is-active")
                : i < cur ? "slds-is-complete" : "slds-is-incomplete";
              return (
                <li key={s} className={`slds-path__item ${state} ${s === selected && s !== current ? "slds-is-active" : ""}`} role="presentation">
                  <a aria-selected={s === current} className="slds-path__link" href="#" role="option" tabIndex={0} onClick={(e) => { e.preventDefault(); if (!disabled) setSelected(s); }}>
                    <span className="slds-path__stage"><UtilityIcon name="check" className="slds-icon slds-icon_x-small" /><span className="slds-assistive-text">{i < cur ? "Stage Complete" : s === current ? "Current Stage:" : ""}</span></span>
                    <span className="slds-path__title">{s}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div></div></div>
        {!disabled && (
          <div className="slds-grid slds-path__action">
            <button className="slds-button slds-button_brand slds-path__mark-complete" disabled={selected === current && cur >= steps.length - 1}
              onClick={() => { if (selected !== current) return onSelect(selected); const next = steps[cur + 1]; if (next) onSelect(next); }}>
              <UtilityIcon name="check" className="slds-button__icon slds-button__icon_left" />
              {selected !== current ? "Mark as Current Stage" : "Mark Stage as Complete"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RelatedLists({ parentId, related, names, onChange }: { parentId: string; related: RecordUi["related"]; names: Names; onChange: () => void }) {
  const [describes, setDescribes] = useState<Record<string, Describe>>({});
  const [creating, setCreating] = useState<{ d: Describe; field: string } | null>(null);
  const lists = Object.values(related);
  useEffect(() => {
    Promise.all(lists.map((l) => loadDescribe(l.relationship.childSObject))).then((ds) => setDescribes(Object.fromEntries(ds.map((x) => [x.name, x]))));
  }, [related]);
  if (!lists.length) return <p className="slds-text-color_weak slds-p-around_medium">No related lists.</p>;
  return (
    <div>
      {lists.map((l) => {
        const cd = describes[l.relationship.childSObject];
        if (!cd) return <span key={l.relationship.field + l.relationship.childSObject} className="crm-skeleton slds-m-bottom_small" />;
        const cols = cd.listFields.filter((f) => f !== l.relationship.field).slice(0, 4);
        const title = cd.name === "Account" && l.relationship.field === "ParentId" ? "Child Accounts" : cd.name === "Contact" && l.relationship.field === "ReportsToId" ? "Direct Reports" : cd.labelPlural;
        return (
          <article key={`${cd.name}.${l.relationship.field}`} className="slds-card slds-card_boundary slds-m-bottom_small">
            <div className="slds-card__header slds-grid">
              <header className="slds-media slds-media_center slds-has-flexi-truncate">
                <div className="slds-media__figure"><ObjectIcon object={cd.name} size="small" /></div>
                <div className="slds-media__body"><h2 className="slds-card__header-title">
                  <Link to={`${listUrl(cd.name)}`} className="slds-card__header-link slds-truncate"><span>{title} ({l.totalSize > 6 ? "6+" : l.totalSize})</span></Link>
                </h2></div>
                {cd.createable && <div className="slds-no-flex"><button className="slds-button slds-button_neutral" onClick={() => setCreating({ d: cd, field: l.relationship.field })}>New</button></div>}
              </header>
            </div>
            {l.records.length > 0 && (
              <div className="slds-card__body">
                <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-table_fixed-layout crm-table">
                  <thead><tr className="slds-line-height_reset">{cols.map((c) => <th key={c} scope="col"><div className="slds-truncate">{fieldOf(cd, c)?.label}</div></th>)}</tr></thead>
                  <tbody>
                    {l.records.map((row) => (
                      <tr key={row.Id} className="slds-hint-parent">
                        {cols.map((c, i) => (
                          <td key={c} data-label={fieldOf(cd, c)?.label}><div className="slds-truncate">
                            {i === 0 && fieldOf(cd, c)?.type !== "reference" ? <Link to={recordUrl(cd.name, row.Id)}>{String(row[c] ?? "") || "(no name)"}</Link> : <FieldValue field={fieldOf(cd, c)} value={row[c]} names={names} />}
                          </div></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {l.totalSize > 0 && <footer className="slds-card__footer"><Link className="slds-card__footer-action" to={`${listUrl(cd.name)}?field=${l.relationship.field}&value=${parentId}`}>View All</Link></footer>}
          </article>
        );
      })}
      {creating && <RecordForm describe={creating.d} defaults={{ [creating.field]: parentId }} onClose={() => setCreating(null)} onSaved={() => { setCreating(null); onChange(); }} />}
    </div>
  );
}

const TIMELINE: Record<string, { cls: string; icon: string; label: string }> = {
  Call: { cls: "slds-timeline__item_call", icon: "Call", label: "Call" },
  Email: { cls: "slds-timeline__item_email", icon: "Email", label: "Email" },
  Task: { cls: "slds-timeline__item_task", icon: "Task", label: "Task" },
  Event: { cls: "slds-timeline__item_event", icon: "Event", label: "Event" },
};

/** Activity composer + timeline. Calls and emails are Tasks with a TaskSubtype; meetings are Events. */
function Activity({ type, id, activities, names, onChange }: { type: string; id: string; activities: SRecord[]; names: Names; onChange: () => void }) {
  const meta = useMeta();
  const [kind, setKind] = useState<"Call" | "Task" | "Event" | "Email">("Call");
  const [subject, setSubject] = useState("");
  const [comments, setComments] = useState("");
  const [due, setDue] = useState("");
  const [error, setError] = useState("");
  const canTask = meta.sobjects.find((s) => s.name === "Task")?.createable;
  const canEvent = meta.sobjects.find((s) => s.name === "Event")?.createable;
  const link = ["Contact", "Lead"].includes(type) ? { WhoId: id } : { WhatId: id };
  const kinds = [...(canTask ? (["Call", "Task", "Email"] as const) : []), ...(canEvent ? (["Event"] as const) : [])];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (kind === "Event") {
        const start = due ? new Date(due) : new Date(Date.now() + 3600_000);
        await api("/sobjects/Event", { method: "POST", body: { Subject: subject, StartDateTime: start.toISOString(), EndDateTime: new Date(start.getTime() + 3600_000).toISOString(), Description: comments || null, ...link } });
      } else {
        const done = kind !== "Task";
        await api("/sobjects/Task", { method: "POST", body: { Subject: subject, TaskSubtype: kind, Status: done ? "Completed" : "Not Started", ActivityDate: done ? new Date().toISOString().slice(0, 10) : due || null, Description: comments || null, ...link } });
      }
      setSubject(""); setComments(""); setDue("");
      onChange();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const upcoming = activities.filter((a) => (a.attributes.type === "Task" && !a.IsClosed) || (a.attributes.type === "Event" && new Date(a.StartDateTime) > new Date()));
  const past = activities.filter((a) => !upcoming.includes(a));

  return (
    <article className="slds-card" aria-label="Activity">
      <div className="slds-tabs_default slds-p-horizontal_medium">
        <ul className="slds-tabs_default__nav" role="tablist"><li className="slds-tabs_default__item slds-is-active" role="presentation"><span className="slds-tabs_default__link" role="tab" aria-selected="true">Activity</span></li></ul>
      </div>
      <div className="slds-card__body slds-card__body_inner">
        {kinds.length > 0 && (
          <form onSubmit={submit} className="slds-m-bottom_medium">
            <div className="slds-button-group slds-m-bottom_x-small crm-activity-types" role="radiogroup" aria-label="Activity type">
              {kinds.map((k) => (
                <button type="button" key={k} role="radio" aria-checked={kind === k} className={`slds-button ${kind === k ? "slds-button_brand" : "slds-button_neutral"}`} onClick={() => setKind(k)}>
                  {{ Call: "Log a Call", Task: "New Task", Event: "New Event", Email: "Email" }[k]}
                </button>
              ))}
            </div>
            <div className="slds-form-element slds-m-bottom_x-small">
              <label className="slds-assistive-text" htmlFor="act-subject">Subject</label>
              <input id="act-subject" className="slds-input" placeholder="Subject" required value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            {(kind === "Task" || kind === "Event") && (
              <div className="slds-form-element slds-m-bottom_x-small">
                <label className="slds-form-element__label" htmlFor="act-due">{kind === "Task" ? "Due Date" : "Start"}</label>
                <input id="act-due" className="slds-input" type={kind === "Task" ? "date" : "datetime-local"} value={due} onChange={(e) => setDue(e.target.value)} />
              </div>
            )}
            <div className="slds-form-element slds-m-bottom_x-small">
              <label className="slds-assistive-text" htmlFor="act-body">Comments</label>
              <textarea id="act-body" className="slds-textarea" rows={2} placeholder="Comments" value={comments} onChange={(e) => setComments(e.target.value)} />
            </div>
            {error && <ErrorAlert message={error} />}
            <div className="slds-text-align_right"><button className="slds-button slds-button_brand">Save</button></div>
          </form>
        )}
        <h3 className="slds-section__title slds-theme_shade slds-p-horizontal_small slds-m-bottom_x-small">Upcoming &amp; Overdue</h3>
        {upcoming.length === 0 ? <p className="slds-text-color_weak slds-p-around_small slds-text-align_center">No next steps. To get things moving, add a task or set up a meeting.</p>
          : <ul className="slds-timeline">{upcoming.map((a) => <TimelineItem key={a.Id} a={a} names={names} />)}</ul>}
        <h3 className="slds-section__title slds-theme_shade slds-p-horizontal_small slds-m-vertical_x-small">Past Activity</h3>
        {past.length === 0 ? <p className="slds-text-color_weak slds-p-around_small slds-text-align_center">No past activity. Past meetings and tasks marked as done show up here.</p>
          : <ul className="slds-timeline">{past.map((a) => <TimelineItem key={a.Id} a={a} names={names} />)}</ul>}
      </div>
    </article>
  );
}

function TimelineItem({ a, names }: { a: SRecord; names: Names }) {
  const kind = a.attributes.type === "Event" ? "Event" : (a.TaskSubtype as string) || "Task";
  const s = TIMELINE[kind] ?? TIMELINE.Task!;
  const date = a.attributes.type === "Event" ? formatValue({ type: "datetime" }, a.StartDateTime) : a.ActivityDate ? formatValue({ type: "date" }, a.ActivityDate) : "No due date";
  const who = a.WhoId && names[a.WhoId]?.name;
  return (
    <li>
      <div className={`slds-timeline__item_expandable ${s.cls}`}>
        <div className="slds-media">
          <div className="slds-media__figure"><ObjectIcon object={s.icon} size="small" className="slds-timeline__icon" /></div>
          <div className="slds-media__body">
            <div className="slds-grid slds-grid_align-spread slds-timeline__trigger">
              <h3 className="slds-truncate"><Link to={recordUrl(a.attributes.type, a.Id)}><strong>{a.Subject}</strong></Link></h3>
              <p className="slds-timeline__date">{date}</p>
            </div>
            <p className="slds-text-body_small slds-text-color_weak">{s.label}{who ? ` with ${who}` : ""}</p>
            {a.Description && <p className="slds-m-top_xx-small slds-text-body_small">{a.Description}</p>}
          </div>
        </div>
      </div>
    </li>
  );
}

/** Convert Lead dialog: creates Account (or uses an existing one), Contact and optionally an Opportunity. */
function ConvertLead({ lead, onClose, onDone }: { lead: SRecord; onClose: () => void; onDone: (accountId: string) => void }) {
  const [createOpportunity, setCreateOpportunity] = useState(true);
  const [opportunityName, setOpportunityName] = useState(`${lead.Company}-`);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ accountId: string }>("/actions/convertLead", { method: "POST", body: { leadId: lead.Id, createOpportunity, opportunityName } });
      onDone(r.accountId);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };
  return (
    <>
      <section role="dialog" tabIndex={-1} aria-modal="true" aria-labelledby="convert-title" className="slds-modal slds-fade-in-open">
        <form className="slds-modal__container" onSubmit={submit}>
          <div className="slds-modal__header"><h1 id="convert-title" className="slds-modal__title">Convert Lead</h1></div>
          <div className="slds-modal__content slds-p-around_medium">
            {error && <ErrorAlert message={error} />}
            <p className="slds-m-bottom_small">Creates the Account <strong>{lead.Company}</strong> and the Contact <strong>{lead.Name}</strong>. Open activities move to the new contact.</p>
            <div className="slds-checkbox slds-m-bottom_small">
              <input type="checkbox" id="cv-opp" checked={createOpportunity} onChange={(e) => setCreateOpportunity(e.target.checked)} />
              <label className="slds-checkbox__label" htmlFor="cv-opp"><span className="slds-checkbox_faux" /><span className="slds-form-element__label">Create a new opportunity</span></label>
            </div>
            {createOpportunity && (
              <div className="slds-form-element">
                <label className="slds-form-element__label" htmlFor="cv-name">Opportunity Name</label>
                <input id="cv-name" className="slds-input" value={opportunityName} onChange={(e) => setOpportunityName(e.target.value)} />
              </div>
            )}
          </div>
          <div className="slds-modal__footer">
            <button type="button" className="slds-button slds-button_neutral" onClick={onClose}>Cancel</button>
            <button className="slds-button slds-button_brand" disabled={busy}>{busy ? "Converting…" : "Convert"}</button>
          </div>
        </form>
      </section>
      <div className="slds-backdrop slds-backdrop_open" role="presentation" />
    </>
  );
}
