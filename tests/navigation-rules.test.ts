import { describe, expect, it } from "vitest";

import {
  adjacentTake,
  buildSaveInput,
  createSubmissionGate,
  isExplicitlyEmpty,
  navigationRequest,
  openEventLabels,
  persistBeforeNavigation,
} from "@/components/navigation/navigation-rules";
import { destinationAfterSave, getAnnotationProgress } from "@/server/navigation/progress";
import type { AnnotationDocument, AnnotationDraftState, SafeEventDefinition } from "@/types";

const takes = [
  { takeName: "one", index: 0 },
  { takeName: "two", index: 1 },
  { takeName: "three", index: 2 },
];
const events: SafeEventDefinition[] = [
  { id: "walk", label: "Walk", shortcut: "W", color: "#111111", order: 1 },
  { id: "run", label: "Run", shortcut: "R", color: "#222222", order: 2 },
];
const timestamp = "2026-09-04T10:00:00.000Z";

function document(completed: string[]): AnnotationDocument {
  return {
    schemaVersion: "1.0",
    eventConfigVersion: "1.0",
    createdAt: timestamp,
    updatedAt: timestamp,
    takes: completed.map((takeName) => ({
      takeName,
      completed: true,
      eventConfigVersion: "1.0",
      durationSeconds: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      views: [],
      events: [],
    })),
  };
}

function draft(openRun = false): AnnotationDraftState {
  return {
    takeName: "one",
    eventConfigVersion: "1.0",
    dirty: true,
    events: {
      walk: { eventId: "walk", occurrences: [] },
      run: { eventId: "run", occurrences: [], ...(openRun ? { openStart: 2 } : {}) },
    },
  };
}

describe("manifest navigation rules", () => {
  it("uses exact order and disables movement beyond either endpoint", () => {
    expect(adjacentTake(takes, "one", -1)).toBeUndefined();
    expect(adjacentTake(takes, "one", 1)?.takeName).toBe("two");
    expect(adjacentTake(takes, "three", 1)).toBeUndefined();
    expect(adjacentTake(takes, "three", -1)?.takeName).toBe("two");
  });

  it("requires confirmation from the same dirty truth and cancellation leaves state untouched", () => {
    const annotation = draft();
    expect(navigationRequest(annotation.dirty, "two")).toEqual({
      action: "confirm",
      takeName: "two",
    });
    expect(annotation).toBe(annotation);
    expect(navigationRequest(false, "two").action).toBe("navigate");
  });

  it("selects the first incomplete take and completion only when all are complete", () => {
    expect(getAnnotationProgress(takes, document(["two"]))).toEqual({
      allComplete: false,
      firstIncompleteTakeName: "one",
    });
    expect(getAnnotationProgress(takes, document(["one", "two", "three"]))).toEqual({
      allComplete: true,
    });
  });

  it("advances normally, wraps a final save to an earlier gap, then completes", () => {
    expect(destinationAfterSave(takes, "one", document(["one"]))).toEqual({
      completion: false,
      takeName: "two",
    });
    expect(destinationAfterSave(takes, "three", document(["two", "three"]))).toEqual({
      completion: false,
      takeName: "one",
    });
    expect(destinationAfterSave(takes, "three", document(["one", "two", "three"]))).toEqual({
      completion: true,
    });
  });
});

describe("save preparation", () => {
  it("identifies all open event labels and explicitly empty state", () => {
    expect(openEventLabels(draft(true), events)).toEqual(["Run"]);
    expect(isExplicitlyEmpty(draft())).toBe(true);
  });

  it("includes every enabled event and empty occurrence arrays", () => {
    expect(buildSaveInput(draft(), events, 10)).toEqual({
      takeName: "one",
      durationSeconds: 10,
      events: [
        { id: "walk", occurrences: [] },
        { id: "run", occurrences: [] },
      ],
    });
  });

  it("blocks duplicate submissions until the active save finishes", () => {
    const gate = createSubmissionGate();
    expect(gate.begin()).toBe(true);
    expect(gate.begin()).toBe(false);
    gate.finish();
    expect(gate.begin()).toBe(true);
  });

  it("navigates only after persistence succeeds", async () => {
    const destinations: string[] = [];
    await expect(
      persistBeforeNavigation(
        async () => { throw new Error("save failed"); },
        (destination: string) => destinations.push(destination),
      ),
    ).rejects.toThrow("save failed");
    expect(destinations).toEqual([]);
    await persistBeforeNavigation(async () => "two", (destination) => destinations.push(destination));
    expect(destinations).toEqual(["two"]);
  });
});
