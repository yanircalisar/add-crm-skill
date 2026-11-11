import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, clearDescribeCache } from "../api";
import { initials, useMeta } from "../App";
import { ErrorAlert, UtilityIcon } from "../Icon";

interface User { Id: string; Username: string; Email: string; Name: string; ProfileId: string; UserRoleId: string | null; IsActive: number; Activated: number; LastLoginDate: string | null }
interface Profile { Id: string; Name: string }
interface Role { Id: string; Name: string; ParentRoleId: string | null }
interface Perm { SobjectType: string; PermissionsRead: number; PermissionsCreate: number; PermissionsEdit: number; PermissionsDelete: number; PermissionsViewAllRecords: number; PermissionsModifyAllRecords: number }

const PAGES = { ManageUsers: "Users", Profiles: "Profiles", Roles: "Roles", SecuritySharing: "Sharing Settings", RecycleBin: "Recycle Bin" } as const;
type Page = keyof typeof PAGES;

/** Setup, like Salesforce Setup: Users, Profiles (object permissions), Roles (hierarchy), Sharing Settings (org-wide defaults), Recycle Bin. */
export function Setup() {
  const { page = "ManageUsers" } = useParams();
  const current = (page in PAGES ? page : "ManageUsers") as Page;
  const [error, setError] = useState("");
  const [data, setData] = useState<{ users: User[]; profiles: Profile[]; roles: Role[] } | null>(null);
  const load = () => api("/setup/users").then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  return (
    <div className="slds-grid slds-wrap slds-gutters_x-small">
      <div className="slds-col slds-size_1-of-1 slds-medium-size_3-of-12 slds-m-bottom_small">
        <nav className="slds-card slds-p-vertical_small" aria-label="Setup">
          <div className="slds-nav-vertical"><div className="slds-nav-vertical__section">
            <h2 className="slds-nav-vertical__title">Administration</h2>
            <ul>
              {(Object.keys(PAGES) as Page[]).map((p) => (
                <li key={p} className={`slds-nav-vertical__item ${current === p ? "slds-is-active" : ""}`}>
                  <Link to={`/lightning/setup/${p}`} className="slds-nav-vertical__action" aria-current={current === p ? "page" : undefined}>{PAGES[p]}</Link>
                </li>
              ))}
            </ul>
          </div></div>
        </nav>
      </div>
      <div className="slds-col slds-size_1-of-1 slds-medium-size_9-of-12">
        <div className="slds-page-header slds-m-bottom_small">
          <div className="slds-page-header__name"><div className="slds-page-header__name-title"><h1>
            <span>Setup</span><span className="slds-page-header__title">{PAGES[current]}</span>
          </h1></div></div>
        </div>
        {error && <ErrorAlert message={error} />}
        {!data ? <span className="crm-skeleton" /> : (
          <>
            {current === "ManageUsers" && <Users data={data} reload={load} onError={setError} />}
            {current === "Profiles" && <Profiles profiles={data.profiles} onError={setError} />}
            {current === "Roles" && <Roles roles={data.roles} users={data.users} />}
            {current === "SecuritySharing" && <Sharing onError={setError} />}
            {current === "RecycleBin" && <RecycleBin onError={setError} />}
          </>
        )}
      </div>
    </div>
  );
}

function Select({ id, label, value, options, onChange, disabled, allowNone }: { id: string; label: string; value: string; options: { Id: string; Name: string }[]; onChange: (v: string) => void; disabled?: boolean; allowNone?: boolean }) {
  return (
    <div className="slds-select_container">
      <label className="slds-assistive-text" htmlFor={id}>{label}</label>
      <select id={id} className="slds-select" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {allowNone && <option value="">--None--</option>}
        {options.map((o) => <option key={o.Id} value={o.Id}>{o.Name}</option>)}
      </select>
    </div>
  );
}

function Users({ data, reload, onError }: { data: { users: User[]; profiles: Profile[]; roles: Role[] }; reload: () => void; onError: (e: string) => void }) {
  const meta = useMeta();
  const [inviting, setInviting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const standard = data.profiles.find((p) => p.Name === "Standard User")?.Id ?? data.profiles[0]?.Id ?? "";
  const [form, setForm] = useState({ FirstName: "", LastName: "", Email: "", ProfileId: standard, UserRoleId: "" });
  const update = (id: string, body: Record<string, unknown>) => api(`/setup/users/${id}`, { method: "PATCH", body }).then(reload).catch((e) => onError(e.message));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await api<{ inviteUrl: string }>("/setup/users", { method: "POST", body: form });
      setInviteUrl(r.inviteUrl);
      setInviting(false);
      setForm({ FirstName: "", LastName: "", Email: "", ProfileId: standard, UserRoleId: "" });
      reload();
    } catch (err) { onError((err as Error).message); }
  };
  return (
    <>
      <div className="slds-m-bottom_small slds-text-align_right">
        <button className="slds-button slds-button_neutral" onClick={() => setInviting(true)}><UtilityIcon name="add" className="slds-button__icon slds-button__icon_left" />New User</button>
      </div>
      {inviteUrl && (
        <div className="slds-notify slds-notify_alert slds-alert_warning slds-m-bottom_small crm-invite-link" role="status">
          <span>Invite link (shown once, valid 7 days): <code>{inviteUrl}</code></span>
          <button className="slds-button slds-button_neutral slds-m-left_small" onClick={() => navigator.clipboard?.writeText(inviteUrl)}>Copy</button>
        </div>
      )}
      <article className="slds-card">
        <table className="slds-table slds-table_cell-buffer slds-table_bordered crm-table" aria-label="Users">
          <thead><tr className="slds-line-height_reset"><th scope="col">Full Name</th><th scope="col">Username</th><th scope="col">Profile</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col"><span className="slds-assistive-text">Actions</span></th></tr></thead>
          <tbody>
            {data.users.map((u) => (
              <tr key={u.Id} className="slds-hint-parent">
                <td data-label="Full Name"><div className="slds-media slds-media_center">
                  <span className="slds-avatar slds-avatar_circle slds-avatar_small slds-media__figure"><abbr className="slds-avatar__initials crm-avatar" title={u.Name}>{initials(u.Name)}</abbr></span>
                  <span className="slds-media__body slds-truncate">{u.Name}</span>
                </div></td>
                <td data-label="Username"><div className="slds-truncate">{u.Username}</div></td>
                <td data-label="Profile"><Select id={`p-${u.Id}`} label={`Profile for ${u.Name}`} value={u.ProfileId} options={data.profiles} disabled={u.Id === meta.user.Id} onChange={(v) => update(u.Id, { ProfileId: v })} /></td>
                <td data-label="Role"><Select id={`r-${u.Id}`} label={`Role for ${u.Name}`} value={u.UserRoleId ?? ""} options={data.roles} allowNone onChange={(v) => update(u.Id, { UserRoleId: v || null })} /></td>
                <td data-label="Status"><span className={`slds-badge ${!u.IsActive ? "" : u.Activated ? "slds-theme_success" : "slds-theme_warning"}`}>{!u.IsActive ? "Inactive" : u.Activated ? "Active" : "Invited"}</span></td>
                <td>{u.Id !== meta.user.Id && <button className="slds-button slds-button_neutral" onClick={() => update(u.Id, { IsActive: !u.IsActive })}>{u.IsActive ? "Deactivate" : "Activate"}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
      {inviting && (
        <>
          <section role="dialog" tabIndex={-1} aria-modal="true" aria-labelledby="invite-title" className="slds-modal slds-fade-in-open">
            <form className="slds-modal__container" onSubmit={submit}>
              <button type="button" className="slds-button slds-button_icon slds-modal__close slds-button_icon-inverse" onClick={() => setInviting(false)} title="Close"><UtilityIcon name="close" className="slds-button__icon slds-button__icon_large" label="Close" /></button>
              <div className="slds-modal__header"><h1 id="invite-title" className="slds-modal__title">New User</h1></div>
              <div className="slds-modal__content slds-p-around_medium">
                {([["FirstName", "First Name", "text", false], ["LastName", "Last Name", "text", true], ["Email", "Email (also the Username)", "email", true]] as const).map(([k, l, t, req]) => (
                  <div key={k} className="slds-form-element slds-m-bottom_small">
                    <label className="slds-form-element__label" htmlFor={`inv-${k}`}>{req && <abbr className="slds-required" title="required">* </abbr>}{l}</label>
                    <input id={`inv-${k}`} className="slds-input" type={t} required={req} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                  </div>
                ))}
                <div className="slds-form-element slds-m-bottom_small"><span className="slds-form-element__label">Profile</span><Select id="inv-profile" label="Profile" value={form.ProfileId} options={data.profiles} onChange={(v) => setForm({ ...form, ProfileId: v })} /></div>
                <div className="slds-form-element"><span className="slds-form-element__label">Role</span><Select id="inv-role" label="Role" value={form.UserRoleId} options={data.roles} allowNone onChange={(v) => setForm({ ...form, UserRoleId: v })} /></div>
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
    </>
  );
}

const FLAGS: [keyof Perm, string][] = [["PermissionsRead", "Read"], ["PermissionsCreate", "Create"], ["PermissionsEdit", "Edit"], ["PermissionsDelete", "Delete"], ["PermissionsViewAllRecords", "View All"], ["PermissionsModifyAllRecords", "Modify All"]];

function Profiles({ profiles, onError }: { profiles: Profile[]; onError: (e: string) => void }) {
  const meta = useMeta();
  const editable = profiles.filter((p) => p.Name !== "System Administrator");
  const [profile, setProfile] = useState(editable[0]?.Id ?? "");
  const [perms, setPerms] = useState<Perm[] | null>(null);
  useEffect(() => { if (profile) api(`/setup/profiles/${profile}/permissions`).then((r) => setPerms(r.permissions)).catch((e) => onError(e.message)); }, [profile]);
  const toggle = async (p: Perm, k: keyof Perm) => {
    try {
      const saved = await api<Perm>(`/setup/profiles/${profile}/permissions/${p.SobjectType}`, { method: "PUT", body: { ...p, [k]: p[k] ? 0 : 1 } });
      setPerms((ps) => ps?.map((x) => (x.SobjectType === p.SobjectType ? { ...x, ...saved } : x)) ?? null);
      clearDescribeCache();
    } catch (e) { onError((e as Error).message); }
  };
  return (
    <article className="slds-card">
      <div className="slds-card__header">
        <div className="slds-form-element slds-size_1-of-1 slds-medium-size_1-of-3"><span className="slds-form-element__label">Profile</span>
          <Select id="profile-picker" label="Profile" value={profile} options={editable} onChange={setProfile} />
        </div>
        <p className="slds-text-body_small slds-text-color_weak slds-m-top_x-small">Object permissions decide what users with this profile can do. Which records they see also depends on Sharing Settings and the role hierarchy. System Administrator has Modify All Data and can't be changed.</p>
      </div>
      <table className="slds-table slds-table_cell-buffer slds-table_bordered crm-table" aria-label="Object permissions">
        <thead><tr className="slds-line-height_reset"><th scope="col">Object</th>{FLAGS.map(([, l]) => <th key={l} scope="col" className="slds-text-align_center">{l}</th>)}</tr></thead>
        <tbody>
          {!perms && <tr><td colSpan={7}><span className="crm-skeleton" /></td></tr>}
          {perms?.map((p) => (
            <tr key={p.SobjectType}>
              <th scope="row" data-label="Object">{meta.sobjects.find((s) => s.name === p.SobjectType)?.labelPlural ?? p.SobjectType}</th>
              {FLAGS.map(([k, l]) => (
                <td key={k} data-label={l} className="slds-text-align_center">
                  <div className="slds-checkbox">
                    <input type="checkbox" id={`p-${p.SobjectType}-${k}`} checked={!!p[k]} onChange={() => toggle(p, k)} />
                    <label className="slds-checkbox__label" htmlFor={`p-${p.SobjectType}-${k}`}><span className="slds-checkbox_faux" /><span className="slds-form-element__label slds-assistive-text">{l} {p.SobjectType}</span></label>
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function Roles({ roles, users }: { roles: Role[]; users: User[] }) {
  const tree = (parent: string | null, depth: number): React.ReactNode[] =>
    roles.filter((r) => r.ParentRoleId === parent).flatMap((r) => [
      <li key={r.Id} className="slds-item" style={{ paddingLeft: `${depth * 1.5}rem` }}>
        <strong>{r.Name}</strong>
        <span className="slds-text-color_weak slds-m-left_small">{users.filter((u) => u.UserRoleId === r.Id).map((u) => u.Name).join(", ") || "No users"}</span>
      </li>,
      ...tree(r.Id, depth + 1),
    ]);
  return (
    <article className="slds-card"><div className="slds-card__body slds-card__body_inner">
      <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_small">Users can see and edit records owned by users in roles below them. Assign roles on the Users page.</p>
      <ul className="slds-has-dividers_bottom-space">{tree(null, 0)}</ul>
    </div></article>
  );
}

function Sharing({ onError }: { onError: (e: string) => void }) {
  const meta = useMeta();
  const [rows, setRows] = useState<{ SobjectType: string; Access: string }[] | null>(null);
  useEffect(() => { api("/setup/sharing").then((r) => setRows(r.defaults)).catch((e) => onError(e.message)); }, []);
  const set = (type: string, Access: string) => api(`/setup/sharing/${type}`, { method: "PUT", body: { Access } })
    .then(() => setRows((rs) => rs?.map((r) => (r.SobjectType === type ? { ...r, Access } : r)) ?? null)).catch((e) => onError(e.message));
  const LABELS: Record<string, string> = { Private: "Private", Read: "Public Read Only", ReadWrite: "Public Read/Write", ControlledByParent: "Controlled by Parent" };
  return (
    <article className="slds-card">
      <div className="slds-card__header"><h2 className="slds-card__header-title">Organization-Wide Defaults</h2>
        <p className="slds-text-body_small slds-text-color_weak">The baseline access users have to each other's records. Open it up with Public Read Only or Public Read/Write.</p></div>
      <table className="slds-table slds-table_cell-buffer slds-table_bordered crm-table" aria-label="Organization-wide defaults">
        <thead><tr><th scope="col">Object</th><th scope="col">Default Access</th></tr></thead>
        <tbody>
          {!rows && <tr><td colSpan={2}><span className="crm-skeleton" /></td></tr>}
          {rows?.map((r) => (
            <tr key={r.SobjectType}>
              <th scope="row" data-label="Object">{meta.sobjects.find((s) => s.name === r.SobjectType)?.labelPlural ?? r.SobjectType}</th>
              <td data-label="Default Access">
                {r.Access === "ControlledByParent" ? LABELS[r.Access] : (
                  <div className="slds-select_container">
                    <label className="slds-assistive-text" htmlFor={`owd-${r.SobjectType}`}>Default access for {r.SobjectType}</label>
                    <select id={`owd-${r.SobjectType}`} className="slds-select" value={r.Access} onChange={(e) => set(r.SobjectType, e.target.value)}>
                      {["Private", "Read", "ReadWrite"].map((a) => <option key={a} value={a}>{LABELS[a]}</option>)}
                    </select>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function RecycleBin({ onError }: { onError: (e: string) => void }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<{ Id: string; Name: string; type: string; typeLabel: string; DeletedDate: string }[] | null>(null);
  const load = () => api("/recyclebin").then((r) => setRows(r.records)).catch((e) => onError(e.message));
  useEffect(() => { load(); }, []);
  const restore = (r: { Id: string; type: string }) => api(`/sobjects/${r.type}/${r.Id}/undelete`, { method: "POST" }).then(() => navigate(`/lightning/r/${r.type}/${r.Id}/view`)).catch((e) => onError(e.message));
  return (
    <article className="slds-card">
      <table className="slds-table slds-table_cell-buffer slds-table_bordered crm-table" aria-label="Recycle Bin">
        <thead><tr><th scope="col">Name</th><th scope="col">Type</th><th scope="col">Deleted Date</th><th scope="col"><span className="slds-assistive-text">Actions</span></th></tr></thead>
        <tbody>
          {!rows && <tr><td colSpan={4}><span className="crm-skeleton" /></td></tr>}
          {rows?.length === 0 && <tr><td colSpan={4} className="slds-text-align_center slds-p-around_medium slds-text-color_weak">The Recycle Bin is empty.</td></tr>}
          {rows?.map((r) => (
            <tr key={r.Id}>
              <td data-label="Name">{r.Name}</td><td data-label="Type">{r.typeLabel}</td>
              <td data-label="Deleted Date">{new Date(r.DeletedDate).toLocaleString()}</td>
              <td><button className="slds-button slds-button_neutral" onClick={() => restore(r)}>Restore</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}
