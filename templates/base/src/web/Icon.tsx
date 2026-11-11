// Our own icon set (MIT, part of this project). SLDS supplies only CSS; vendor icons are not used
// (see docs/legal-and-sources.md). Each glyph is drawn on a 24x24 grid with simple shapes.

const GLYPHS: Record<string, React.ReactNode> = {
  // object glyphs (white on a colored tile)
  Lead: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-4 3.1-6.5 7-6.5s7 2.5 7 6.5z" /><path d="M17 3l1 2 2 .3-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1L14 5.3l2-.3z" /></>,
  Account: <><path d="M4 21V7l8-4 8 4v14z" /><path fill="var(--crm-icon-bg)" d="M8 10h2v2H8zm6 0h2v2h-2zM8 14h2v2H8zm6 0h2v2h-2zm-3 3h2v4h-2z" /></>,
  Contact: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle fill="var(--crm-icon-bg)" cx="9" cy="10" r="2.5" /><path fill="var(--crm-icon-bg)" d="M5 17c0-2.2 1.8-3.5 4-3.5s4 1.3 4 3.5zM14 9h5v1.5h-5zm0 3h4v1.5h-4z" /></>,
  Opportunity: <><path d="M3 18h18v2H3z" /><path d="M5 16l4-6 4 3 6-8v11z" /></>,
  Case: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2h-1.5V5.5h-3V7z" /></>,
  Task: <><rect x="4" y="3" width="16" height="18" rx="2" /><path fill="none" stroke="var(--crm-icon-bg)" strokeWidth="2" d="M7.5 9l1.5 1.5 3-3M7.5 15l1.5 1.5 3-3M14 9h3M14 15h3" /></>,
  Event: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3h2v4H7zm8 0h2v4h-2z" /><path fill="var(--crm-icon-bg)" d="M5 10h14v9H5z" /><path d="M7 12h3v3H7z" /></>,
  Call: <path d="M7 3l3 4-2 2a11 11 0 006 6l2-2 4 3-2 4C10 20 4 14 3 5z" />,
  Email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path fill="none" stroke="var(--crm-icon-bg)" strokeWidth="2" d="M4 7l8 6 8-6" /></>,
  Note: <><path d="M5 3h10l4 4v14H5z" /><path fill="var(--crm-icon-bg)" d="M8 10h8v1.5H8zm0 3h8v1.5H8zm0 3h5v1.5H8z" /></>,
  Home: <path d="M12 3l9 8h-3v9h-4v-6h-4v6H6v-9H3z" />,
  User: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" /></>,
  Custom: <><path d="M12 2l9 5v10l-9 5-9-5V7z" /></>,
  // utility glyphs (single color, currentColor)
  search: <path d="M10 3a7 7 0 015.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1110 3zm0 2a5 5 0 100 10 5 5 0 000-10z" />,
  down: <path d="M5 8h14l-7 8z" />,
  arrowdown: <path d="M11 4h2v12l4-4 1.4 1.4L12 19.8 5.6 13.4 7 12l4 4z" />,
  close: <path d="M6.4 5L12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z" />,
  rows: <path d="M3 5h18v2H3zm0 6h18v2H3zm0 6h18v2H3z" />,
  refresh: <path d="M12 4a8 8 0 017.7 6h-2.1A6 6 0 106 13H4a8 8 0 018-9zm6-1v6h-6z" />,
  edit: <path d="M15 4l5 5-11 11H4v-5zm-1.4 3.4L6 15v3h3l7.6-7.6z" />,
  check: <path d="M9 16.2l-4.2-4.2-1.4 1.4L9 19 21 7l-1.4-1.4z" />,
  add: <path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z" />,
};

/** Tile color per object: our own palette. */
const COLORS: Record<string, string> = {
  Lead: "#f88962", Account: "#5867e8", Contact: "#a094ed", Opportunity: "#fcb95b", Case: "#f2cf5b",
  Task: "#3ba755", Event: "#cb65ff", Call: "#48c3cc", Email: "#939393", Note: "#e6d478", Home: "#ef6e64",
  User: "#65cae4", Custom: "#3c97dd",
};

function Svg({ name, className }: { name: string; className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {GLYPHS[name] ?? GLYPHS.Custom}
    </svg>
  );
}

/** Colored square object icon (the "tile" next to page titles). `object` is an API name, e.g. "Account". */
export function ObjectIcon({ object, size = "small", className = "" }: { object: string; size?: "x-small" | "small" | "medium" | "large"; className?: string }) {
  const name = GLYPHS[object] ? object : object.endsWith("__c") ? "Custom" : "Custom";
  const bg = COLORS[name] ?? COLORS.Custom;
  return (
    <span className={`slds-icon_container crm-icon ${className}`} style={{ background: bg, ["--crm-icon-bg" as string]: bg }} title={object}>
      <Svg name={name} className={`slds-icon slds-icon_${size}`} />
      <span className="slds-assistive-text">{object}</span>
    </span>
  );
}

/** Single-color utility icon, for buttons and inputs. */
export function UtilityIcon({ name, className = "slds-button__icon", label }: { name: string; className?: string; label?: string }) {
  return (
    <>
      <Svg name={name} className={className} />
      {label && <span className="slds-assistive-text">{label}</span>}
    </>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="slds-is-relative crm-spinner-box">
      <div role="status" className="slds-spinner slds-spinner_medium slds-spinner_brand">
        <span className="slds-assistive-text">{label}</span>
        <div className="slds-spinner__dot-a" />
        <div className="slds-spinner__dot-b" />
      </div>
    </div>
  );
}

export function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="slds-notify slds-notify_alert slds-alert_error slds-m-bottom_small" role="alert">
      <h2>{message}</h2>
    </div>
  );
}
