import { describe, expect, it } from "vitest";
import { IJsonError, isIJson } from "../src/index.js";

describe("isIJson", () => {
  it("is not implemented yet", () => {
    expect(() => isIJson("{}")).toThrow(IJsonError);
  });
});
