import { describe, expect, it } from "vitest";
import { maxModelUploadBytes, validateModelFile } from "./uploadLimits";

describe("upload limits", () => {
  it("accepts an 18.4 MB model without showing an oversized error", () => {
    const size = Math.round(18.4 * 1024 * 1024);
    expect(validateModelFile("airplane.obj", size)).toBeNull();
  });

  it("accepts a file exactly at the configured maximum", () => {
    expect(validateModelFile("limit.stl", maxModelUploadBytes)).toBeNull();
  });

  it("rejects a file one byte above the configured maximum", () => {
    expect(validateModelFile("too-large.stl", maxModelUploadBytes + 1)).toContain("250 MB");
  });
});
