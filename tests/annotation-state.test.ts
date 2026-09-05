import { describe, expect, it } from "vitest";

import {
  autoCloseOpenAnnotations,
  cancelOpenAnnotation,
  clearEventAnnotations,
  createAnnotationDraft,
  deleteOccurrence,
  editOccurrenceBoundary,
  markAnnotationDraftClean,
  toggleAnnotationEvent,
  type InitialEventAnnotation,
} from "@/components/events/annotation-state";
import {
  maximumAnnotationTime,
  normalizeAnnotationTime,
  roundToTenth,
} from "@/schemas/annotation-boundary";
import type { AnnotationOccurrence, SafeEventDefinition } from "@/types";

const events: SafeEventDefinition[] = [
  { id: "walk", label: "Walk", shortcut: "W", color: "#24C6A1", order: 1 },
  { id: "run", label: "Run", shortcut: "R", color: "#6C7CFF", order: 2 },
];

function occurrence(
  occurrenceId: string,
  start: number,
  end: number,
  autoClosed = false,
): AnnotationOccurrence {
  return { occurrenceId, start, end, autoClosed };
}

function draft(initial: Record<string, InitialEventAnnotation> = {}) {
  return createAnnotationDraft({
    takeName: "take_001",
    eventConfigVersion: "1.0",
    events,
    initial,
  });
}

function idSequence(...ids: string[]) {
  let index = 0;
  return () => ids[index++] ?? `occ-${index}`;
}

describe("annotation precision", () => {
  it("rounds values around half-tenth boundaries consistently", () => {
    expect(roundToTenth(0.049)).toBe(0);
    expect(roundToTenth(0.05)).toBe(0.1);
    expect(roundToTenth(1.049)).toBe(1);
    expect(roundToTenth(1.05)).toBe(1.1);
    expect(normalizeAnnotationTime(-2, 10)).toBe(0);
    expect(normalizeAnnotationTime(12, 10.06)).toBe(10);
    expect(maximumAnnotationTime(10.06)).toBe(10);
  });
});

describe("annotation toggle state", () => {
  it("opens on the first toggle and closes a rounded interval on a later toggle", () => {
    const opened = toggleAnnotationEvent(draft(), "walk", 2.04, 10);
    expect(opened.events.walk.openStart).toBe(2);
    expect(opened.dirty).toBe(true);

    const closed = toggleAnnotationEvent(opened, "walk", 5.06, 10, () => "walk-1");
    expect(closed.events.walk.openStart).toBeUndefined();
    expect(closed.events.walk.occurrences).toEqual([
      occurrence("walk-1", 2, 5.1),
    ]);
  });

  it("supports multiple occurrences in one class", () => {
    const ids = idSequence("one", "two");
    let state = toggleAnnotationEvent(draft(), "walk", 1, 10, ids);
    state = toggleAnnotationEvent(state, "walk", 2, 10, ids);
    state = toggleAnnotationEvent(state, "walk", 3, 10, ids);
    state = toggleAnnotationEvent(state, "walk", 4, 10, ids);
    expect(state.events.walk.occurrences).toEqual([
      occurrence("one", 1, 2),
      occurrence("two", 3, 4),
    ]);
  });

  it("allows simultaneous open classes and cross-class overlap", () => {
    const ids = idSequence("walk-1", "run-1");
    let state = toggleAnnotationEvent(draft(), "walk", 2, 10, ids);
    state = toggleAnnotationEvent(state, "run", 3, 10, ids);
    expect(state.events.walk.openStart).toBe(2);
    expect(state.events.run.openStart).toBe(3);
    state = toggleAnnotationEvent(state, "walk", 5, 10, ids);
    state = toggleAnnotationEvent(state, "run", 7, 10, ids);
    expect(state.events.walk.occurrences[0]).toMatchObject({ start: 2, end: 5 });
    expect(state.events.run.occurrences[0]).toMatchObject({ start: 3, end: 7 });
  });

  it("rejects same-class overlap while preserving the open start", () => {
    let state = draft({ walk: { occurrences: [occurrence("existing", 2, 4)] } });
    state = toggleAnnotationEvent(state, "walk", 1, 10);
    const rejected = toggleAnnotationEvent(state, "walk", 3, 10);
    expect(rejected.events.walk.openStart).toBe(1);
    expect(rejected.events.walk.occurrences).toEqual([occurrence("existing", 2, 4)]);
    expect(rejected.feedback?.code).toBe("SAME_CLASS_OVERLAP");
  });

  it("allows adjacent same-class intervals", () => {
    let state = draft({ walk: { occurrences: [occurrence("existing", 2, 4)] } });
    state = toggleAnnotationEvent(state, "walk", 4, 10);
    state = toggleAnnotationEvent(state, "walk", 5, 10, () => "adjacent");
    expect(state.events.walk.occurrences).toEqual([
      occurrence("existing", 2, 4),
      occurrence("adjacent", 4, 5),
    ]);
  });

  it("keeps an event open when the endpoint rounds to its start", () => {
    const opened = toggleAnnotationEvent(draft(), "walk", 4.06, 10);
    const rejected = toggleAnnotationEvent(opened, "walk", 4.08, 10);
    expect(rejected.events.walk.openStart).toBe(4.1);
    expect(rejected.events.walk.occurrences).toEqual([]);
    expect(rejected.feedback?.code).toBe("ZERO_DURATION");
  });

  it("replaces only the future open start after a backward seek", () => {
    let state = toggleAnnotationEvent(draft(), "walk", 12, 20);
    state = toggleAnnotationEvent(state, "run", 13, 20);
    const replaced = toggleAnnotationEvent(state, "walk", 8, 20);
    expect(replaced.events.walk.openStart).toBe(8);
    expect(replaced.events.walk.occurrences).toEqual([]);
    expect(replaced.events.run.openStart).toBe(13);
    expect(replaced.dirty).toBe(true);
  });

  it("auto-closes every open class in one operation with unique IDs", () => {
    let state = toggleAnnotationEvent(draft(), "walk", 2, 10);
    state = toggleAnnotationEvent(state, "run", 3, 10);
    const closed = autoCloseOpenAnnotations(
      state,
      10.08,
      idSequence("auto-walk", "auto-run"),
    );
    expect(closed.events.walk.occurrences).toEqual([
      occurrence("auto-walk", 2, 10, true),
    ]);
    expect(closed.events.run.occurrences).toEqual([
      occurrence("auto-run", 3, 10, true),
    ]);
    expect(closed.events.walk.openStart).toBeUndefined();
    expect(closed.events.run.openStart).toBeUndefined();
    expect(closed.dirty).toBe(true);
  });

  it("keeps generated occurrence IDs unique across classes", () => {
    let state = toggleAnnotationEvent(draft(), "walk", 1, 10);
    state = toggleAnnotationEvent(state, "walk", 2, 10, () => "same-id");
    state = toggleAnnotationEvent(state, "run", 3, 10);
    state = toggleAnnotationEvent(state, "run", 4, 10, () => "same-id");
    const ids = Object.values(state.events).flatMap((event) =>
      event.occurrences.map((item) => item.occurrenceId),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("annotation editing and destructive actions", () => {
  it("edits left and right edges with snapping", () => {
    const initial = draft({ walk: { occurrences: [occurrence("one", 1, 3)] } });
    const left = editOccurrenceBoundary(initial, "walk", "one", "start", 1.16, 10);
    expect(left.events.walk.occurrences[0].start).toBe(1.2);
    const right = editOccurrenceBoundary(left, "walk", "one", "end", 3.04, 10);
    expect(right.events.walk.occurrences[0].end).toBe(3);
    expect(right.dirty).toBe(true);
  });

  it("rejects inverted boundaries and same-class collisions", () => {
    const initial = draft({
      walk: { occurrences: [occurrence("one", 1, 3), occurrence("two", 4, 6)] },
    });
    const inverted = editOccurrenceBoundary(initial, "walk", "one", "start", 3, 10);
    expect(inverted.events.walk.occurrences[0]).toEqual(occurrence("one", 1, 3));
    expect(inverted.feedback?.code).toBe("INVALID_BOUNDARY");
    const collision = editOccurrenceBoundary(initial, "walk", "one", "end", 4.5, 10);
    expect(collision.events.walk.occurrences[0]).toEqual(occurrence("one", 1, 3));
    expect(collision.feedback?.code).toBe("SAME_CLASS_OVERLAP");
  });

  it("clamps edited boundaries to canonical duration", () => {
    const initial = draft({ walk: { occurrences: [occurrence("one", 1, 3)] } });
    const edited = editOccurrenceBoundary(initial, "walk", "one", "end", 20, 5.08);
    expect(edited.events.walk.occurrences[0].end).toBe(5);
  });

  it("deletes only one occurrence and updates dirty state", () => {
    const initial = draft({
      walk: { occurrences: [occurrence("one", 1, 2), occurrence("two", 3, 4)] },
    });
    const deleted = deleteOccurrence(initial, "walk", "one");
    expect(deleted.events.walk.occurrences).toEqual([occurrence("two", 3, 4)]);
    expect(deleted.dirty).toBe(true);
  });

  it("clears only the selected class including its open start", () => {
    let initial = draft({
      walk: { occurrences: [occurrence("walk", 1, 2)], openStart: 5 },
      run: { occurrences: [occurrence("run", 2, 3)], openStart: 6 },
    });
    initial = clearEventAnnotations(initial, "walk");
    expect(initial.events.walk).toEqual({ eventId: "walk", occurrences: [] });
    expect(initial.events.run.openStart).toBe(6);
    expect(initial.events.run.occurrences).toHaveLength(1);
  });

  it("cancels only the unfinished start and preserves completed occurrences", () => {
    const initial = draft({
      walk: { occurrences: [occurrence("walk", 1, 2)], openStart: 5 },
      run: { openStart: 6 },
    });
    const canceled = cancelOpenAnnotation(initial, "walk");
    expect(canceled.events.walk).toEqual({
      eventId: "walk",
      occurrences: [occurrence("walk", 1, 2)],
    });
    expect(canceled.events.run.openStart).toBe(6);
    expect(canceled.dirty).toBe(true);
  });

  it("creates clean isolated state for a new take and can be initialized later", () => {
    const first = toggleAnnotationEvent(draft(), "walk", 1, 10);
    expect(first.dirty).toBe(true);
    expect(markAnnotationDraftClean(first).dirty).toBe(false);
    const second = createAnnotationDraft({
      takeName: "take_002",
      eventConfigVersion: "1.0",
      events,
    });
    expect(second.takeName).toBe("take_002");
    expect(second.dirty).toBe(false);
    expect(second.events.walk.occurrences).toEqual([]);
    expect(second.events.walk.openStart).toBeUndefined();
  });
});
