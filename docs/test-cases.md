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

## MUST versus SHOULD

A message that breaks only a SHOULD is still an I-JSON message. So by default the library enforces the MUST rules (grammar, UTF-8, characters, duplicate names) and accepts everything else. The SHOULD rules are opt-in checks; each case's `validStrict` gives the expected result with all of them enabled.

Opt-in SHOULD checks:

- **Numbers beyond IEEE 754 double** (§2.2): literals that overflow to ±Infinity (`1E400`), integer literals beyond ±(2^53−1), and nonzero literals that underflow to 0 (`1e-400`). Literals with more precision than a double holds (`3.141592653589793238462643383279`) are also rejected: a literal passes only if it has the same decimal value as the shortest representation of the double it parses to, so `0.1` and `1.10` pass. `1e300` is not an integer literal, so the safe-integer check does not apply to it.
- **Scalar top-level values** (§4.1): strict mode requires an object or array.

Other decisions:

- **UTF-8 BOM is rejected.** RFC 8259 forbids generating one, so a message carrying it is not a conforming JSON text.
- **Duplicate names are compared after unescaping, by code point.** `"a"` and `"\u0061"` collide; `"é"` (U+00E9) and `"e\u0301"` do not, since no Unicode normalization is applied.

## Out of scope for now

RFC 7493 §4.3 (ISO 8601 dates) and §4.4 (base64url binary) are protocol-design recommendations about string contents. They may become optional helpers later.
