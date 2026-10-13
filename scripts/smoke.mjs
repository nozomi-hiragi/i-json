// Checks the built package on the oldest supported Node versions, where the
// test tooling does not run.
import assert from "node:assert/strict";
import { IJsonError, isIJson, parse, stringify } from "../dist/index.js";

assert.deepEqual(parse('{"a":[1,"x",null]}'), { a: [1, "x", null] });
assert.deepEqual(parse(new TextEncoder().encode('["é"]')), ["é"]);
assert.equal(stringify({ a: [1, "x"] }), '{"a":[1,"x"]}');
assert.equal(isIJson('{"a":1,"a":2}'), false);
assert.equal(isIJson(new Uint8Array([0x5b, 0x22, 0xff, 0x22, 0x5d])), false);
assert.equal(isIJson("[1e400]"), true);
assert.equal(isIJson("[1e400]", { strict: true }), false);
assert.throws(() => stringify([NaN]), IJsonError);
console.log(`smoke ok on Node ${process.version}`);
