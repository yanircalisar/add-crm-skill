import { createContext, useContext, useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { api, ApiError, type Meta } from "./api";
import { Login, AcceptInvite } from "./pages/Auth";
import { Home } from "./pages/Home";
import { ListView } from "./pages/ListView";
import { RecordPage } from "./pages/RecordPage";
import { Pipeline } from "./pages/Pipeline";
import { Setup } from "./pages/Setup";

const MetaContext = createContext<Meta | null>(null);
export const useMeta = () => useContext(MetaContext)!;

const NAV = ["leads", "accounts", "contacts", "opportunities", "cases", "tasks"];

export function App() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [state, setState] = useState<"loading" | "anon" | "ready" | "error">("loading");
  const location = useLocation();

  const load = () => {
    setState("loading");
    api<Meta>("/meta")
      .then((m) => {
        setMeta(m);
        setState("ready");
        document.documentElement.style.setProperty("--brand", m.crm.brandColor || "#0b5cab");
        document.title = m.crm.name || "CRM";
      })
      .catch((e) => setState(e instanceof ApiError && e.status === 401 ? "anon" : "error"));
  };
  useEffect(load, []);

  if (location.pathname.startsWith("/invite/")) return <AcceptInvite onDone={load} />;
  if (state === "loading") return <div className="center" role="status" aria-live="polite">Loading…</div>;
  if (state === "error") return <div className="center"><p>Couldn't load the CRM.</p><button className="btn" onClick={load}>Retry</button></div>;
  if (state === "anon" || !meta) return <Login onDone={load} />;

  return (
    <MetaContext.Provider value={meta}>
      <Shell onLogout={() => { setMeta(null); setState("anon"); }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/o/:object" element={<ListView />} />
          <Route path="/o/:object/:id" element={<RecordPage />} />
          <Route path="*" element={<div className="card empty">Page not found.</div>} />
        </Routes>
      </Shell>
    </MetaContext.Provider>
  );
}

function Shell({ children, onLogout }: { children: React.ReactNode; onLogout: () => void }) {
  const meta = useMeta();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const logout = async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    onLogout();
  };

  return (
    <div className="app">
      <a href="#main" className="skip">Skip to content</a>
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" aria-hidden="true" />
          <span>{meta.crm.name}</span>
        </div>
        <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) navigate(`/o/accounts?q=${encodeURIComponent(q.trim())}`); }}>
          <label htmlFor="global-search" className="sr-only">Search</label>
          <input id="global-search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <div className="user">
          <span className="avatar" aria-hidden="true">{meta.user.name.slice(0, 1).toUpperCase()}</span>
          <span className="user-name">{meta.user.name}</span>
          <button className="btn btn-ghost" onClick={logout}>Log out</button>
        </div>
      </header>
      <nav className="tabs" aria-label="Objects">
        <button className="menu-toggle btn btn-ghost" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>Menu</button>
        <ul className={menuOpen ? "open" : ""} onClick={() => setMenuOpen(false)}>
          <li><NavLink to="/" end>Home</NavLink></li>
          {NAV.filter((o) => meta.objects[o]).map((o) => (
            <li key={o}><NavLink to={`/o/${o}`}>{meta.objects[o].plural}</NavLink></li>
          ))}
          {meta.objects.opportunities && <li><NavLink to="/pipeline">Pipeline</NavLink></li>}
          {meta.user.role_id === "admin" && <li><NavLink to="/setup">Setup</NavLink></li>}
        </ul>
      </nav>
      <main id="main" className="content">{children}</main>
    </div>
  );
}
