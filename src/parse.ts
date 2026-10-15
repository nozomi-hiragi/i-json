import { DEFAULT_MAX_DEPTH, IJsonError, isNoncharacter, type Options } from "./errors.ts";

/** A JSON value as produced by `parse`. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

// A run of string characters that need no further checks.
const PLAIN_CHARS = /[^"\\\u0000-\u001f\ud800-\udfff\ufdd0-\ufdef\ufffe\uffff]*/y;

/**
 * Parses an I-JSON message. `input` is either text or UTF-8 bytes.
 * Throws `IJsonError` naming the broken rule when the input is not I-JSON.
 */
export function parse(input: string | Uint8Array, options: Options = {}): JsonValue {
  const text = typeof input === "string" ? input : decodeUtf8(input);
  if (text.charCodeAt(0) === 0xfeff) {
    throw new IJsonError("Byte order mark is not allowed", "encoding", 0);
  }
  return new Parser(text, options).parseMessage();
}

/** Reports whether `input` is an I-JSON message. */
export function isIJson(input: string | Uint8Array, options: Options = {}): boolean {
  try {
    parse(input, options);
    return true;
  } catch (error) {
    if (error instanceof IJsonError) return false;
    throw error;
  }
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return decoder.decode(bytes);
  } catch {
    throw new IJsonError("Input is not valid UTF-8", "encoding");
  }
}

class Parser {
  private pos = 0;
  private depth = 0;
  private readonly strict: boolean;
  private readonly maxDepth: number;

  constructor(
    private readonly text: string,
    options: Options,
  ) {
    this.strict = options.strict ?? false;
    this.maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  }

  parseMessage(): JsonValue {
    this.skipWhitespace();
    const start = this.pos;
    const value = this.parseValue();
    this.skipWhitespace();
    if (this.pos < this.text.length) this.fail("Unexpected data after the value");
    if (this.strict && (value === null || typeof value !== "object")) {
      throw new IJsonError("Top-level value must be an object or array", "top-level", start);
    }
    return value;
  }

  private parseValue(): JsonValue {
    const c = this.text[this.pos];
    switch (c) {
      case "{":
        return this.parseObject();
      case "[":
        return this.parseArray();
      case '"':
        return this.parseString();
      case "t":
        return this.parseLiteral("true", true);
      case "f":
        return this.parseLiteral("false", false);
      case "n":
        return this.parseLiteral("null", null);
      default:
        if (c === "-" || (c !== undefined && c >= "0" && c <= "9")) return this.parseNumber();
        return this.fail(c === undefined ? "Unexpected end of input" : `Unexpected character ${JSON.stringify(c)}`);
    }
  }

  private parseObject(): JsonValue {
    this.enter();
    this.pos++; // {
    const result: { [key: string]: JsonValue } = {};
    const seen = new Set<string>();
    this.skipWhitespace();
    if (this.text[this.pos] === "}") {
      this.pos++;
      this.depth--;
      return result;
    }
    for (;;) {
      if (this.text[this.pos] !== '"') this.fail("Expected a member name");
      const keyStart = this.pos;
      const key = this.parseString();
      if (seen.has(key)) {
        throw new IJsonError(`Duplicate member name ${JSON.stringify(key)}`, "duplicates", keyStart);
      }
      seen.add(key);
      this.skipWhitespace();
      this.expect(":");
      this.skipWhitespace();
      // defineProperty so a "__proto__" member stays an own property.
      Object.defineProperty(result, key, {
        value: this.parseValue(),
        enumerable: true,
        writable: true,
        configurable: true,
      });
      this.skipWhitespace();
      if (this.text[this.pos] === ",") {
        this.pos++;
        this.skipWhitespace();
        continue;
      }
      this.expect("}");
      this.depth--;
      return result;
    }
  }

  private parseArray(): JsonValue {
    this.enter();
    this.pos++; // [
    const result: JsonValue[] = [];
    this.skipWhitespace();
    if (this.text[this.pos] === "]") {
      this.pos++;
      this.depth--;
      return result;
    }
    for (;;) {
      result.push(this.parseValue());
      this.skipWhitespace();
      if (this.text[this.pos] === ",") {
        this.pos++;
        this.skipWhitespace();
        continue;
      }
      this.expect("]");
      this.depth--;
      return result;
    }
  }

  private parseString(): string {
    const text = this.text;
    this.pos++; // opening quote
    let out = "";
    let chunkStart = this.pos;
    for (;;) {
      PLAIN_CHARS.lastIndex = this.pos;
      PLAIN_CHARS.test(text);
      this.pos = PLAIN_CHARS.lastIndex;
      const code = text.charCodeAt(this.pos);
      if (Number.isNaN(code)) this.fail("Unterminated string");
      if (code === 0x22) {
        out += text.slice(chunkStart, this.pos);
        this.pos++;
        return out;
      }
      if (code === 0x5c) {
        out += text.slice(chunkStart, this.pos);
        out += this.parseEscape();
        chunkStart = this.pos;
        continue;
      }
      if (code < 0x20) this.fail("Unescaped control character in string");
      if (code >= 0xd800 && code <= 0xdfff) {
        const low = text.charCodeAt(this.pos + 1);
        if (code > 0xdbff || !(low >= 0xdc00 && low <= 0xdfff)) {
          this.fail("Unpaired surrogate in string", "characters");
        }
        this.checkCodePoint(0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00));
        this.pos += 2;
        continue;
      }
      this.checkCodePoint(code);
      this.pos++;
    }
  }

  /** Parses one escape sequence (or an escaped surrogate pair) at `pos`. */
  private parseEscape(): string {
    const start = this.pos;
    const c = this.text[this.pos + 1];
    this.pos += 2;
    switch (c) {
      case '"':
        return '"';
      case "\\":
        return "\\";
      case "/":
        return "/";
      case "b":
        return "\b";
      case "f":
        return "\f";
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "t":
        return "\t";
      case "u": {
        const unit = this.readHex4();
        if (unit >= 0xdc00 && unit <= 0xdfff) this.fail("Unpaired surrogate escape", "characters", start);
        if (unit >= 0xd800 && unit <= 0xdbff) {
          if (this.text[this.pos] !== "\\" || this.text[this.pos + 1] !== "u") {
            this.fail("Unpaired surrogate escape", "characters", start);
          }
          this.pos += 2;
          const low = this.readHex4();
          if (!(low >= 0xdc00 && low <= 0xdfff)) this.fail("Unpaired surrogate escape", "characters", start);
          this.checkCodePoint(0x10000 + ((unit - 0xd800) << 10) + (low - 0xdc00), start);
          return String.fromCharCode(unit, low);
        }
        this.checkCodePoint(unit, start);
        return String.fromCharCode(unit);
      }
      default:
        return this.fail("Invalid escape sequence", "grammar", start);
    }
  }

  private readHex4(): number {
    const hex = this.text.slice(this.pos, this.pos + 4);
    if (!/^[0-9a-fA-F]{4}$/.test(hex)) this.fail("Invalid \\u escape");
    this.pos += 4;
    return parseInt(hex, 16);
  }

  private checkCodePoint(cp: number, at = this.pos): void {
    if (isNoncharacter(cp)) {
      this.fail(`Noncharacter U+${cp.toString(16).toUpperCase()} in string`, "characters", at);
    }
  }

  private parseNumber(): number {
    const start = this.pos;
    const match = /-?(?:0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?/y;
    match.lastIndex = start;
    const m = match.exec(this.text);
    if (!m) return this.fail("Invalid number");
    const literal = m[0];
    this.pos = start + literal.length;
    const next = this.text[this.pos];
    if (next !== undefined && /[0-9.eE+\-]/.test(next)) this.fail("Invalid number");
    const value = Number(literal);
    if (this.strict) checkStrictNumber(literal, value, m[1] === undefined && m[2] === undefined, start);
    return value;
  }

  private parseLiteral<T extends JsonValue>(word: string, value: T): T {
    if (!this.text.startsWith(word, this.pos)) this.fail("Invalid literal");
    this.pos += word.length;
    return value;
  }

  private skipWhitespace(): void {
    for (;;) {
      const c = this.text.charCodeAt(this.pos);
      if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) this.pos++;
      else return;
    }
  }

  private expect(c: string): void {
    if (this.text[this.pos] !== c) {
      this.fail(this.pos >= this.text.length ? "Unexpected end of input" : `Expected ${JSON.stringify(c)}`);
    }
    this.pos++;
  }

  private enter(): void {
    if (++this.depth > this.maxDepth) this.fail(`Nesting deeper than ${this.maxDepth}`, "depth");
  }

  private fail(message: string, rule: IJsonError["rule"] = "grammar", at = this.pos): never {
    throw new IJsonError(message, rule, at);
  }
}

/** Strict-mode number checks: the literal must name a double exactly. */
function checkStrictNumber(literal: string, value: number, isInteger: boolean, at: number): void {
  if (!Number.isFinite(value)) {
    throw new IJsonError("Number is outside the IEEE 754 double range", "numbers", at);
  }
  if (isInteger && !Number.isSafeInteger(value)) {
    throw new IJsonError("Integer is outside ±(2^53−1)", "numbers", at);
  }
  const written = decimal(literal);
  if (value === 0 && written.digits !== "") {
    throw new IJsonError("Number underflows to zero", "numbers", at);
  }
  const shortest = decimal(String(Math.abs(value)));
  if (written.digits !== shortest.digits || written.exponent !== shortest.exponent) {
    throw new IJsonError("Number has more precision than an IEEE 754 double", "numbers", at);
  }
}

/** Normalizes a decimal literal to significant digits × 10^exponent. */
function decimal(literal: string): { digits: string; exponent: number } {
  const m = /^-?(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(literal)!;
  const fraction = m[2] ?? "";
  let digits = (m[1]! + fraction).replace(/^0+/, "");
  let exponent = Number(m[3] ?? 0) - fraction.length;
  const trimmed = digits.replace(/0+$/, "");
  exponent += digits.length - trimmed.length;
  digits = trimmed;
  return { digits, exponent: digits === "" ? 0 : exponent };
}
