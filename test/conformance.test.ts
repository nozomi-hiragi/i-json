import { describe, expect, it } from "vitest";
import { isIJson } from "../src/index.js";
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

const toInput = (input: string | number[]) => (typeof input === "string" ? input : new Uint8Array(input));

describe("isIJson conformance", () => {
  it.each(cases)("$id", (c) => {
    expect(isIJson(toInput(c.input))).toBe(c.valid);
  });

  it.each(cases)("$id (strict)", (c) => {
    expect(isIJson(toInput(c.input), { strict: true })).toBe(c.validStrict ?? c.valid);
  });
});
