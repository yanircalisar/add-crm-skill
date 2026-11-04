import { useEffect, useState } from "react";
import { api } from "../api";
import { useMeta } from "../App";

interface User { id: string; email: string; name: string; role_id: string; active: number; activated: number }
interface Role { id: string; name: string }
interface Perm { role_id: string; object: string; can_read: number; can_create: number; can_edit: number; can_delete: number; view_all: number }

const FLAGS: [keyof Perm, string][] = [["can_read", "Read"], ["can_create", "Create"], ["can_edit", "Edit"], ["can_delete", "Delete"], ["view_all", "View all"]];

/** Admin area: users (invite, role, deactivate) and profiles (object permissions). */
export function Setup() {
  const meta = useMeta();
  const [users, setUsers] = useState<User[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Perm[] | null>(null);
  const [error, setError] = useState("");
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
    <div className="setup">
      <h1 className="page-title">Setup</h1>
      {error && <p className="error" role="alert">{error}</p>}

      <section className="card">
        <h2>Users</h2>
        <form className="invite-form" onSubmit={sendInvite}>
          <label>Name<input required value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} /></label>
          <label>Email<input type="email" required value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></label>
          <label>Role<select value={invite.role_id} onChange={(e) => setInvite({ ...invite, role_id: e.target.value })}>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          <button className="btn btn-brand">Invite user</button>
        </form>
        {inviteUrl && (
          <p className="notice" role="status">Invite link (shown once, valid 7 days): <code>{inviteUrl}</code>{" "}
            <button className="btn btn-small" onClick={() => navigator.clipboard?.writeText(inviteUrl)}>Copy</button></p>
        )}
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {!users && <tr><td colSpan={5}><span className="skeleton" /></td></tr>}
              {users?.map((u) => (
                <tr key={u.id}>
                  <td data-label="Name">{u.name}</td>
                  <td data-label="Email">{u.email}</td>
                  <td data-label="Role">
                    <label className="sr-only" htmlFor={`role-${u.id}`}>Role for {u.name}</label>
                    <select id={`role-${u.id}`} value={u.role_id} disabled={u.id === meta.user.id} onChange={(e) => updateUser(u.id, { role_id: e.target.value })}>
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </td>
                  <td data-label="Status">{!u.active ? "Inactive" : u.activated ? "Active" : "Invited"}</td>
                  <td>{u.id !== meta.user.id && <button className="btn btn-small" onClick={() => updateUser(u.id, { active: !u.active })}>{u.active ? "Deactivate" : "Activate"}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Profiles &amp; permissions</h2>
        <label>Profile{" "}
          <select value={profile} onChange={(e) => setProfile(e.target.value)}>
            {roles.filter((r) => r.id !== "admin").map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <p className="muted small">"View all" lets this profile see records owned by others. Without it, users see only their own records. Administrators always have full access.</p>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th scope="col">Object</th>{FLAGS.map(([, l]) => <th key={l} scope="col">{l}</th>)}</tr></thead>
            <tbody>
              {!perms && <tr><td colSpan={6}><span className="skeleton" /></td></tr>}
              {perms?.filter((p) => p.role_id === profile).map((p) => (
                <tr key={p.object}>
                  <td data-label="Object">{meta.objects[p.object]?.plural ?? p.object}</td>
                  {FLAGS.map(([k, l]) => (
                    <td key={k} data-label={l}>
                      <input type="checkbox" aria-label={`${l} ${p.object}`} checked={!!p[k]} onChange={() => togglePerm(p, k)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
