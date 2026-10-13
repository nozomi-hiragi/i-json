# i-json

Strict JSON parser, serializer and validator conforming to [I-JSON (RFC 7493)](https://www.rfc-editor.org/rfc/rfc7493).

> Status: work in progress. Not yet published.

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

## License

[MIT](./LICENSE)
