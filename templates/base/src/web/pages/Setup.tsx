import { useEffect, useState } from "react";
import { api } from "../api";
import { initials, useMeta } from "../App";
import { ErrorAlert, UtilityIcon } from "../Icon";

interface User { id: string; email: string; name: string; role_id: string; active: number; activated: number }
interface Role { id: string; name: string }
interface Perm { role_id: string; object: string; can_read: number; can_create: number; can_edit: number; can_delete: number; view_all: number }

const FLAGS: [keyof Perm, string][] = [["can_read", "Read"], ["can_create", "Create"], ["can_edit", "Edit"], ["can_delete", "Delete"], ["view_all", "View All"]];

/** Setup: Users (invite, role, deactivate) and Profiles (object permissions), styled like Salesforce Setup. */
export function Setup() {
  const meta = useMeta();
  const [section, setSection] = useState<"users" | "profiles">("users");
  const [users, setUsers] = useState<User[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Perm[] | null>(null);
  const [error, setError] = useState("");
  const [inviting, setInviting] = useState(false);
  const [invite, setInvite] = useState({ name: "", email: "", role_id: "rep" });
  const [inviteUrl, setInviteUrl] = useState("");
  const [profile, setProfile] = useState("rep");

  const load = () => {
    api<{ users: User[]; roles: Role[] }>("/admin/users").then((r) => { setUsers(r.users); setRoles(r.roles); }).catch((e) => setError(e.message));
    api<{ permissions: Perm[] }>("/admin/permissions").then((r) => setPerms(r.permissions)).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const r = await api<{ inviteUrl: string }>("/admin/users", { method: "POST", body: invite });
      setInviteUrl(r.inviteUrl);
      setInvite({ name: "", email: "", role_id: "rep" });
      setInviting(false);
      load();
    } catch (err) { setError((err as Error).message); }
  };
  const updateUser = (id: string, body: Record<string, unknown>) => api(`/admin/users/${id}`, { method: "PATCH", body }).then(load).catch((e) => setError(e.message));
  const togglePerm = (p: Perm, k: keyof Perm) => {
    const next = { ...p, [k]: p[k] ? 0 : 1 };
    setPerms((ps) => ps?.map((x) => (x.role_id === p.role_id && x.object === p.object ? next : x)) ?? null);
    api(`/admin/permissions/${p.role_id}/${p.object}`, { method: "PUT", body: next }).catch((e) => { setError(e.message); load(); });
  };

  return (
    <div className="slds-grid slds-wrap slds-gutters_x-small">
      <div className="slds-col slds-size_1-of-1 slds-medium-size_3-of-12 slds-m-bottom_small">
        <nav className="slds-card slds-p-vertical_small" aria-label="Setup">
          <div className="slds-nav-vertical">
            <div className="slds-nav-vertical__section">
              <h2 className="slds-nav-vertical__title">Administration</h2>
              <ul>
                {(["users", "profiles"] as const).map((s) => (
                  <li key={s} className={`slds-nav-vertical__item ${section === s ? "slds-is-active" : ""}`}>
                    <a href="#" className="slds-nav-vertical__action" aria-current={section === s ? "page" : undefined} onClick={(e) => { e.preventDefault(); setSection(s); }}>
                      {s === "users" ? "Users" : "Profiles & Permissions"}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </nav>
      </div>

      <div className="slds-col slds-size_1-of-1 slds-medium-size_9-of-12">
        <div className="slds-page-header slds-m-bottom_small">
          <div className="slds-page-header__row">
            <div className="slds-page-header__col-title">
              <div className="slds-page-header__name"><div className="slds-page-header__name-title"><h1>
                <span>Setup</span>
                <span className="slds-page-header__title">{section === "users" ? "Users" : "Profiles & Permissions"}</span>
              </h1></div></div>
            </div>
            {section === "users" && (
              <div className="slds-page-header__col-actions">
                <button className="slds-button slds-button_neutral" onClick={() => setInviting(true)}>
                  <UtilityIcon name="add" className="slds-button__icon slds-button__icon_left" />New User
                </button>
              </div>
            )}
          </div>
        </div>
        {error && <ErrorAlert message={error} />}
        {inviteUrl && (
          <div className="slds-notify slds-notify_alert slds-alert_warning slds-m-bottom_small crm-invite-link" role="status">
            <span>Invite link (shown once, valid 7 days): <code>{inviteUrl}</code></span>
            <button className="slds-button slds-button_neutral slds-m-left_small" onClick={() => navigator.clipboard?.writeText(inviteUrl)}>Copy</button>
          </div>
        )}

        {section === "users" ? (
          <article className="slds-card">
            <table className="slds-table slds-table_cell-buffer slds-table_bordered crm-table" aria-label="Users">
              <thead><tr className="slds-line-height_reset">
                <th scope="col">Full Name</th><th scope="col">Email</th><th scope="col">Profile</th><th scope="col">Status</th><th scope="col"><span className="slds-assistive-text">Actions</span></th>
              </tr></thead>
              <tbody>
                {!users && <tr><td colSpan={5}><span className="crm-skeleton" /></td></tr>}
                {users?.map((u) => (
                  <tr key={u.id} className="slds-hint-parent">
                    <td data-label="Full Name">
                      <div className="slds-media slds-media_center">
                        <span className="slds-avatar slds-avatar_circle slds-avatar_small slds-media__figure"><abbr className="slds-avatar__initials slds-icon-standard-user" title={u.name}>{initials(u.name)}</abbr></span>
                        <span className="slds-media__body slds-truncate">{u.name}</span>
                      </div>
                    </td>
                    <td data-label="Email"><div className="slds-truncate">{u.email}</div></td>
                    <td data-label="Profile">
                      <div className="slds-select_container">
                        <label className="slds-assistive-text" htmlFor={`role-${u.id}`}>Profile for {u.name}</label>
                        <select id={`role-${u.id}`} className="slds-select" value={u.role_id} disabled={u.id === meta.user.id} onChange={(e) => updateUser(u.id, { role_id: e.target.value })}>
                          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </div>
                    </td>
                    <td data-label="Status">
                      <span className={`slds-badge ${!u.active ? "" : u.activated ? "slds-theme_success" : "slds-theme_warning"}`}>{!u.active ? "Inactive" : u.activated ? "Active" : "Invited"}</span>
                    </td>
                    <td>{u.id !== meta.user.id && <button className="slds-button slds-button_neutral" onClick={() => updateUser(u.id, { active: !u.active })}>{u.active ? "Deactivate" : "Activate"}</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        ) : (
          <article className="slds-card">
            <div className="slds-card__header">
              <div className="slds-form-element slds-size_1-of-1 slds-medium-size_1-of-3">
                <label className="slds-form-element__label" htmlFor="profile-picker">Profile</label>
                <div className="slds-select_container">
                  <select id="profile-picker" className="slds-select" value={profile} onChange={(e) => setProfile(e.target.value)}>
                    {roles.filter((r) => r.id !== "admin").map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>
              <p className="slds-text-body_small slds-text-color_weak slds-m-top_x-small">"View All" lets this profile see records owned by others. Without it, users see only their own records. System Administrators always have full access.</p>
            </div>
            <table className="slds-table slds-table_cell-buffer slds-table_bordered crm-table" aria-label="Object permissions">
              <thead><tr className="slds-line-height_reset"><th scope="col">Object</th>{FLAGS.map(([, l]) => <th key={l} scope="col" className="slds-text-align_center">{l}</th>)}</tr></thead>
              <tbody>
                {!perms && <tr><td colSpan={6}><span className="crm-skeleton" /></td></tr>}
                {perms?.filter((p) => p.role_id === profile).map((p) => (
                  <tr key={p.object}>
                    <th scope="row" data-label="Object">{meta.objects[p.object]?.plural ?? p.object}</th>
                    {FLAGS.map(([k, l]) => (
                      <td key={k} data-label={l} className="slds-text-align_center">
                        <div className="slds-checkbox">
                          <input type="checkbox" id={`p-${p.object}-${k}`} checked={!!p[k]} onChange={() => togglePerm(p, k)} />
                          <label className="slds-checkbox__label" htmlFor={`p-${p.object}-${k}`}>
                            <span className="slds-checkbox_faux" />
                            <span className="slds-form-element__label slds-assistive-text">{l} {p.object}</span>
                          </label>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        )}
      </div>

      {inviting && (
        <>
          <section role="dialog" tabIndex={-1} aria-modal="true" aria-labelledby="invite-title" className="slds-modal slds-fade-in-open">
            <form className="slds-modal__container" onSubmit={sendInvite}>
              <button type="button" className="slds-button slds-button_icon slds-modal__close slds-button_icon-inverse" onClick={() => setInviting(false)} title="Close">
                <UtilityIcon name="close" className="slds-button__icon slds-button__icon_large" label="Close" />
              </button>
              <div className="slds-modal__header"><h1 id="invite-title" className="slds-modal__title">New User</h1></div>
              <div className="slds-modal__content slds-p-around_medium">
                {[["name", "Full Name", "text"], ["email", "Email", "email"]].map(([k, l, t]) => (
                  <div key={k} className="slds-form-element slds-m-bottom_small">
                    <label className="slds-form-element__label" htmlFor={`inv-${k}`}><abbr className="slds-required" title="required">* </abbr>{l}</label>
                    <div className="slds-form-element__control">
                      <input id={`inv-${k}`} className="slds-input" type={t} required value={(invite as any)[k!]} onChange={(e) => setInvite({ ...invite, [k!]: e.target.value })} />
                    </div>
                  </div>
                ))}
                <div className="slds-form-element">
                  <label className="slds-form-element__label" htmlFor="inv-role">Profile</label>
                  <div className="slds-select_container">
                    <select id="inv-role" className="slds-select" value={invite.role_id} onChange={(e) => setInvite({ ...invite, role_id: e.target.value })}>
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="slds-modal__footer">
                <button type="button" className="slds-button slds-button_neutral" onClick={() => setInviting(false)}>Cancel</button>
                <button className="slds-button slds-button_brand">Save &amp; Create Invite</button>
              </div>
            </form>
          </section>
          <div className="slds-backdrop slds-backdrop_open" role="presentation" />
        </>
      )}
    </div>
  );
}
