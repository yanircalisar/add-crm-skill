import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, formatValue, recordName } from "../api";
import { NAV, useMeta } from "../App";
import { ObjectIcon, Spinner } from "../Icon";

/** Global search results, grouped by object (top 5 each). */
export function Search() {
  const meta = useMeta();
  const q = useSearchParams()[0].get("q") ?? "";
  const [results, setResults] = useState<Record<string, any[]> | null>(null);
  const objects = NAV.filter((o) => meta.objects[o]);

  useEffect(() => {
    setResults(null);
    Promise.all(objects.map((o) =>
      api<{ records: any[] }>(`/o/${o}?q=${encodeURIComponent(q)}&limit=5`).then((r) => [o, r.records] as const).catch(() => [o, []] as const),
    )).then((pairs) => setResults(Object.fromEntries(pairs)));
  }, [q]);

  if (!results) return <Spinner />;
  const hits = objects.filter((o) => results[o]?.length);

  return (
    <div>
      <div className="slds-page-header slds-m-bottom_small">
        <h1 className="slds-page-header__title">Search Results for “{q}”</h1>
      </div>
      {hits.length === 0 && (
        <article className="slds-card"><div className="slds-card__body slds-card__body_inner slds-p-vertical_large slds-text-align_center">
          <h2 className="slds-text-heading_medium">Don't give up yet!</h2>
          <p className="slds-text-color_weak">No results for “{q}”. Check the spelling or try different keywords.</p>
        </div></article>
      )}
      {hits.map((o) => {
        const def = meta.objects[o];
        const cols = def.listFields.slice(0, 4);
        return (
          <article key={o} className="slds-card">
            <div className="slds-card__header slds-grid">
              <header className="slds-media slds-media_center">
                <div className="slds-media__figure"><ObjectIcon object={o} /></div>
                <div className="slds-media__body"><h2 className="slds-card__header-title">
                  <Link className="slds-card__header-link" to={`/o/${o}?q=${encodeURIComponent(q)}`}>{def.plural}</Link>
                </h2></div>
              </header>
            </div>
            <div className="slds-card__body">
              <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-table_fixed-layout crm-table">
                <thead><tr>{cols.map((c) => <th key={c} scope="col"><div className="slds-truncate">{def.fields.find((f) => f.name === c)?.label}</div></th>)}</tr></thead>
                <tbody>
                  {results[o]!.map((r) => (
                    <tr key={r.id}>{cols.map((c, i) => {
                      const f = def.fields.find((x) => x.name === c);
                      return <td key={c} data-label={f?.label}><div className="slds-truncate">{i === 0 ? <Link to={`/o/${o}/${r.id}`}>{recordName(def, r)}</Link> : formatValue(f, r[c])}</div></td>;
                    })}</tr>
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
