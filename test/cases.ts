/**
 * Conformance cases for I-JSON (RFC 7493) and the JSON grammar it builds on
 * (RFC 8259). See docs/test-cases.md for the rules and the decisions behind
 * each expected result.
 *
 * `input` is either a JS string (treated as already-decoded text) or a byte
 * array (to exercise UTF-8 validation).
 */

export type Rule =
  | "grammar" // RFC 8259 syntax
  | "encoding" // RFC 7493 §2.1: UTF-8 only
  | "characters" // RFC 7493 §2.1: no surrogates or noncharacters
  | "numbers" // RFC 7493 §2.2: IEEE 754 double range and precision
  | "duplicates" // RFC 7493 §2.3: no duplicate member names
  | "top-level"; // RFC 7493 §4.1

export interface Case {
  id: string;
  rule: Rule;
  input: string | number[];
  valid: boolean;
  note?: string;
}

const bytes = (...b: number[]): number[] => b;
const utf8 = (s: string): number[] => [...new TextEncoder().encode(s)];

export const cases: Case[] = [
  // --- grammar: valid ---
  { id: "grammar/empty-object", rule: "grammar", input: "{}", valid: true },
  { id: "grammar/empty-array", rule: "grammar", input: "[]", valid: true },
  { id: "grammar/simple-object", rule: "grammar", input: '{"a":1}', valid: true },
  { id: "grammar/literals", rule: "grammar", input: '[1,"a",true,false,null]', valid: true },
  { id: "grammar/nested", rule: "grammar", input: '{"a":[{"b":{"c":[]}}]}', valid: true },
  { id: "grammar/whitespace", rule: "grammar", input: ' \t\n\r{ "a" : [ 1 , 2 ] } \n', valid: true },
  { id: "grammar/escapes", rule: "grammar", input: '["\\"\\\\\\/\\b\\f\\n\\r\\t\\u0041"]', valid: true },

  // --- grammar: invalid ---
  { id: "grammar/empty-input", rule: "grammar", input: "", valid: false },
  { id: "grammar/whitespace-only", rule: "grammar", input: "  ", valid: false },
  { id: "grammar/trailing-comma-object", rule: "grammar", input: '{"a":1,}', valid: false },
  { id: "grammar/trailing-comma-array", rule: "grammar", input: "[1,]", valid: false },
  { id: "grammar/line-comment", rule: "grammar", input: "[1] // c", valid: false },
  { id: "grammar/block-comment", rule: "grammar", input: "[/* c */1]", valid: false },
  { id: "grammar/single-quotes", rule: "grammar", input: "['a']", valid: false },
  { id: "grammar/unquoted-key", rule: "grammar", input: "{a:1}", valid: false },
  { id: "grammar/nan", rule: "grammar", input: "[NaN]", valid: false },
  { id: "grammar/infinity", rule: "grammar", input: "[Infinity]", valid: false },
  { id: "grammar/leading-zero", rule: "grammar", input: "[01]", valid: false },
  { id: "grammar/leading-plus", rule: "grammar", input: "[+1]", valid: false },
  { id: "grammar/bare-fraction", rule: "grammar", input: "[.5]", valid: false },
  { id: "grammar/trailing-dot", rule: "grammar", input: "[1.]", valid: false },
  { id: "grammar/hex", rule: "grammar", input: "[0x10]", valid: false },
  { id: "grammar/raw-control-char", rule: "grammar", input: '["a\u0001b"]', valid: false },
  { id: "grammar/raw-newline-in-string", rule: "grammar", input: '["a\nb"]', valid: false },
  { id: "grammar/bad-escape", rule: "grammar", input: '["\\x41"]', valid: false },
  { id: "grammar/short-unicode-escape", rule: "grammar", input: '["\\u12"]', valid: false },
  { id: "grammar/unclosed-string", rule: "grammar", input: '["abc]', valid: false },
  { id: "grammar/unclosed-array", rule: "grammar", input: "[1,2", valid: false },
  { id: "grammar/multiple-values", rule: "grammar", input: "{} {}", valid: false },
  { id: "grammar/trailing-garbage", rule: "grammar", input: "[1]x", valid: false },

  // --- encoding: valid ---
  { id: "encoding/ascii-bytes", rule: "encoding", input: utf8('{"a":"b"}'), valid: true },
  { id: "encoding/2-byte", rule: "encoding", input: utf8('["é"]'), valid: true },
  { id: "encoding/3-byte", rule: "encoding", input: utf8('["日本"]'), valid: true },
  { id: "encoding/4-byte", rule: "encoding", input: utf8('["😀"]'), valid: true },

  // --- encoding: invalid ---
  { id: "encoding/lone-continuation", rule: "encoding", input: bytes(0x5b, 0x22, 0x80, 0x22, 0x5d), valid: false },
  { id: "encoding/overlong-slash", rule: "encoding", input: bytes(0x5b, 0x22, 0xc0, 0xaf, 0x22, 0x5d), valid: false },
  { id: "encoding/truncated-3-byte", rule: "encoding", input: bytes(0x5b, 0x22, 0xe6, 0x97, 0x22, 0x5d), valid: false },
  { id: "encoding/encoded-surrogate", rule: "encoding", input: bytes(0x5b, 0x22, 0xed, 0xa0, 0x80, 0x22, 0x5d), valid: false, note: "CESU-8 style U+D800" },
  { id: "encoding/above-max-code-point", rule: "encoding", input: bytes(0x5b, 0x22, 0xf4, 0x90, 0x80, 0x80, 0x22, 0x5d), valid: false },
  { id: "encoding/utf16le-bom", rule: "encoding", input: bytes(0xff, 0xfe, 0x5b, 0x00, 0x5d, 0x00), valid: false },
  { id: "encoding/utf8-bom", rule: "encoding", input: bytes(0xef, 0xbb, 0xbf, 0x5b, 0x5d), valid: false, note: "decision: reject; RFC 8259 forbids generating a BOM" },

  // --- characters: valid ---
  { id: "characters/escaped-pair", rule: "characters", input: '["\\uD800\\uDEAD"]', valid: true, note: "example from RFC 7493 §2.1" },
  { id: "characters/escaped-emoji", rule: "characters", input: '["\\uD83D\\uDE00"]', valid: true },
  { id: "characters/below-fdd0", rule: "characters", input: '["\\uFDCF"]', valid: true },
  { id: "characters/replacement-char", rule: "characters", input: '["\\uFFFD"]', valid: true },

  // --- characters: invalid ---
  { id: "characters/escaped-lone-low", rule: "characters", input: '["\\uDEAD"]', valid: false, note: "example from RFC 7493 §2.1" },
  { id: "characters/escaped-lone-high", rule: "characters", input: '["\\uD800"]', valid: false },
  { id: "characters/escaped-reversed-pair", rule: "characters", input: '["\\uDC00\\uD800"]', valid: false },
  { id: "characters/lone-surrogate-in-name", rule: "characters", input: '{"\\uDEAD":1}', valid: false },
  { id: "characters/raw-lone-surrogate", rule: "characters", input: '["\uD800"]', valid: false, note: "JS string holding an unpaired surrogate" },
  { id: "characters/noncharacter-fffe", rule: "characters", input: '["\\uFFFE"]', valid: false },
  { id: "characters/noncharacter-ffff", rule: "characters", input: '["\\uFFFF"]', valid: false },
  { id: "characters/noncharacter-fdd0", rule: "characters", input: '["\\uFDD0"]', valid: false },
  { id: "characters/noncharacter-fdef", rule: "characters", input: '["\\uFDEF"]', valid: false },
  { id: "characters/noncharacter-1fffe", rule: "characters", input: '["\\uD83F\\uDFFE"]', valid: false },
  { id: "characters/noncharacter-10ffff", rule: "characters", input: '["\\uDBFF\\uDFFF"]', valid: false },
  { id: "characters/noncharacter-raw-bytes", rule: "characters", input: utf8('["﷐"]'), valid: false },
  { id: "characters/noncharacter-in-name", rule: "characters", input: '{"\\uFFFF":1}', valid: false },

  // --- numbers: valid ---
  { id: "numbers/zero", rule: "numbers", input: "[0]", valid: true },
  { id: "numbers/negative-zero", rule: "numbers", input: "[-0]", valid: true },
  { id: "numbers/max-safe-integer", rule: "numbers", input: "[9007199254740991]", valid: true },
  { id: "numbers/min-safe-integer", rule: "numbers", input: "[-9007199254740991]", valid: true },
  { id: "numbers/fraction", rule: "numbers", input: "[1.5]", valid: true },
  { id: "numbers/max-double", rule: "numbers", input: "[1.7976931348623157e308]", valid: true },
  { id: "numbers/min-subnormal", rule: "numbers", input: "[5e-324]", valid: true },
  { id: "numbers/exponent-integer-value", rule: "numbers", input: "[1e300]", valid: true, note: "decision: the safe-integer limit applies only to integer literals" },
  { id: "numbers/excess-precision", rule: "numbers", input: "[3.141592653589793238462643383279]", valid: true, note: "decision: rounding a fraction to the nearest double is accepted" },

  // --- numbers: invalid ---
  { id: "numbers/overflow", rule: "numbers", input: "[1E400]", valid: false, note: "example from RFC 7493 §2.2" },
  { id: "numbers/negative-overflow", rule: "numbers", input: "[-1E400]", valid: false },
  { id: "numbers/just-over-max", rule: "numbers", input: "[1.8e308]", valid: false },
  { id: "numbers/unsafe-integer", rule: "numbers", input: "[9007199254740992]", valid: false, note: "decision: reject integer literals beyond ±(2^53−1)" },
  { id: "numbers/unsafe-negative-integer", rule: "numbers", input: "[-9007199254740992]", valid: false },
  { id: "numbers/underflow-to-zero", rule: "numbers", input: "[1e-400]", valid: false, note: "decision: a nonzero literal that rounds to 0 is rejected" },

  // --- duplicates: valid ---
  { id: "duplicates/case-differs", rule: "duplicates", input: '{"a":1,"A":2}', valid: true },
  { id: "duplicates/sibling-objects", rule: "duplicates", input: '[{"a":1},{"a":2}]', valid: true },
  { id: "duplicates/nested-same-name", rule: "duplicates", input: '{"a":{"a":1}}', valid: true },
  { id: "duplicates/not-normalized", rule: "duplicates", input: '{"\\u00e9":1,"e\\u0301":2}', valid: true, note: "names are compared by code points, without Unicode normalization" },

  // --- duplicates: invalid ---
  { id: "duplicates/simple", rule: "duplicates", input: '{"a":1,"a":2}', valid: false },
  { id: "duplicates/same-value", rule: "duplicates", input: '{"a":1,"a":1}', valid: false },
  { id: "duplicates/nested", rule: "duplicates", input: '{"x":{"a":1,"a":2}}', valid: false },
  { id: "duplicates/in-array", rule: "duplicates", input: '[{"a":1,"a":2}]', valid: false },
  { id: "duplicates/escape-equivalent", rule: "duplicates", input: '{"a":1,"\\u0061":2}', valid: false },
  { id: "duplicates/non-ascii-escape-equivalent", rule: "duplicates", input: '{"é":1,"\\u00e9":2}', valid: false },
  { id: "duplicates/empty-name", rule: "duplicates", input: '{"":1,"":2}', valid: false },

  // --- top-level ---
  { id: "top-level/number", rule: "top-level", input: "1", valid: true, note: "decision: allowed by default; §4.1 is advice to protocol designers" },
  { id: "top-level/string", rule: "top-level", input: '"a"', valid: true },
  { id: "top-level/null", rule: "top-level", input: "null", valid: true },
];
