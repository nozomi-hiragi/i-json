import { DEFAULT_MAX_DEPTH, IJsonError, isNoncharacter, type Options } from "./errors.js";

/**
 * Serializes `value` as an I-JSON message. Throws `IJsonError` instead of
 * silently dropping or changing anything JSON.stringify would: `undefined`,
 * functions, symbols (as values or keys), bigints, NaN and Infinity, cycles,
 * array holes and non-index array properties, strings with surrogates or
 * noncharacters, and objects other than plain objects and arrays (an object
 * with a `toJSON` method is serialized by its result).
 */
export function stringify(value: unknown, options: Options = {}): string {
  const strict = options.strict ?? false;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const stack = new Set<object>();

  const write = (input: unknown, key: string, path: string): string => writeResolved(resolve(input, key), path);

  const writeResolved = (v: unknown, path: string): string => {
    switch (typeof v) {
      case "string":
        return writeString(v, path);
      case "boolean":
        return v ? "true" : "false";
      case "number":
        if (!Number.isFinite(v)) fail(`${v} is not a JSON number`, path);
        if (strict && Number.isInteger(v) && !Number.isSafeInteger(v)) {
          throw new IJsonError(`Integer at ${path} is outside ±(2^53−1)`, "numbers");
        }
        return JSON.stringify(v);
      case "object": {
        if (v === null) return "null";
        if (stack.has(v)) fail("Circular reference", path);
        if (stack.size >= maxDepth) throw new IJsonError(`Nesting deeper than ${maxDepth}`, "depth");
        stack.add(v);
        if (Object.getOwnPropertySymbols(v).some((sym) => Object.prototype.propertyIsEnumerable.call(v, sym))) {
          fail("Symbol-keyed property", path);
        }
        let out: string;
        if (Array.isArray(v)) {
          // Snapshot the length first, as JSON.stringify does.
          const length = v.length;
          for (const key of Object.keys(v)) {
            if (String(Number(key) >>> 0) !== key || Number(key) >= length) {
              fail("Array has non-index properties", path);
            }
          }
          const items: string[] = [];
          for (let i = 0; i < length; i++) {
            if (!(i in v)) fail("Array hole", `${path}[${i}]`);
            items.push(write(v[i], String(i), `${path}[${i}]`));
          }
          out = `[${items.join(",")}]`;
        } else {
          const proto = Object.getPrototypeOf(v);
          if (proto !== Object.prototype && proto !== null) {
            fail(`${proto?.constructor?.name ?? "Object"} is not a plain object`, path);
          }
          out = `{${Object.keys(v)
            .map((key) => `${writeString(key, path)}:${write((v as Record<string, unknown>)[key], key, `${path}.${key}`)}`)
            .join(",")}}`;
        }
        stack.delete(v);
        return out;
      }
      default:
        return fail(`${typeof v} is not a JSON value`, path);
    }
  };

  const top = resolve(value, "");
  if (strict && (top === null || typeof top !== "object")) {
    throw new IJsonError("Top-level value must be an object or array", "top-level");
  }
  return writeResolved(top, "$");
}

function writeString(s: string, path: string): string {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    let cp = code;
    if (code >= 0xd800 && code <= 0xdfff) {
      const low = s.charCodeAt(i + 1);
      if (code > 0xdbff || !(low >= 0xdc00 && low <= 0xdfff)) {
        throw new IJsonError(`Unpaired surrogate in string at ${path}`, "characters");
      }
      cp = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
      i++;
    }
    if (isNoncharacter(cp)) {
      throw new IJsonError(`Noncharacter U+${cp.toString(16).toUpperCase()} in string at ${path}`, "characters");
    }
  }
  return JSON.stringify(s);
}

/** Applies `toJSON` once with the property key, as JSON.stringify does. */
function resolve(v: unknown, key: string): unknown {
  if (typeof v !== "object" || v === null) return v;
  // Read toJSON once, so an accessor cannot change between check and call.
  const toJSON: unknown = (v as { toJSON?: unknown }).toJSON;
  return typeof toJSON === "function" ? toJSON.call(v, key) : v;
}

function fail(message: string, path: string): never {
  throw new IJsonError(`${message} at ${path}`, "value");
}
