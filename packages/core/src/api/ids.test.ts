import { describe, expect, it } from "vitest";
import { checksum, to18, newId, isValidId, normalizeId, keyPrefixOf } from "./ids.js";

describe("Salesforce-style IDs", () => {
  it("computes the case-safe suffix", () => {
    // "001A0" -> uppercase at position 3 -> 8 -> "I"; "00000" -> "A"; "6Vm9r" -> position 1 -> 2 -> "C"
    expect(checksum("001A0000006Vm9r")).toBe("IAC");
    expect(to18("001A0000006Vm9r")).toBe("001A0000006Vm9rIAC");
  });
  it("creates valid 18-char IDs with the object's key prefix", () => {
    const id = newId("001");
    expect(id).toHaveLength(18);
    expect(keyPrefixOf(id)).toBe("001");
    expect(isValidId(id)).toBe(true);
    expect(newId("001")).not.toBe(id);
  });
  it("rejects tampered or malformed IDs", () => {
    const id = newId("006");
    const bad = id.slice(0, 15) + (id.slice(15) === "AAA" ? "BBB" : "AAA");
    expect(isValidId(bad)).toBe(false);
    expect(isValidId("not-an-id")).toBe(false);
    expect(isValidId(42)).toBe(false);
  });
  it("normalizes 15-char IDs and lower-case suffixes to the canonical 18-char form", () => {
    expect(normalizeId("001A0000006Vm9r")).toBe("001A0000006Vm9rIAC");
    expect(normalizeId("001A0000006Vm9riac")).toBe("001A0000006Vm9rIAC");
    expect(normalizeId("001A0000006Vm9rXXX")).toBeNull();
    expect(normalizeId("'; DROP TABLE")).toBeNull();
  });
});
