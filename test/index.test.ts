import { describe, expect, it } from "vitest";
import { IJsonError, parse, stringify } from "../src/index.js";
import { cases } from "./cases.js";

const errorOf = (fn: () => unknown): IJsonError => {
  try {
    fn();
  } catch (error) {
    if (error instanceof IJsonError) return error;
    throw error;
  }
  throw new Error("expected an IJsonError");
};

describe("parse", () => {
  it.each(cases.filter((c) => c.valid && typeof c.input === "string"))("$id matches JSON.parse", (c) => {
    expect(parse(c.input as string)).toEqual(JSON.parse(c.input as string));
  });

  it("decodes UTF-8 bytes", () => {
    expect(parse(new TextEncoder().encode('{"a":"日本😀"}'))).toEqual({ a: "日本😀" });
  });

  it("keeps __proto__ as an own property", () => {
    const value = parse('{"__proto__":{"polluted":true}}') as Record<string, unknown>;
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
    expect(Object.keys(value)).toEqual(["__proto__"]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("reports the rule and position", () => {
    const error = errorOf(() => parse('{"a":1,"a":2}'));
    expect(error.rule).toBe("duplicates");
    expect(error.position).toBe(7);
    expect(errorOf(() => parse('["\\uDEAD"]')).rule).toBe("characters");
    expect(errorOf(() => parse(new Uint8Array([0xff]))).rule).toBe("encoding");
    expect(errorOf(() => parse("[1E400]", { strict: true })).rule).toBe("numbers");
    expect(errorOf(() => parse("1", { strict: true })).rule).toBe("top-level");
  });

  it("limits nesting depth", () => {
    expect(parse("[".repeat(512) + "]".repeat(512))).toBeDefined();
    expect(errorOf(() => parse("[".repeat(513) + "]".repeat(513))).rule).toBe("depth");
    expect(errorOf(() => parse("[[[]]]", { maxDepth: 2 })).rule).toBe("depth");
  });

  it("returns Infinity for overflow outside strict mode", () => {
    expect(parse("[1E400]")).toEqual([Infinity]);
  });
});

describe("stringify", () => {
  it("serializes like JSON.stringify for plain data", () => {
    const value = { a: [1, -0, 1.5, "é😀", true, null], b: { c: "\n\"" } };
    expect(stringify(value)).toBe(JSON.stringify(value));
  });

  it("round-trips every valid string case", () => {
    for (const c of cases.filter((c) => c.valid && c.validStrict !== false && typeof c.input === "string")) {
      const text = stringify(parse(c.input as string));
      expect(stringify(parse(text))).toBe(text);
    }
  });

  it("uses toJSON", () => {
    expect(stringify({ d: new Date(0) })).toBe('{"d":"1970-01-01T00:00:00.000Z"}');
  });

  it.each([
    ["undefined", [undefined]],
    ["function", [() => 1]],
    ["symbol", [Symbol("s")]],
    ["bigint", [1n]],
    ["NaN", [NaN]],
    ["Infinity", [Infinity]],
    ["Map", [new Map()]],
    ["class instance", [new (class Foo {})()]],
  ])("rejects %s", (_name, value) => {
    expect(errorOf(() => stringify(value)).rule).toBe("value");
  });

  it("rejects array holes", () => {
    // eslint-disable-next-line no-sparse-arrays
    expect(errorOf(() => stringify([, 1])).rule).toBe("value");
    expect(errorOf(() => stringify(new Array(1))).rule).toBe("value");
  });

  it("rejects enumerable symbol-keyed properties", () => {
    expect(errorOf(() => stringify({ [Symbol("id")]: 1 })).rule).toBe("value");
    const hidden = {};
    Object.defineProperty(hidden, Symbol("hidden"), { value: 1, enumerable: false });
    expect(stringify(hidden)).toBe("{}");
  });

  it("rejects data on arrays that JSON would drop", () => {
    const withSymbol: unknown[] = [];
    (withSymbol as unknown as Record<symbol, number>)[Symbol("id")] = 1;
    expect(errorOf(() => stringify(withSymbol)).rule).toBe("value");
    const withName = Object.assign([1], { extra: 2 });
    expect(errorOf(() => stringify(withName)).rule).toBe("value");
  });

  it("passes the property key to toJSON", () => {
    const keyed = { toJSON: (key: string) => key };
    expect(stringify({ a: keyed, b: [keyed] })).toBe(JSON.stringify({ a: keyed, b: [keyed] }));
    expect(stringify(keyed)).toBe('""');
  });

  it("rejects cycles", () => {
    const a: unknown[] = [];
    a.push(a);
    expect(errorOf(() => stringify(a)).rule).toBe("value");
  });

  it("rejects unpaired surrogates and noncharacters in strings and names", () => {
    expect(errorOf(() => stringify(["\uD800"])).rule).toBe("characters");
    expect(errorOf(() => stringify({ "\uDEAD": 1 })).rule).toBe("characters");
    expect(errorOf(() => stringify(["￿"])).rule).toBe("characters");
    expect(stringify(["😀"])).toBe('["😀"]');
  });

  it("applies strict checks", () => {
    expect(stringify(1)).toBe("1");
    expect(errorOf(() => stringify(1, { strict: true })).rule).toBe("top-level");
    expect(stringify([2 ** 53])).toBe("[9007199254740992]");
    expect(errorOf(() => stringify([2 ** 53], { strict: true })).rule).toBe("numbers");
    expect(errorOf(() => stringify(new Date(0), { strict: true })).rule).toBe("top-level");
    expect(stringify({ toJSON: () => [1] }, { strict: true })).toBe("[1]");
  });
});
