# Test cases

The conformance cases live in [`test/cases.ts`](../test/cases.ts). Each case names the rule it exercises, its input (a string, or raw bytes for encoding checks) and whether it is a valid I-JSON message.

`test/conformance.test.ts` checks the grammar cases against `JSON.parse` today and runs every case against `isIJson` once the validator exists.

## Rules

| Rule | Source | Requirement |
| --- | --- | --- |
| `grammar` | RFC 8259 | Strict JSON syntax: no comments, trailing commas, `NaN`, leading zeros or trailing data |
| `encoding` | RFC 7493 §2.1 | MUST be UTF-8; malformed, overlong and surrogate byte sequences are rejected |
| `characters` | RFC 7493 §2.1 | Names and strings MUST NOT contain surrogates or noncharacters, raw or escaped |
| `numbers` | RFC 7493 §2.2 | SHOULD NOT exceed IEEE 754 double magnitude or precision |
| `duplicates` | RFC 7493 §2.3 | Objects MUST NOT have duplicate member names |
| `top-level` | RFC 7493 §4.1 | Protocols SHOULD NOT use scalar top-level values |

## Decisions

RFC 7493 leaves some points as SHOULD or to the receiver. These are the defaults the cases encode; options to relax or tighten them can come later.

- **UTF-8 BOM is rejected.** RFC 8259 forbids generating one and allows parsers to ignore it; a strict profile rejects it.
- **Number overflow is rejected.** `1E400` and anything that rounds to ±Infinity is invalid.
- **Integer literals beyond ±(2^53−1) are rejected.** A literal with no fraction or exponent must be a safe integer. `1e300` is accepted because it is not written as an integer.
- **Nonzero literals that underflow to 0 are rejected** (`1e-400`).
- **Excess decimal precision is accepted.** `3.141592653589793238462643383279` rounds to the nearest double like every other fraction.
- **Duplicate names are compared after unescaping, by code point.** `"a"` and `"a"` collide; `"é"` (U+00E9) and `"é"` do not, since no Unicode normalization is applied.
- **Scalar top-level values are accepted.** §4.1 is advice to protocol designers, so it fits better as an opt-in option.

## Out of scope for now

RFC 7493 §4.3 (ISO 8601 dates) and §4.4 (base64url binary) are protocol-design recommendations about string contents. They may become optional helpers later.
