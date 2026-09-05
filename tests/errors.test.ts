import { describe, expect, it } from "vitest";

import { FoundationError, logServerFailure, toPublicError } from "@/server/errors";

describe("safe server errors", () => {
  it("preserves actionable errors across Next.js server bundle boundaries", () => {
    const original = new FoundationError("ANNOTATION_STALE", "Reload before saving.", {
      status: 409,
    });
    const [brand] = Object.getOwnPropertySymbols(original);
    const foreignBundleError = {
      [brand]: true,
      name: "FoundationError",
      code: "ANNOTATION_STALE",
      status: 409,
      message: "Reload before saving.",
    };

    expect(foreignBundleError).not.toBeInstanceOf(FoundationError);
    expect(toPublicError(foreignBundleError)).toEqual({
      code: "ANNOTATION_STALE",
      status: 409,
      message: "Reload before saving.",
    });
  });

  it("does not expose unknown server errors or filesystem details", () => {
    const result = toPublicError(new Error("C:\\private\\annotations.json failed"));
    expect(result.code).toBe("INTERNAL_ERROR");
    expect(result.message).not.toContain("C:\\private");
  });

  it("logs safe operation context without serializing private error details", () => {
    const original = console.error;
    const calls: unknown[][] = [];
    console.error = (...values: unknown[]) => calls.push(values);
    try {
      logServerFailure({
        operation: "serve media",
        takeName: "take_001",
        logicalView: "view3",
        error: new Error("C:\\private\\media.mp4"),
      });
    } finally {
      console.error = original;
    }

    expect(calls).toEqual([["Server operation failed", {
      operation: "serve media",
      takeName: "take_001",
      logicalView: "view3",
      category: "INTERNAL_ERROR",
    }]]);
    expect(JSON.stringify(calls)).not.toContain("C:\\private");
  });
});
