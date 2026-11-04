import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, formatValue, type ObjectDef } from "../api";
import { useMeta } from "../App";
import { RecordForm } from "./RecordForm";

const PAGE = 50;

export function ListView() {
  const { object = "" } = useParams();
  const meta = useMeta();
  const def: ObjectDef | undefined = meta.objects[object];
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const scope = params.get("scope") ?? "all";
  const sort = params.get("sort") ?? "updated_at";
  const dir = params.get("dir") ?? "desc";
  const offset = Number(params.get("offset") ?? 0);
  const [data, setData] = useState<{ records: any[]; total: number } | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState(q);

  const canCreate = meta.permissions.find((p) => p.object === object)?.can_create;

  useEffect(() => {
    setSearch(q);
    if (!def) return;
    setData(null);
    setError("");
    const qs = new URLSearchParams({ q, scope, sort, dir, limit: String(PAGE), offset: String(offset) });
    api(`/o/${object}?${qs}`).then(setData).catch((e) => setError(e.message));
  }, [object, q, scope, sort, dir, offset]);

  if (!def) return <div className="card empty">You don't have access to this object.</div>;

  const set = (patch: Record<string, string>) => setParams((p) => { const n = new URLSearchParams(p); for (const [k, v] of Object.entries(patch)) n.set(k, v); return n; });
  const toggleSort = (f: string) => set({ sort: f, dir: sort === f && dir === "asc" ? "desc" : "asc", offset: "0" });
  const fieldOf = (name: string) => def.fields.find((f) => f.name === name);

  return (
    <section className="card">
      <div className="list-header">
        <div>
          <p className="eyebrow">{def.plural}</p>
          <label className="sr-only" htmlFor="scope">List view</label>
          <select id="scope" className="view-picker" value={scope} onChange={(e) => set({ scope: e.target.value, offset: "0" })}>
            <option value="all">All {def.plural}</option>
            <option value="mine">My {def.plural}</option>
          </select>
        </div>
        <div className="list-actions">
          <form role="search" onSubmit={(e) => { e.preventDefault(); set({ q: search, offset: "0" }); }}>
            <label className="sr-only" htmlFor="list-search">Search this list</label>
            <input id="list-search" placeholder="Search this list…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </form>
          {canCreate ? <button className="btn btn-brand" onClick={() => setCreating(true)}>New</button> : null}
        </div>
      </div>
      <p className="muted small" aria-live="polite">{data ? `${data.total} item${data.total === 1 ? "" : "s"}` : " "}</p>

      {error && <p className="error" role="alert">{error}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {def.listFields.map((f) => (
                <th key={f} scope="col" aria-sort={sort === f ? (dir === "asc" ? "ascending" : "descending") : "none"}>
                  <button className="th-btn" onClick={() => toggleSort(f)}>
                    {fieldOf(f)?.label ?? (f === "created_at" ? "Created" : f)} {sort === f ? (dir === "asc" ? "▲" : "▼") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!data && !error && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="skeleton-row">{def.listFields.map((f) => <td key={f}><span className="skeleton" /></td>)}</tr>
            ))}
            {data?.records.length === 0 && (
              <tr><td colSpan={def.listFields.length} className="empty">No {def.plural.toLowerCase()} yet.{canCreate ? " Click New to add one." : ""}</td></tr>
            )}
            {data?.records.map((r) => (
              <tr key={r.id}>
                {def.listFields.map((f, i) => (
                  <td key={f} data-label={fieldOf(f)?.label ?? f}>
                    {i === 0 ? <Link to={`/o/${object}/${r.id}`}>{formatValue(fieldOf(f), r[f]) || "(no value)"}</Link> : formatValue(fieldOf(f), r[f])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && data.total > PAGE && (
        <div className="pager">
          <button className="btn" disabled={offset === 0} onClick={() => set({ offset: String(Math.max(offset - PAGE, 0)) })}>Previous</button>
          <span className="muted small">{offset + 1}–{Math.min(offset + PAGE, data.total)} of {data.total}</span>
          <button className="btn" disabled={offset + PAGE >= data.total} onClick={() => set({ offset: String(offset + PAGE) })}>Next</button>
        </div>
      )}
      {creating && <RecordForm object={object} def={def} onClose={() => setCreating(false)} onSaved={(id) => navigate(`/o/${object}/${id}`)} />}
    </section>
  );
}
