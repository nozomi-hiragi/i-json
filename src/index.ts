/**
 * I-JSON (RFC 7493) parser, serializer and validator.
 *
 * Implementation is in progress; see README for the planned API.
 */

export class IJsonError extends Error {
  override name = "IJsonError";
}

/** Reports whether `text` is a valid I-JSON message. */
export function isIJson(text: string): boolean {
  void text;
  throw new IJsonError("not implemented yet");
}
