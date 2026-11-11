import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, fieldOf, recordUrl, useDescribe, type Names, type SRecord } from "../api";
import { ObjectIcon, UtilityIcon, ErrorAlert } from "../Icon";
import { FieldValue } from "../components";
import { RecordForm } from "./RecordForm";

const PAGE = 50;
const VIEWS: Record<string, string> = { all: "All", mine: "My", open: "Open" };

/** Object home: page header with list view picker + data table. URL: /lightning/o/{Type}/list */
export function ListView() {
  const { type = "" } = useParams();
  const { d, error: describeError } = useDescribe(type);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const scope = params.get("filterName") ?? "all";
  const sort = params.get("sort") ?? "LastModifiedDate";
  const dir = params.get("dir") ?? "desc";
  const offset = Number(params.get("offset") ?? 0);
  const [data, setData] = useState<{ records: SRecord[]; totalSize: number; names: Names } | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState(q);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    setSearch(q);
    if (!d) return;
    setData(null);
    setError("");
    const qs = new URLSearchParams({ q, scope, sort, dir, limit: String(PAGE), offset: String(offset) });
    const field = params.get("field");
    if (field) { qs.set("field", field); qs.set("value", params.get("value") ?? ""); }
    api(`/sobjects/${type}?${qs}`).then(setData).catch((e) => setError(e.message));
  }, [d, q, scope, sort, dir, offset, reload]);

  if (describeError) return <ErrorAlert message="You don't have access to this object, or it doesn't exist." />;
  if (!d) return <div className="slds-page-header"><span className="crm-skeleton" /></div>;

  const set = (patch: Record<string, string>) => setParams((p) => { const n = new URLSearchParams(p); for (const [k, v] of Object.entries(patch)) n.set(k, v); return n; });
  const toggleSort = (f: string) => set({ sort: f, dir: sort === f && dir === "asc" ? "desc" : "asc", offset: "0" });
  const viewName = `${VIEWS[scope] ?? "All"} ${d.labelPlural}`;
  const hasOpen = d.fields.some((f) => f.name === "IsClosed") || d.name === "Lead";

  return (
    <div className="crm-list">
      <div className="slds-page-header slds-page-header_object-home">
        <div className="slds-page-header__row">
          <div className="slds-page-header__col-title">
            <div className="slds-media">
              <div className="slds-media__figure"><ObjectIcon object={d.name} size="medium" /></div>
              <div className="slds-media__body">
                <div className="slds-page-header__name">
                  <div className="slds-page-header__name-title">
                    <h1>
                      <span>{d.labelPlural}</span>
                      <label className="slds-assistive-text" htmlFor="view-picker">List view</label>
                      <span className="crm-view-picker">
                        <select id="view-picker" className="slds-page-header__title slds-truncate" value={scope} onChange={(e) => set({ filterName: e.target.value, offset: "0" })}>
                          <option value="all">All {d.labelPlural}</option>
                          <option value="mine">My {d.labelPlural}</option>
                          {hasOpen && <option value="open">Open {d.labelPlural}</option>}
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
              {d.createable && (
                <div className="slds-page-header__control">
                  <button className="slds-button slds-button_neutral" onClick={() => setCreating(true)}>New</button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="slds-page-header__row">
          <div className="slds-page-header__col-meta">
            <p className="slds-page-header__meta-text" aria-live="polite">
              {data ? `${data.totalSize} item${data.totalSize === 1 ? "" : "s"} • Sorted by ${fieldOf(d, sort)?.label ?? "Last Modified Date"} • ${viewName}` : "Loading…"}
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
              {d.listFields.map((f) => (
                <th key={f} scope="col" className={`slds-is-sortable ${sort === f ? "slds-is-sorted" : ""} ${sort === f && dir === "asc" ? "slds-is-sorted_asc" : ""}`}
                  aria-sort={sort === f ? (dir === "asc" ? "ascending" : "descending") : "none"}>
                  <a href="#" className="slds-th__action slds-text-link_reset" role="button" onClick={(e) => { e.preventDefault(); toggleSort(f); }}>
                    <span className="slds-truncate" title={fieldOf(d, f)?.label}>{fieldOf(d, f)?.label ?? f}</span>
                    <span className="slds-icon_container"><UtilityIcon name="arrowdown" className="slds-icon slds-icon-text-default slds-is-sortable__icon" /></span>
                  </a>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!data && !error && Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>{d.listFields.map((f) => <td key={f}><span className="crm-skeleton" /></td>)}</tr>
            ))}
            {data?.records.length === 0 && (
              <tr><td colSpan={d.listFields.length}>
                <div className="slds-p-around_large slds-text-align_center">
                  <h3 className="slds-text-heading_medium">No items to display</h3>
                  {d.createable && <p className="slds-m-top_x-small">Click <strong>New</strong> to add a {d.label.toLowerCase()}.</p>}
                </div>
              </td></tr>
            )}
            {data?.records.map((r) => (
              <tr key={r.Id} className="slds-hint-parent">
                {d.listFields.map((f, i) => (
                  <td key={f} data-label={fieldOf(d, f)?.label ?? f}>
                    <div className="slds-truncate">
                      {i === 0 ? <Link to={recordUrl(d.name, r.Id)}>{String(r[f] ?? "") || "(no name)"}</Link> : <FieldValue field={fieldOf(d, f)} value={r[f]} names={data.names} />}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && data.totalSize > PAGE && (
        <div className="slds-grid slds-grid_align-center slds-grid_vertical-align-center slds-p-around_small crm-pager">
          <button className="slds-button slds-button_neutral" disabled={offset === 0} onClick={() => set({ offset: String(Math.max(offset - PAGE, 0)) })}>Previous</button>
          <span className="slds-text-body_small slds-m-horizontal_medium">{offset + 1}–{Math.min(offset + PAGE, data.totalSize)} of {data.totalSize}</span>
          <button className="slds-button slds-button_neutral" disabled={offset + PAGE >= data.totalSize} onClick={() => set({ offset: String(offset + PAGE) })}>Next</button>
        </div>
      )}
      {creating && <RecordForm describe={d} onClose={() => setCreating(false)} onSaved={(id) => navigate(recordUrl(d.name, id))} />}
    </div>
  );
}
