import { describe, expect, it } from "vitest";

import { findAnnotationShortcut } from "@/components/events/annotation-shortcuts";
import type { SafeEventDefinition } from "@/types";

const events: SafeEventDefinition[] = [
  { id: "walk", label: "Walk", shortcut: "W", color: "#24C6A1", order: 1 },
  { id: "run", label: "Run", shortcut: "R", color: "#6C7CFF", order: 2 },
];

const keyboardEvent = (overrides: Record<string, unknown> = {}) => ({
  key: "w",
  repeat: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  target: null,
  ...overrides,
});

describe("annotation shortcuts", () => {
  it("matches configured shortcuts case-insensitively", () => {
    expect(findAnnotationShortcut(keyboardEvent(), events, false)).toBe("walk");
    expect(findAnnotationShortcut(keyboardEvent({ key: "R" }), events, false)).toBe("run");
  });

  it("ignores repeat, modifier, reserved, and unconfigured keys", () => {
    expect(findAnnotationShortcut(keyboardEvent({ repeat: true }), events, false)).toBeUndefined();
    expect(findAnnotationShortcut(keyboardEvent({ ctrlKey: true }), events, false)).toBeUndefined();
    expect(findAnnotationShortcut(keyboardEvent({ key: " " }), events, false)).toBeUndefined();
    expect(findAnnotationShortcut(keyboardEvent({ key: "Escape" }), events, false)).toBeUndefined();
    expect(findAnnotationShortcut(keyboardEvent({ key: "x" }), events, false)).toBeUndefined();
  });

  it("ignores editable controls and active confirmation dialogs", () => {
    expect(
      findAnnotationShortcut(
        keyboardEvent({ target: { tagName: "INPUT", isContentEditable: false } }),
        events,
        false,
      ),
    ).toBeUndefined();
    expect(
      findAnnotationShortcut(
        keyboardEvent({ target: { tagName: "DIV", isContentEditable: true } }),
        events,
        false,
      ),
    ).toBeUndefined();
    expect(findAnnotationShortcut(keyboardEvent(), events, true)).toBeUndefined();
  });
});
