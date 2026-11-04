import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatValue } from "../api";
import { useMeta } from "../App";
import { ObjectIcon, ErrorAlert } from "../Icon";
import homeSprite from "@salesforce-ux/design-system/assets/icons/standard-sprite/svg/symbols.svg?url";

interface Summary {
  pipeline?: { stage: string; count: number; amount: number }[];
  byMonth?: { month: string; amount: number }[];
  leadsByStatus?: { status: string; count: number }[];
  casesByStatus?: { status: string; count: number }[];
  myOpenTasks?: { id: string; subject: string; due_date: string | null }[];
}

const money = (n: number) => formatValue({ name: "", label: "", type: "currency" }, n);

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
  useEffect(() => { api<Summary>("/reports/summary").then(setS).catch((e) => setError(e.message)); }, []);

  if (error) return <ErrorAlert message={error} />;

  const open = (s?.pipeline?.filter((p) => !meta.closedStages.includes(p.stage)) ?? [])
    .sort((a, b) => meta.stages.indexOf(a.stage) - meta.stages.indexOf(b.stage));
  const won = s?.pipeline?.find((p) => p.stage === meta.closedStages[0]);
  const lost = s?.pipeline?.find((p) => p.stage === meta.closedStages[1]);
  const winRate = won || lost ? Math.round(((won?.count ?? 0) / ((won?.count ?? 0) + (lost?.count ?? 0))) * 100) : null;
  const maxStage = Math.max(1, ...open.map((p) => p.amount));
  const kpis: [string, string | null][] = [
    ["Open Pipeline", s ? money(open.reduce((a, p) => a + p.amount, 0)) : null],
    ["Closed Won", s ? money(won?.amount ?? 0) : null],
    ["Win Rate", s ? (winRate === null ? "—" : `${winRate}%`) : null],
    ["Open Leads", s ? String(s.leadsByStatus?.filter((l) => !["Qualified", "Unqualified"].includes(l.status)).reduce((a, l) => a + l.count, 0) ?? 0) : null],
  ];

  return (
    <div className="crm-home">
      <div className="slds-page-header slds-m-bottom_small">
        <div className="slds-page-header__row">
          <div className="slds-page-header__col-title">
            <div className="slds-media">
              <div className="slds-media__figure">
                <span className="slds-icon_container slds-icon-standard-home"><svg className="slds-icon slds-icon_medium" aria-hidden="true"><use href={`${homeSprite}#home`} /></svg></span>
              </div>
              <div className="slds-media__body">
                <div className="slds-page-header__name"><div className="slds-page-header__name-title"><h1>
                  <span>Home</span>
                  <span className="slds-page-header__title slds-truncate">Welcome, {meta.user.name.split(" ")[0]}</span>
                </h1></div></div>
              </div>
            </div>
          </div>
        </div>
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
          <Card title="Pipeline by Stage" icon="opportunities" footer={<Link to="/pipeline">View Pipeline</Link>}>
            {!s ? <Loading /> : open.length === 0 ? <Empty text="No open opportunities." /> : (
              <ul className="crm-bars">
                {open.map((p) => (
                  <li key={p.stage}>
                    <span className="crm-bars__label slds-truncate">{p.stage} <span className="slds-text-color_weak">({p.count})</span></span>
                    <span className="crm-bars__track"><span className="crm-bars__bar" style={{ width: `${(p.amount / maxStage) * 100}%` }} /></span>
                    <span className="crm-bars__value">{money(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="slds-col slds-size_1-of-1 slds-large-size_4-of-12 slds-m-bottom_x-small">
          <Card title="Today's Tasks" icon="tasks" footer={<Link to="/o/tasks?scope=mine">View All</Link>}>
            {!s ? <Loading /> : !s.myOpenTasks?.length ? <Empty text="Nothing due today. Be a go-getter and check back soon." /> : (
              <ul className="slds-has-dividers_bottom-space">
                {s.myOpenTasks.map((t) => (
                  <li key={t.id} className="slds-item">
                    <Link to={`/o/tasks/${t.id}`}>{t.subject}</Link>
                    <p className="slds-text-body_small slds-text-color_weak">{t.due_date ?? "No due date"}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_x-small">
          <Card title="Leads by Status" icon="leads" footer={<Link to="/o/leads">View All</Link>}>
            <Counts rows={s?.leadsByStatus?.map((l) => [l.status, l.count])} />
          </Card>
        </div>
        <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_x-small">
          <Card title="Cases by Status" icon="cases" footer={<Link to="/o/cases">View All</Link>}>
            <Counts rows={s?.casesByStatus?.map((l) => [l.status, l.count])} />
          </Card>
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
          <p className="slds-text-title slds-truncate">{k}</p>
          <p className="slds-text-heading_medium">{v}</p>
        </li>
      ))}
    </ul>
  );
}

