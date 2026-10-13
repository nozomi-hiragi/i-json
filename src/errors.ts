/** Which I-JSON requirement an input or value broke. */
export type IJsonRule =
  | "grammar" // RFC 8259 syntax
  | "encoding" // RFC 7493 §2.1: UTF-8 only
  | "characters" // RFC 7493 §2.1: no surrogates or noncharacters
  | "numbers" // RFC 7493 §2.2 (strict only)
  | "duplicates" // RFC 7493 §2.3: no duplicate member names
  | "top-level" // RFC 7493 §4.1 (strict only)
  | "depth" // nesting beyond `maxDepth`
  | "value"; // stringify: a value JSON cannot represent

export class IJsonError extends Error {
  override name = "IJsonError";

  constructor(
    message: string,
    /** The requirement that was broken. */
    readonly rule: IJsonRule,
    /** Index into the decoded text where parsing failed, when parsing. */
    readonly position?: number,
  ) {
    super(position === undefined ? message : `${message} at position ${position}`);
  }
}

export interface Options {
  /**
   * Also enforce the RFC 7493 SHOULD rules: numbers must fit an IEEE 754
   * double exactly (no overflow, underflow, excess precision or integers
   * beyond ±(2^53−1)), and the top-level value must be an object or array.
   * Defaults to false, which enforces only the MUST rules.
   */
  strict?: boolean;
  /** Maximum nesting of arrays and objects. Defaults to 512. */
  maxDepth?: number;
}

export const DEFAULT_MAX_DEPTH = 512;

/** True for Unicode noncharacters: U+FDD0..U+FDEF and U+xxFFFE/U+xxFFFF. */
export function isNoncharacter(cp: number): boolean {
  return (cp >= 0xfdd0 && cp <= 0xfdef) || (cp & 0xfffe) === 0xfffe;
}
