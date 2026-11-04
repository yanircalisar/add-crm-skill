import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatValue } from "../api";
import { useMeta } from "../App";

interface Summary {
  pipeline?: { stage: string; count: number; amount: number }[];
  byMonth?: { month: string; amount: number }[];
  leadsByStatus?: { status: string; count: number }[];
  casesByStatus?: { status: string; count: number }[];
  myOpenTasks?: { id: string; subject: string; due_date: string | null }[];
}

const money = (n: number) => formatValue({ name: "", label: "", type: "currency" }, n);

export function Home() {
  const meta = useMeta();
  const [s, setS] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api<Summary>("/reports/summary").then(setS).catch((e) => setError(e.message)); }, []);

  if (error) return <div className="card"><p className="error" role="alert">{error}</p></div>;

  const open = s?.pipeline?.filter((p) => !meta.closedStages.includes(p.stage)) ?? [];
  const won = s?.pipeline?.find((p) => p.stage === "Closed Won");
  const lost = s?.pipeline?.find((p) => p.stage === "Closed Lost");
  const winRate = won || lost ? Math.round(((won?.count ?? 0) / ((won?.count ?? 0) + (lost?.count ?? 0))) * 100) : null;
  const maxStage = Math.max(1, ...open.map((p) => p.amount));

  return (
    <div className="home">
      <h1 className="page-title">Welcome, {meta.user.name.split(" ")[0]}</h1>
      <div className="kpis">
        <Kpi label="Open pipeline" value={s ? money(open.reduce((a, p) => a + p.amount, 0)) : null} />
        <Kpi label="Closed won" value={s ? money(won?.amount ?? 0) : null} />
        <Kpi label="Win rate" value={s ? (winRate === null ? "—" : `${winRate}%`) : null} />
        <Kpi label="Open leads" value={s ? String(s.leadsByStatus?.filter((l) => !["Qualified", "Unqualified"].includes(l.status)).reduce((a, l) => a + l.count, 0) ?? 0) : null} />
      </div>
      <div className="dash-grid">
        <section className="card">
          <h2>Pipeline by stage</h2>
          {!s ? <span className="skeleton" /> : open.length === 0 ? <p className="empty">No open opportunities.</p> : (
            <ul className="bars">
              {open.map((p) => (
                <li key={p.stage}>
                  <span className="bar-label">{p.stage} <span className="muted small">({p.count})</span></span>
                  <span className="bar-track"><span className="bar" style={{ width: `${(p.amount / maxStage) * 100}%` }} /></span>
                  <span className="bar-value">{money(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <h2>My open tasks</h2>
          {!s ? <span className="skeleton" /> : !s.myOpenTasks?.length ? <p className="empty">You're all caught up.</p> : (
            <ul className="timeline">{s.myOpenTasks.map((t) => (
              <li key={t.id}><Link to={`/o/tasks/${t.id}`}>{t.subject}</Link><span className="muted small">{t.due_date ?? "No due date"}</span></li>
            ))}</ul>
          )}
        </section>
        <section className="card">
          <h2>Leads by status</h2>
          <CountList rows={s?.leadsByStatus?.map((l) => [l.status, l.count])} />
        </section>
        <section className="card">
          <h2>Cases by status</h2>
          <CountList rows={s?.casesByStatus?.map((l) => [l.status, l.count])} />
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="card kpi">
      <p className="muted small">{label}</p>
      <p className="kpi-value">{value ?? <span className="skeleton" />}</p>
    </div>
  );
}

function CountList({ rows }: { rows?: [string, number][] }) {
  if (!rows) return <span className="skeleton" />;
  if (!rows.length) return <p className="empty">Nothing here yet.</p>;
  return <dl className="counts">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}
