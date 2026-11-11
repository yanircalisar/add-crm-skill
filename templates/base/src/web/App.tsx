import { createContext, useContext, useEffect, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { api, ApiError, listUrl, type Meta } from "./api";
import { ObjectIcon, UtilityIcon, Spinner } from "./Icon";
import { Login, AcceptInvite } from "./pages/Auth";
import { Home } from "./pages/Home";
import { ListView } from "./pages/ListView";
import { RecordPage } from "./pages/RecordPage";
import { Pipeline } from "./pages/Pipeline";
import { Setup } from "./pages/Setup";
import { Search } from "./pages/Search";

const MetaContext = createContext<Meta | null>(null);
export const useMeta = () => useContext(MetaContext)!;
export const canDo = (meta: Meta, type: string, action: "createable" | "updateable" | "deletable") =>
  !!meta.sobjects.find((s) => s.name === type)?.[action];

/** Objects shown as tabs in the navigation bar, in order. */
export const NAV = ["Lead", "Account", "Contact", "Opportunity", "Case", "Task"];

export function App() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [state, setState] = useState<"loading" | "anon" | "ready" | "error">("loading");
  const location = useLocation();

  const load = () => {
    setState("loading");
    api<Meta>("/sobjects")
      .then((m) => {
        setMeta(m);
        setState("ready");
        if (m.crm.brandColor) document.documentElement.style.setProperty("--crm-brand", m.crm.brandColor);
        document.title = m.crm.name || "CRM";
      })
      .catch((e) => setState(e instanceof ApiError && e.status === 401 ? "anon" : "error"));
  };
  useEffect(load, []);

  if (location.pathname.startsWith("/invite/")) return <AcceptInvite onDone={load} />;
  if (state === "loading") return <div className="crm-fullpage"><Spinner /></div>;
  if (state === "error") {
    return (
      <div className="crm-fullpage">
        <div className="slds-text-align_center">
          <p className="slds-m-bottom_small">Couldn't load the CRM.</p>
          <button className="slds-button slds-button_brand" onClick={load}>Retry</button>
        </div>
      </div>
    );
  }
  if (state === "anon" || !meta) return <Login onDone={load} />;

  return (
    <MetaContext.Provider value={meta}>
      <Shell onLogout={() => { setMeta(null); setState("anon"); }}>
        <Routes>
          <Route path="/" element={<Navigate to="/lightning/page/home" replace />} />
          <Route path="/lightning/page/home" element={<Home />} />
          <Route path="/lightning/o/Opportunity/kanban" element={<Pipeline />} />
          <Route path="/lightning/o/:type/list" element={<ListView />} />
          <Route path="/lightning/r/:type/:id/view" element={<RecordPage />} />
          <Route path="/lightning/r/:id" element={<RecordPage />} />
          <Route path="/lightning/setup/:page" element={<Setup />} />
          <Route path="/lightning/search" element={<Search />} />
          <Route path="*" element={<article className="slds-card"><div className="slds-card__body slds-card__body_inner">Page not found.</div></article>} />
        </Routes>
      </Shell>
    </MetaContext.Provider>
  );
}

function Shell({ children, onLogout }: { children: React.ReactNode; onLogout: () => void }) {
  const meta = useMeta();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [launcher, setLauncher] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const readable = (t: string) => meta.sobjects.some((s) => s.name === t);

  const logout = async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    onLogout();
  };

  return (
    <div className="crm-app">
      <a href="#main" className="slds-assistive-text slds-assistive-text_focus crm-skip">Skip to content</a>
      <header className="slds-global-header_container">
        <div className="slds-global-header slds-grid slds-grid_align-spread">
          <div className="slds-global-header__item">
            <Link to="/lightning/page/home" className="crm-logo" aria-label={`${meta.crm.name} home`}>{meta.crm.name.slice(0, 1).toUpperCase()}</Link>
          </div>
          <div className="slds-global-header__item slds-global-header__item_search">
            <form role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) navigate(`/lightning/search?q=${encodeURIComponent(q.trim())}`); }}>
              <div className="slds-form-element">
                <label className="slds-assistive-text" htmlFor="global-search">Search</label>
                <div className="slds-form-element__control slds-input-has-icon slds-input-has-icon_left">
                  <UtilityIcon name="search" className="slds-icon slds-input__icon slds-input__icon_left slds-icon-text-default" />
                  <input id="global-search" type="search" className="slds-input" placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
              </div>
            </form>
          </div>
          <div className="slds-global-header__item">
            <div className={`slds-dropdown-trigger slds-dropdown-trigger_click ${userMenu ? "slds-is-open" : ""}`}>
              <button className="slds-button slds-global-actions__avatar" aria-haspopup="true" aria-expanded={userMenu} onClick={() => setUserMenu(!userMenu)} title={meta.user.Name}>
                <span className="slds-avatar slds-avatar_circle slds-avatar_medium">
                  <abbr className="slds-avatar__initials crm-avatar" title={meta.user.Name}>{initials(meta.user.Name)}</abbr>
                </span>
              </button>
              {userMenu && (
                <div className="slds-dropdown slds-dropdown_right crm-user-menu">
                  <div className="slds-p-around_small slds-border_bottom">
                    <p className="slds-text-heading_small">{meta.user.Name}</p>
                    <p className="slds-text-body_small slds-text-color_weak">{meta.user.Email}</p>
                    <p className="slds-text-body_small slds-text-color_weak">{meta.user.ProfileName}</p>
                  </div>
                  <ul className="slds-dropdown__list" role="menu">
                    <li className="slds-dropdown__item" role="presentation">
                      <a href="#" role="menuitem" onClick={(e) => { e.preventDefault(); logout(); }}><span className="slds-truncate">Log Out</span></a>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="slds-context-bar crm-context-bar">
        <div className="slds-context-bar__primary">
          <div className="slds-context-bar__item slds-context-bar__dropdown-trigger slds-dropdown-trigger slds-dropdown-trigger_click slds-no-hover">
            <div className="slds-context-bar__icon-action">
              <button className="slds-button slds-icon-waffle_container slds-context-bar__button" title="App Launcher" onClick={() => setLauncher(true)}>
                <span className="slds-icon-waffle">
                  {Array.from({ length: 9 }).map((_, i) => <span key={i} className={`slds-r${i + 1}`} />)}
                </span>
                <span className="slds-assistive-text">Open App Launcher</span>
              </button>
            </div>
            <span className="slds-context-bar__label-action slds-context-bar__app-name">
              <span className="slds-truncate" title={meta.crm.name}>{meta.crm.name}</span>
            </span>
          </div>
          <button className="slds-button slds-button_icon slds-button_icon-container crm-mobile-nav-toggle" aria-expanded={mobileNav} onClick={() => setMobileNav(!mobileNav)} title="Menu">
            <UtilityIcon name="rows" label="Menu" />
          </button>
        </div>
        <nav className={`slds-context-bar__secondary ${mobileNav ? "crm-nav-open" : ""}`} role="navigation" onClick={() => setMobileNav(false)}>
          <ul className="slds-grid">
            <NavItem to="/lightning/page/home" label="Home" match="/lightning/page/home" />
            {NAV.filter(readable).map((t) => (
              <NavItem key={t} to={listUrl(t)} label={meta.sobjects.find((s) => s.name === t)!.labelPlural} match={`/lightning/(o|r)/${t}/`} />
            ))}
            {readable("Opportunity") && <NavItem to="/lightning/o/Opportunity/kanban" label="Pipeline" match="/lightning/o/Opportunity/kanban" />}
            {meta.user.PermissionsManageUsers ? <NavItem to="/lightning/setup/ManageUsers" label="Setup" match="/lightning/setup/" /> : null}
          </ul>
        </nav>
      </div>

      <main id="main" className="crm-content">{children}</main>
      {launcher && <AppLauncher onClose={() => setLauncher(false)} />}
    </div>
  );
}

function NavItem({ to, label, match }: { to: string; label: string; match: string }) {
  const { pathname } = useLocation();
  const active = new RegExp(`^${match}`).test(pathname) && !(match.includes("(o|r)/Opportunity") && pathname.endsWith("/kanban"));
  return (
    <li className={`slds-context-bar__item ${active ? "slds-is-active" : ""}`}>
      <NavLink to={to} className="slds-context-bar__label-action" title={label}>
        {active && <span className="slds-assistive-text">Current Page:</span>}
        <span className="slds-truncate">{label}</span>
      </NavLink>
    </li>
  );
}

/** App Launcher: lists every object the user can read (and, later, other CRMs via the Master CRM). */
function AppLauncher({ onClose }: { onClose: () => void }) {
  const meta = useMeta();
  const [filter, setFilter] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const items = meta.sobjects.filter((s) => s.labelPlural.toLowerCase().includes(filter.toLowerCase()));
  return (
    <>
      <section role="dialog" tabIndex={-1} aria-modal="true" aria-labelledby="launcher-title" className="slds-modal slds-fade-in-open slds-modal_large slds-app-launcher">
        <div className="slds-modal__container">
          <button className="slds-button slds-button_icon slds-modal__close slds-button_icon-inverse" onClick={onClose} title="Close">
            <UtilityIcon name="close" className="slds-button__icon slds-button__icon_large" label="Close" />
          </button>
          <div className="slds-modal__header slds-grid slds-grid_align-spread slds-grid_vertical-align-center">
            <h2 id="launcher-title" className="slds-text-heading_medium">App Launcher</h2>
            <div className="slds-app-launcher__header-search">
              <div className="slds-form-element__control slds-input-has-icon slds-input-has-icon_left">
                <UtilityIcon name="search" className="slds-icon slds-input__icon slds-input__icon_left slds-icon-text-default" />
                <label className="slds-assistive-text" htmlFor="launcher-search">Find an item</label>
                <input id="launcher-search" autoFocus className="slds-input" placeholder="Search items..." value={filter} onChange={(e) => setFilter(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="slds-modal__content slds-app-launcher__content slds-p-around_medium">
            <h3 className="slds-text-heading_small slds-m-bottom_small">All Items</h3>
            <ul className="slds-grid slds-grid_pull-padded slds-wrap">
              {items.map((s) => (
                <li key={s.name} className="slds-p-horizontal_small slds-size_1-of-2 slds-medium-size_1-of-4 slds-m-bottom_small">
                  <Link to={listUrl(s.name)} onClick={onClose} className="crm-launcher-item">
                    <ObjectIcon object={s.name} />
                    <span className="slds-m-left_small">{s.labelPlural}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <div className="slds-backdrop slds-backdrop_open" role="presentation" onClick={onClose} />
    </>
  );
}

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
