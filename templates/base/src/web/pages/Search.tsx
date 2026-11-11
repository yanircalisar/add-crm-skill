import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, describe, fieldOf, listUrl, recordUrl, type Describe, type Names, type SRecord } from "../api";
import { NAV, useMeta } from "../App";
import { ObjectIcon, Spinner } from "../Icon";
import { FieldValue } from "../components";

/** Global search results, grouped by object (top 5 each). URL: /lightning/search?q=... */
export function Search() {
  const meta = useMeta();
  const q = useSearchParams()[0].get("q") ?? "";
  const [results, setResults] = useState<{ d: Describe; records: SRecord[]; names: Names }[] | null>(null);

  useEffect(() => {
    setResults(null);
    const types = NAV.filter((t) => meta.sobjects.some((s) => s.name === t));
    Promise.all(types.map(async (t) => {
      const [d, r] = await Promise.all([describe(t), api<{ records: SRecord[]; names: Names }>(`/sobjects/${t}?q=${encodeURIComponent(q)}&limit=5`)]);
      return { d, records: r.records, names: r.names };
    }).map((p) => p.catch(() => null))).then((all) => setResults(all.filter((x): x is NonNullable<typeof x> => !!x && x.records.length > 0)));
  }, [q]);

  if (!results) return <Spinner />;
  return (
    <div>
      <div className="slds-page-header slds-m-bottom_small"><h1 className="slds-page-header__title">Search Results for “{q}”</h1></div>
      {results.length === 0 && (
        <article className="slds-card"><div className="slds-card__body slds-card__body_inner slds-p-vertical_large slds-text-align_center">
          <h2 className="slds-text-heading_medium">Don't give up yet!</h2>
          <p className="slds-text-color_weak">No results for “{q}”. Check the spelling or try different keywords.</p>
        </div></article>
      )}
      {results.map(({ d, records, names }) => {
        const cols = d.listFields.slice(0, 4);
        return (
          <article key={d.name} className="slds-card">
            <div className="slds-card__header slds-grid">
              <header className="slds-media slds-media_center">
                <div className="slds-media__figure"><ObjectIcon object={d.name} /></div>
                <div className="slds-media__body"><h2 className="slds-card__header-title"><Link className="slds-card__header-link" to={`${listUrl(d.name)}?q=${encodeURIComponent(q)}`}>{d.labelPlural}</Link></h2></div>
              </header>
            </div>
            <div className="slds-card__body">
              <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-table_fixed-layout crm-table">
                <thead><tr>{cols.map((c) => <th key={c} scope="col"><div className="slds-truncate">{fieldOf(d, c)?.label}</div></th>)}</tr></thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.Id}>{cols.map((c, i) => (
                      <td key={c} data-label={fieldOf(d, c)?.label}><div className="slds-truncate">
                        {i === 0 ? <Link to={recordUrl(d.name, r.Id)}>{String(r[c] ?? "") || "(no name)"}</Link> : <FieldValue field={fieldOf(d, c)} value={r[c]} names={names} />}
                      </div></td>
                    ))}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        );
      })}
    </div>
  );
}
