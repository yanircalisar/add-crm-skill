import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, formatValue, type ObjectDef } from "../api";
import { useMeta } from "../App";
import { ObjectIcon, UtilityIcon, ErrorAlert } from "../Icon";
import { RecordForm } from "./RecordForm";

const PAGE = 50;

/** Object home: page header with list view picker + data table, as in Lightning. */
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
  const [reload, setReload] = useState(0);

  const canCreate = meta.permissions.find((p) => p.object === object)?.can_create;

  useEffect(() => {
    setSearch(q);
    if (!def) return;
    setData(null);
    setError("");
    const qs = new URLSearchParams({ q, scope, sort, dir, limit: String(PAGE), offset: String(offset) });
    api(`/o/${object}?${qs}`).then(setData).catch((e) => setError(e.message));
  }, [object, q, scope, sort, dir, offset, reload]);

  if (!def) return <article className="slds-card"><div className="slds-card__body slds-card__body_inner">You don't have access to this object.</div></article>;

  const set = (patch: Record<string, string>) => setParams((p) => { const n = new URLSearchParams(p); for (const [k, v] of Object.entries(patch)) n.set(k, v); return n; });
  const toggleSort = (f: string) => set({ sort: f, dir: sort === f && dir === "asc" ? "desc" : "asc", offset: "0" });
  const fieldOf = (name: string) => def.fields.find((f) => f.name === name);
  const viewName = scope === "mine" ? `My ${def.plural}` : `All ${def.plural}`;

  return (
    <div className="crm-list">
      <div className="slds-page-header slds-page-header_object-home">
        <div className="slds-page-header__row">
          <div className="slds-page-header__col-title">
            <div className="slds-media">
              <div className="slds-media__figure"><ObjectIcon object={object} size="medium" /></div>
              <div className="slds-media__body">
                <div className="slds-page-header__name">
                  <div className="slds-page-header__name-title">
                    <h1>
                      <span>{def.plural}</span>
                      <label className="slds-assistive-text" htmlFor="view-picker">List view</label>
                      <span className="crm-view-picker">
                        <select id="view-picker" className="slds-page-header__title slds-truncate" value={scope} onChange={(e) => set({ scope: e.target.value, offset: "0" })}>
                          <option value="all">All {def.plural}</option>
                          <option value="mine">My {def.plural}</option>
                        </select>
                        <UtilityIcon name="down" className="slds-icon slds-icon_x-small slds-icon-text-default" />
                      </span>
                    </h1>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="slds-page-header__col-actions">
            <div className="slds-page-header__controls">
              {canCreate ? (
                <div className="slds-page-header__control">
                  <button className="slds-button slds-button_neutral" onClick={() => setCreating(true)}>New</button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="slds-page-header__row">
          <div className="slds-page-header__col-meta">
            <p className="slds-page-header__meta-text" aria-live="polite">
              {data ? `${data.total} item${data.total === 1 ? "" : "s"} • Sorted by ${fieldOf(sort)?.label ?? "Last Modified"} • ${viewName}` : "Loading…"}
            </p>
          </div>
          <div className="slds-page-header__col-controls">
            <div className="slds-page-header__controls">
              <div className="slds-page-header__control">
                <form role="search" onSubmit={(e) => { e.preventDefault(); set({ q: search, offset: "0" }); }}>
                  <div className="slds-form-element">
                    <label className="slds-assistive-text" htmlFor="list-search">Search this list</label>
                    <div className="slds-form-element__control slds-input-has-icon slds-input-has-icon_left">
                      <UtilityIcon name="search" className="slds-icon slds-input__icon slds-input__icon_left slds-icon-text-default" />
                      <input id="list-search" type="search" className="slds-input" placeholder="Search this list..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                  </div>
                </form>
              </div>
              <div className="slds-page-header__control">
                <button className="slds-button slds-button_icon slds-button_icon-border-filled" title="Refresh" onClick={() => setReload((n) => n + 1)}>
                  <UtilityIcon name="refresh" label="Refresh" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && <ErrorAlert message={error} />}
      <div className="crm-table-wrap">
        <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-table_fixed-layout crm-table" aria-label={viewName}>
          <thead>
            <tr className="slds-line-height_reset">
              {def.listFields.map((f) => (
                <th key={f} scope="col" className={`slds-is-sortable ${sort === f ? "slds-is-sorted" : ""} ${sort === f && dir === "asc" ? "slds-is-sorted_asc" : ""}`}
                  aria-sort={sort === f ? (dir === "asc" ? "ascending" : "descending") : "none"}>
                  <a href="#" className="slds-th__action slds-text-link_reset" role="button" onClick={(e) => { e.preventDefault(); toggleSort(f); }}>
                    <span className="slds-truncate" title={fieldOf(f)?.label}>{fieldOf(f)?.label ?? f}</span>
                    <span className="slds-icon_container slds-icon-utility-arrowdown">
                      <UtilityIcon name="arrowdown" className="slds-icon slds-icon-text-default slds-is-sortable__icon" />
                    </span>
                  </a>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!data && !error && Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>{def.listFields.map((f) => <td key={f}><span className="crm-skeleton" /></td>)}</tr>
            ))}
            {data?.records.length === 0 && (
              <tr><td colSpan={def.listFields.length}>
                <div className="slds-illustration slds-illustration_small slds-p-around_large slds-text-align_center">
                  <h3 className="slds-text-heading_medium">No items to display</h3>
                  {canCreate ? <p className="slds-text-body_regular slds-m-top_x-small">Click <strong>New</strong> to add a {def.label.toLowerCase()}.</p> : null}
                </div>
              </td></tr>
            )}
            {data?.records.map((r) => (
              <tr key={r.id} className="slds-hint-parent">
                {def.listFields.map((f, i) => {
                  const text = formatValue(fieldOf(f), r[f]);
                  return (
                    <td key={f} data-label={fieldOf(f)?.label ?? f}>
                      <div className="slds-truncate" title={text}>
                        {i === 0 ? <Link to={`/o/${object}/${r.id}`}>{text || "(no value)"}</Link> : text}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && data.total > PAGE && (
        <div className="slds-grid slds-grid_align-center slds-grid_vertical-align-center slds-p-around_small crm-pager">
          <button className="slds-button slds-button_neutral" disabled={offset === 0} onClick={() => set({ offset: String(Math.max(offset - PAGE, 0)) })}>Previous</button>
          <span className="slds-text-body_small slds-m-horizontal_medium">{offset + 1}–{Math.min(offset + PAGE, data.total)} of {data.total}</span>
          <button className="slds-button slds-button_neutral" disabled={offset + PAGE >= data.total} onClick={() => set({ offset: String(offset + PAGE) })}>Next</button>
        </div>
      )}
      {creating && <RecordForm object={object} def={def} onClose={() => setCreating(false)} onSaved={(id) => navigate(`/o/${object}/${id}`)} />}
    </div>
  );
}
