// SLDS icons (CC BY-ND 4.0, used unmodified — see NOTICE.md). Sprites are bundled by Vite as static assets.
import standardSprite from "@salesforce-ux/design-system/assets/icons/standard-sprite/svg/symbols.svg?url";
import utilitySprite from "@salesforce-ux/design-system/assets/icons/utility-sprite/svg/symbols.svg?url";

const SPRITES = { standard: standardSprite, utility: utilitySprite };

/** SLDS icon name for each CRM object. */
export const OBJECT_ICONS: Record<string, string> = {
  leads: "lead",
  accounts: "account",
  contacts: "contact",
  opportunities: "opportunity",
  cases: "case",
  tasks: "task",
  activities: "event",
};

/** Colored square object icon, e.g. the orange Account icon. */
export function ObjectIcon({ object, size = "small", className = "" }: { object: string; size?: "x-small" | "small" | "medium" | "large"; className?: string }) {
  const name = OBJECT_ICONS[object] ?? "default";
  return (
    <span className={`slds-icon_container slds-icon-standard-${name} ${className}`} title={object}>
      <svg className={`slds-icon slds-icon_${size}`} aria-hidden="true">
        <use href={`${SPRITES.standard}#${name}`} />
      </svg>
      <span className="slds-assistive-text">{object}</span>
    </span>
  );
}

/** Gray utility icon, for use inside buttons and inputs. */
export function UtilityIcon({ name, className = "slds-button__icon", label }: { name: string; className?: string; label?: string }) {
  return (
    <>
      <svg className={className} aria-hidden="true">
        <use href={`${SPRITES.utility}#${name}`} />
      </svg>
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
