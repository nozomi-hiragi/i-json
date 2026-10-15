# i-json

Strict JSON parser, serializer and validator conforming to [I-JSON (RFC 7493)](https://www.rfc-editor.org/rfc/rfc7493).

[![CI](https://github.com/nozomi-hiragi/i-json/actions/workflows/ci.yml/badge.svg)](https://github.com/nozomi-hiragi/i-json/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@nozomi-hiragi/i-json)](https://www.npmjs.com/package/@nozomi-hiragi/i-json)
[![JSR](https://jsr.io/badges/@nozomi-hiragi/i-json)](https://jsr.io/@nozomi-hiragi/i-json)

## What I-JSON requires

I-JSON is a restricted profile of JSON ([RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)) designed for interoperability. An I-JSON message must:

- be encoded in UTF-8
- contain no unpaired surrogates or noncharacters in strings, including when escaped (`"\uDEAD"`)
- have no duplicate member names within an object
- use only numbers representable as IEEE 754 double-precision values (integers should be within ±(2^53 − 1))

## Install

```sh
npm install @nozomi-hiragi/i-json
```

Also on [JSR](https://jsr.io/@nozomi-hiragi/i-json) for Deno and other runtimes:

```sh
deno add jsr:@nozomi-hiragi/i-json
# or: npx jsr add @nozomi-hiragi/i-json
```

## Usage

```ts
import { isIJson, parse, stringify, IJsonError } from "@nozomi-hiragi/i-json";

isIJson('{"a":1}'); // true
isIJson('{"a":1,"a":2}'); // false: duplicate member name

parse('{"name":"i-json"}'); // { name: "i-json" }
parse(new Uint8Array(bytes)); // UTF-8 bytes are validated too

try {
  parse('["\\uDEAD"]');
} catch (error) {
  if (error instanceof IJsonError) {
    error.rule; // "characters"
    error.position; // 2 (index of the escape)
  }
}

stringify({ a: [1, "x"] }); // '{"a":[1,"x"]}'
stringify({ a: undefined }); // throws IJsonError instead of dropping the member
```

`parse` and `isIJson` accept a string or UTF-8 bytes. `stringify` throws on anything `JSON.stringify` would silently drop or change: `undefined`, functions, symbols (as values or keys), bigints, `NaN` and `Infinity`, cycles, array holes and non-index array properties, non-plain objects (objects with `toJSON` are allowed), and strings with unpaired surrogates or noncharacters.

### Options

| Option | Default | Effect |
| --- | --- | --- |
| `strict` | `false` | Also enforce the RFC 7493 SHOULD rules: a number must be written with the same value as the shortest representation of the double it parses to (no overflow, underflow, excess digits, or integer literals beyond ±(2^53−1)), and the top-level value must be an object or array. |
| `maxDepth` | `512` | Maximum nesting of arrays and objects. |

By default only the MUST rules are enforced, since a message that breaks a SHOULD rule is still I-JSON. See [docs/test-cases.md](./docs/test-cases.md) for every rule and decision.

## License

[MIT](./LICENSE)
