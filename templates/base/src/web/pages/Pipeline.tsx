import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatValue, recordUrl, type Names, type SRecord } from "../api";
import { useMeta, canDo } from "../App";
import { ObjectIcon, ErrorAlert } from "../Icon";

const money = (n: number) => formatValue({ type: "currency" }, n);

/** Opportunity Kanban (list view display mode). Drag a card to another stage, or use its stage menu. */
export function Pipeline() {
  const meta = useMeta();
  const [data, setData] = useState<{ records: SRecord[]; names: Names } | null>(null);
  const [error, setError] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const canEdit = canDo(meta, "Opportunity", "updateable");

  const load = () => api("/sobjects/Opportunity?limit=200&sort=CloseDate&dir=asc").then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const move = async (id: string, StageName: string) => {
    setData((d) => d && { ...d, records: d.records.map((r) => (r.Id === id ? { ...r, StageName } : r)) });
    await api(`/sobjects/Opportunity/${id}`, { method: "PATCH", body: { StageName } }).catch((e) => { setError(e.message); load(); });
  };
  const rows = data?.records;
  const total = rows?.reduce((a, r) => a + (r.Amount ?? 0), 0) ?? 0;

  return (
    <div className="crm-pipeline">
      <div className="slds-page-header slds-page-header_object-home slds-m-bottom_small">
        <div className="slds-page-header__row"><div className="slds-page-header__col-title"><div className="slds-media">
          <div className="slds-media__figure"><ObjectIcon object="Opportunity" size="medium" /></div>
          <div className="slds-media__body"><div className="slds-page-header__name"><div className="slds-page-header__name-title"><h1>
            <span>Opportunities</span>
            <span className="slds-page-header__title slds-truncate">All Opportunities</span>
          </h1></div></div></div>
        </div></div></div>
        <div className="slds-page-header__row"><div className="slds-page-header__col-meta">
          <p className="slds-page-header__meta-text">{rows ? `${rows.length} items • ${money(total)} • Grouped by Stage` : "Loading…"}</p>
        </div></div>
      </div>
      {error && <ErrorAlert message={error} />}
      <div className="crm-kanban">
        {meta.stages.map((stage) => {
          const cards = rows?.filter((r) => r.StageName === stage.name) ?? [];
          return (
            <section key={stage.name} className={`crm-kanban__col ${over === stage.name ? "crm-kanban__col_over" : ""}`} aria-label={stage.name}
              onDragOver={(e) => { if (canEdit) { e.preventDefault(); setOver(stage.name); } }}
              onDragLeave={() => setOver(null)}
              onDrop={() => { if (dragId) move(dragId, stage.name); setDragId(null); setOver(null); }}>
              <header className={`crm-kanban__header ${stage.isClosed ? (stage.isWon ? "crm-kanban__header_won" : "crm-kanban__header_lost") : ""}`}>
                <h2 className="slds-text-heading_small slds-truncate" title={stage.name}>{stage.name} ({cards.length})</h2>
                <p className="slds-text-body_small slds-text-color_weak">{money(cards.reduce((a, c) => a + (c.Amount ?? 0), 0))}</p>
              </header>
              <div className="crm-kanban__body">
                {!rows && <span className="crm-skeleton" />}
                {cards.map((c) => (
                  <article key={c.Id} className="slds-card crm-kanban__card" draggable={canEdit} onDragStart={() => setDragId(c.Id)}>
                    <div className="slds-p-around_small">
                      <Link className="slds-text-link" to={recordUrl("Opportunity", c.Id)}>{c.Name}</Link>
                      <dl className="slds-list_horizontal slds-wrap slds-text-body_small slds-m-top_xx-small">
                        <dt className="slds-item_label slds-text-color_weak">Account:</dt>
                        <dd className="slds-item_detail slds-truncate">{c.AccountId ? data!.names[c.AccountId]?.name ?? "—" : "—"}</dd>
                        <dt className="slds-item_label slds-text-color_weak">Amount:</dt>
                        <dd className="slds-item_detail">{money(c.Amount ?? 0)}</dd>
                        <dt className="slds-item_label slds-text-color_weak">Close Date:</dt>
                        <dd className="slds-item_detail">{formatValue({ type: "date" }, c.CloseDate) || "—"}</dd>
                      </dl>
                      {canEdit && (
                        <div className="slds-select_container slds-m-top_x-small">
                          <label className="slds-assistive-text" htmlFor={`stage-${c.Id}`}>Stage for {c.Name}</label>
                          <select id={`stage-${c.Id}`} className="slds-select" value={c.StageName} onChange={(e) => move(c.Id, e.target.value)}>
                            {meta.stages.map((s) => <option key={s.name}>{s.name}</option>)}
                          </select>
                        </div>
                      )}
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
