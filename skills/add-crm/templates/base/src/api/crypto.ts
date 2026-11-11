// Password hashing (PBKDF2-SHA256 via WebCrypto) and token helpers. Works in Workers and Node 20+.
const ITERATIONS = 100_000; // Workers caps PBKDF2 at 100k iterations
const enc = new TextEncoder();

const toHex = (buf: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex: string) => new Uint8Array((hex.match(/../g) ?? []).map((h) => parseInt(h, 16)));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return toHex(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return ["pbkdf2", ITERATIONS, toHex(salt), await derive(password, salt, ITERATIONS)].join("$");
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, iter, saltHex, hashHex] = stored.split("$");
  if (scheme !== "pbkdf2" || !iter || !saltHex || !hashHex) return false;
  const actual = await derive(password, fromHex(saltHex), Number(iter));
  return timingSafeEqual(actual, hashHex);
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function randomToken(bytes = 32): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256(input: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(input)));
}

