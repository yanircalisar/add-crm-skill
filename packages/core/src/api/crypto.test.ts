import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, randomToken, sha256, timingSafeEqual } from "./crypto.js";

describe("passwords", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h.startsWith("pbkdf2$")).toBe(true);
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
  it("salts hashes", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });
  it("rejects null or malformed hashes", async () => {
    expect(await verifyPassword("x", null)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
});

describe("tokens", () => {
  it("creates 64-char hex tokens that differ", () => {
    const a = randomToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(randomToken()).not.toBe(a);
  });
  it("hashes deterministically", async () => {
    expect(await sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("compares strings", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "ab")).toBe(false);
  });
});
