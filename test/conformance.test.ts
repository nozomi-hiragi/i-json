import { describe, expect, it } from "vitest";
import { cases } from "./cases.js";

describe("case list", () => {
  it("has unique ids", () => {
    const ids = cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Sanity check the grammar cases against the platform parser, which follows
  // RFC 8259 but none of the I-JSON restrictions.
  it.each(cases.filter((c) => c.rule === "grammar"))("$id agrees with JSON.parse", (c) => {
    const parses = (() => {
      try {
        JSON.parse(c.input as string);
        return true;
      } catch {
        return false;
      }
    })();
    expect(parses).toBe(c.valid);
  });
});

// Enabled once the validator is implemented (plan step 3).
describe.skip("isIJson conformance", () => {
  it.each(cases)("$id", async (c) => {
    const { isIJson } = await import("../src/index.js");
    const input = typeof c.input === "string" ? c.input : new Uint8Array(c.input);
    expect(isIJson(input as string)).toBe(c.valid);
  });
});
