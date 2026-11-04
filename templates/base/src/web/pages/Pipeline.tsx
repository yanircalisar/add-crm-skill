import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatValue } from "../api";
import { useMeta } from "../App";
import { ObjectIcon, ErrorAlert } from "../Icon";

const money = (n: number) => formatValue({ name: "", label: "", type: "currency" }, n);

/** Opportunity Kanban view. Drag a card to another column, or use its stage menu (keyboard friendly). */
export function Pipeline() {
  const meta = useMeta();
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const canEdit = meta.permissions.find((p) => p.object === "opportunities")?.can_edit;

  const load = () => api<{ records: any[] }>("/o/opportunities?limit=100&sort=close_date&dir=asc").then((r) => setRows(r.records)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const move = async (id: string, stage: string) => {
    setRows((rs) => rs?.map((r) => (r.id === id ? { ...r, stage } : r)) ?? null);
    await api(`/o/opportunities/${id}`, { method: "PATCH", body: { stage } }).catch((e) => { setError(e.message); load(); });
  };

  const total = rows?.reduce((a, r) => a + (r.amount ?? 0), 0) ?? 0;

  return (
    <div className="crm-pipeline">
      <div className="slds-page-header slds-page-header_object-home slds-m-bottom_small">
        <div className="slds-page-header__row">
          <div className="slds-page-header__col-title">
            <div className="slds-media">
              <div className="slds-media__figure"><ObjectIcon object="opportunities" size="medium" /></div>
              <div className="slds-media__body">
                <div className="slds-page-header__name"><div className="slds-page-header__name-title"><h1>
                  <span>Opportunities</span>
                  <span className="slds-page-header__title slds-truncate">All Opportunities — Kanban</span>
                </h1></div></div>
              </div>
            </div>
          </div>
        </div>
        <div className="slds-page-header__row">
          <div className="slds-page-header__col-meta">
            <p className="slds-page-header__meta-text">{rows ? `${rows.length} items • ${money(total)} • Grouped by Stage` : "Loading…"}</p>
          </div>
        </div>
      </div>
      {error && <ErrorAlert message={error} />}
      <div className="crm-kanban">
        {meta.stages.map((stage) => {
          const cards = rows?.filter((r) => r.stage === stage) ?? [];
          return (
            <section key={stage} className={`crm-kanban__col ${over === stage ? "crm-kanban__col_over" : ""}`} aria-label={stage}
              onDragOver={(e) => { if (canEdit) { e.preventDefault(); setOver(stage); } }}
              onDragLeave={() => setOver(null)}
              onDrop={() => { if (dragId) move(dragId, stage); setDragId(null); setOver(null); }}>
              <header className="crm-kanban__header">
                <h2 className="slds-text-heading_small slds-truncate" title={stage}>{stage} ({cards.length})</h2>
                <p className="slds-text-body_small slds-text-color_weak">{money(cards.reduce((a, c) => a + (c.amount ?? 0), 0))}</p>
              </header>
              <div className="crm-kanban__body">
                {!rows && <span className="crm-skeleton" />}
                {cards.map((c) => (
                  <article key={c.id} className="slds-card crm-kanban__card" draggable={!!canEdit} onDragStart={() => setDragId(c.id)}>
                    <div className="slds-p-around_small">
                      <Link className="slds-text-link" to={`/o/opportunities/${c.id}`}>{c.name}</Link>
                      <dl className="slds-list_horizontal slds-wrap slds-text-body_small slds-m-top_xx-small">
                        <dt className="slds-item_label slds-text-color_weak">Amount:</dt>
                        <dd className="slds-item_detail">{money(c.amount ?? 0)}</dd>
                        <dt className="slds-item_label slds-text-color_weak">Close Date:</dt>
                        <dd className="slds-item_detail">{c.close_date ? formatValue({ name: "", label: "", type: "date" }, c.close_date) : "—"}</dd>
                      </dl>
                      {canEdit ? (
                        <div className="slds-select_container slds-m-top_x-small">
                          <label className="slds-assistive-text" htmlFor={`stage-${c.id}`}>Stage for {c.name}</label>
                          <select id={`stage-${c.id}`} className="slds-select" value={c.stage} onChange={(e) => move(c.id, e.target.value)}>
                            {meta.stages.map((s) => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
