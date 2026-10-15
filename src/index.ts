/**
 * I-JSON (RFC 7493) parser, serializer and validator.
 */

export { IJsonError, type IJsonRule, type Options } from "./errors.ts";
export { isIJson, parse, type JsonValue } from "./parse.ts";
export { stringify } from "./stringify.ts";
