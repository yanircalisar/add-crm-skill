// Salesforce-style record IDs.
// 15-char ID = 3-char key prefix (object type) + 12 chars; the 18-char form adds a 3-char case-safe suffix
// so IDs stay unique in case-insensitive tools. We always store and return the 18-char form.

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SUFFIX_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ012345";

/** Case-safe 3-char suffix for a 15-char ID. */
export function checksum(id15: string): string {
  let out = "";
  for (let chunk = 0; chunk < 3; chunk++) {
    let flags = 0;
    for (let i = 0; i < 5; i++) {
      const c = id15.charCodeAt(chunk * 5 + i);
      if (c >= 65 && c <= 90) flags |= 1 << i; // uppercase A-Z
    }
    out += SUFFIX_CHARS[flags];
  }
  return out;
}

export function to18(id15: string): string {
  if (!/^[a-zA-Z0-9]{15}$/.test(id15)) throw new Error("Invalid 15-character ID");
  return id15 + checksum(id15);
}

/** New 18-char ID for an object key prefix, e.g. newId("001") for an Account. */
export function newId(keyPrefix: string): string {
  if (!/^[a-zA-Z0-9]{3}$/.test(keyPrefix)) throw new Error("Invalid key prefix");
  const rand = crypto.getRandomValues(new Uint8Array(9));
  // 2-char instance + 1 reserved char + 9 random base62 chars
  const body = "1" + "0" + "0" + [...rand].map((b) => BASE62[b % 62]).join("");
  return to18(keyPrefix + body);
}

/** True for a well-formed 18-char ID whose suffix matches. */
export function isValidId(id: unknown): id is string {
  return typeof id === "string" && /^[a-zA-Z0-9]{18}$/.test(id) && checksum(id.slice(0, 15)) === id.slice(15);
}

/** Accept 15 or 18 chars; return the canonical 18-char ID, or null. */
export function normalizeId(id: unknown): string | null {
  if (typeof id !== "string") return null;
  if (/^[a-zA-Z0-9]{15}$/.test(id)) return to18(id);
  if (/^[a-zA-Z0-9]{18}$/.test(id)) {
    const fixed = to18(id.slice(0, 15));
    return fixed.slice(15) === id.slice(15).toUpperCase() ? fixed : null;
  }
  return null;
}

export const keyPrefixOf = (id: string) => id.slice(0, 3);
