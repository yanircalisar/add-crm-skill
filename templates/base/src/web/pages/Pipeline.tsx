import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatValue } from "../api";
import { useMeta } from "../App";

/** Opportunity kanban. Drag a card to another column (or use its stage menu, for keyboard users). */
export function Pipeline() {
  const meta = useMeta();
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const canEdit = meta.permissions.find((p) => p.object === "opportunities")?.can_edit;

  const load = () => api<{ records: any[] }>("/o/opportunities?limit=100&sort=close_date&dir=asc").then((r) => setRows(r.records)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const move = async (id: string, stage: string) => {
    setRows((rs) => rs?.map((r) => (r.id === id ? { ...r, stage } : r)) ?? null);
    await api(`/o/opportunities/${id}`, { method: "PATCH", body: { stage } }).catch((e) => { setError(e.message); load(); });
  };

  const money = (n: number) => formatValue({ name: "", label: "", type: "currency" }, n);

  return (
    <section>
      <h1 className="page-title">Pipeline</h1>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="kanban">
        {meta.stages.map((stage) => {
          const cards = rows?.filter((r) => r.stage === stage) ?? [];
          return (
            <div key={stage} className="kanban-col"
              onDragOver={(e) => canEdit && e.preventDefault()}
              onDrop={() => { if (dragId) move(dragId, stage); setDragId(null); }}>
              <header>
                <h2>{stage}</h2>
                <span className="muted small">{cards.length} · {money(cards.reduce((a, c) => a + (c.amount ?? 0), 0))}</span>
              </header>
              {!rows && <span className="skeleton" />}
              {rows && cards.length === 0 && <p className="empty small">No deals</p>}
              {cards.map((c) => (
                <article key={c.id} className="kanban-card" draggable={!!canEdit} onDragStart={() => setDragId(c.id)}>
                  <Link to={`/o/opportunities/${c.id}`}>{c.name}</Link>
                  <p className="small">{money(c.amount ?? 0)}{c.close_date ? ` · ${formatValue({ name: "", label: "", type: "date" }, c.close_date)}` : ""}</p>
                  {canEdit ? (
                    <>
                      <label className="sr-only" htmlFor={`stage-${c.id}`}>Stage for {c.name}</label>
                      <select id={`stage-${c.id}`} className="small" value={c.stage} onChange={(e) => move(c.id, e.target.value)}>
                        {meta.stages.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </>
                  ) : null}
                </article>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
