import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatValue, listUrl, recordUrl } from "../api";
import { useMeta } from "../App";
import { ObjectIcon, ErrorAlert } from "../Icon";

interface Summary {
  pipeline?: { StageName: string; count: number; amount: number }[];
  leadsByStatus?: { Status: string; count: number }[];
  casesByStatus?: { Status: string; count: number }[];
  myOpenTasks?: { Id: string; Subject: string; ActivityDate: string | null; Priority: string | null }[];
}

const money = (n: number) => formatValue({ type: "currency" }, n);

function Card({ title, icon, children, footer }: { title: string; icon?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <article className="slds-card crm-home-card">
      <div className="slds-card__header slds-grid">
        <header className="slds-media slds-media_center slds-has-flexi-truncate">
          {icon && <div className="slds-media__figure"><ObjectIcon object={icon} size="small" /></div>}
          <div className="slds-media__body"><h2 className="slds-card__header-title"><span className="slds-truncate">{title}</span></h2></div>
        </header>
      </div>
      <div className="slds-card__body slds-card__body_inner">{children}</div>
      {footer && <footer className="slds-card__footer">{footer}</footer>}
    </article>
  );
}

const Loading = () => <span className="crm-skeleton" />;
const Empty = ({ text }: { text: string }) => <p className="slds-text-color_weak slds-text-align_center slds-p-vertical_medium">{text}</p>;

export function Home() {
  const meta = useMeta();
  const [s, setS] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api<Summary>("/ui-api/home").then(setS).catch((e) => setError(e.message)); }, []);
  if (error) return <ErrorAlert message={error} />;

  const stage = (n: string) => meta.stages.find((x) => x.name === n);
  const open = (s?.pipeline ?? []).filter((p) => !stage(p.StageName)?.isClosed)
    .sort((a, b) => meta.stages.findIndex((x) => x.name === a.StageName) - meta.stages.findIndex((x) => x.name === b.StageName));
  const won = (s?.pipeline ?? []).filter((p) => stage(p.StageName)?.isWon);
  const lost = (s?.pipeline ?? []).filter((p) => stage(p.StageName)?.isClosed && !stage(p.StageName)?.isWon);
  const sum = (rows: { amount: number }[]) => rows.reduce((a, p) => a + p.amount, 0);
  const cnt = (rows: { count: number }[]) => rows.reduce((a, p) => a + p.count, 0);
  const winRate = cnt(won) + cnt(lost) ? Math.round((cnt(won) / (cnt(won) + cnt(lost))) * 100) : null;
  const maxStage = Math.max(1, ...open.map((p) => p.amount));
  const kpis: [string, string | null][] = [
    ["Open Pipeline", s ? money(sum(open)) : null],
    ["Closed Won", s ? money(sum(won)) : null],
    ["Win Rate", s ? (winRate === null ? "—" : `${winRate}%`) : null],
    ["Open Leads", s ? String(cnt((s.leadsByStatus ?? []).filter((l) => !l.Status.startsWith("Closed")))) : null],
  ];

  return (
    <div className="crm-home">
      <div className="slds-page-header slds-m-bottom_small">
        <div className="slds-page-header__row"><div className="slds-page-header__col-title"><div className="slds-media">
          <div className="slds-media__figure"><ObjectIcon object="Home" size="medium" /></div>
          <div className="slds-media__body"><div className="slds-page-header__name"><div className="slds-page-header__name-title"><h1>
            <span>Home</span>
            <span className="slds-page-header__title slds-truncate">Welcome, {meta.user.Name.split(" ")[0]}</span>
          </h1></div></div></div>
        </div></div></div>
      </div>

      <div className="slds-grid slds-wrap slds-gutters_x-small">
        {kpis.map(([label, value]) => (
          <div key={label} className="slds-col slds-size_1-of-2 slds-large-size_1-of-4 slds-m-bottom_x-small">
            <article className="slds-card slds-p-around_medium crm-kpi">
              <p className="slds-text-title_caps slds-text-color_weak">{label}</p>
              <p className="slds-text-heading_large crm-kpi__value">{value ?? <Loading />}</p>
            </article>
          </div>
        ))}
      </div>

      <div className="slds-grid slds-wrap slds-gutters_x-small">
        <div className="slds-col slds-size_1-of-1 slds-large-size_8-of-12 slds-m-bottom_x-small">
          <Card title="Pipeline by Stage" icon="Opportunity" footer={<Link to="/lightning/o/Opportunity/kanban">View Pipeline</Link>}>
            {!s ? <Loading /> : open.length === 0 ? <Empty text="No open opportunities." /> : (
              <ul className="crm-bars">
                {open.map((p) => (
                  <li key={p.StageName}>
                    <span className="crm-bars__label slds-truncate">{p.StageName} <span className="slds-text-color_weak">({p.count})</span></span>
                    <span className="crm-bars__track"><span className="crm-bars__bar" style={{ width: `${(p.amount / maxStage) * 100}%` }} /></span>
                    <span className="crm-bars__value">{money(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="slds-col slds-size_1-of-1 slds-large-size_4-of-12 slds-m-bottom_x-small">
          <Card title="My Open Tasks" icon="Task" footer={<Link to={`${listUrl("Task")}?filterName=mine`}>View All</Link>}>
            {!s ? <Loading /> : !s.myOpenTasks?.length ? <Empty text="Nothing due. Be a go-getter and check back soon." /> : (
              <ul className="slds-has-dividers_bottom-space">
                {s.myOpenTasks.map((t) => (
                  <li key={t.Id} className="slds-item">
                    <Link to={recordUrl("Task", t.Id)}>{t.Subject}</Link>
                    <p className="slds-text-body_small slds-text-color_weak">{t.ActivityDate ? formatValue({ type: "date" }, t.ActivityDate) : "No due date"}{t.Priority === "High" ? " · High priority" : ""}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_x-small">
          <Card title="Leads by Status" icon="Lead" footer={<Link to={listUrl("Lead")}>View All</Link>}><Counts rows={s?.leadsByStatus?.map((l) => [l.Status, l.count])} /></Card>
        </div>
        <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_x-small">
          <Card title="Cases by Status" icon="Case" footer={<Link to={listUrl("Case")}>View All</Link>}><Counts rows={s?.casesByStatus?.map((l) => [l.Status, l.count])} /></Card>
        </div>
      </div>
    </div>
  );
}

function Counts({ rows }: { rows?: [string, number][] }) {
  if (!rows) return <Loading />;
  if (!rows.length) return <Empty text="Nothing here yet." />;
  return (
    <ul className="slds-grid slds-wrap">
      {rows.map(([k, v]) => (
        <li key={k} className="slds-size_1-of-2 slds-medium-size_1-of-3 slds-p-around_x-small">
          <p className="slds-text-title slds-truncate" title={k}>{k}</p>
          <p className="slds-text-heading_medium">{v}</p>
        </li>
      ))}
    </ul>
  );
}
