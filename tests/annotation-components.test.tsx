import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { EventPanel } from "@/components/events/event-panel";
import { findAnnotationShortcut } from "@/components/events/annotation-shortcuts";
import {
  clearEventAnnotations,
  deleteOccurrence,
} from "@/components/events/annotation-state";
import type { AnnotationController } from "@/components/events/use-annotation-controller";
import { AnnotationTimeline } from "@/components/timeline/annotation-timeline";
import { parseEventConfig } from "@/schemas/event-config";
import type {
  AnnotationDraftState,
  EventAnnotationDraft,
  SafeEventDefinition,
} from "@/types";

const events: SafeEventDefinition[] = [
  { id: "walk", label: "Walk", shortcut: "W", color: "#24C6A1", order: 1 },
  { id: "run", label: "Run", shortcut: "R", color: "#6C7CFF", order: 2 },
];

const threeEvents: SafeEventDefinition[] = [
  events[0],
  events[1],
  { id: "jump", label: "Jump", shortcut: "J", color: "#F4B74A", order: 3 },
];

function state(
  eventStates: Record<string, EventAnnotationDraft> = {
    walk: { eventId: "walk", occurrences: [] },
    run: { eventId: "run", occurrences: [] },
  },
): AnnotationDraftState {
  return {
    takeName: "take_001",
    eventConfigVersion: "1.0",
    dirty: false,
    events: eventStates,
  };
}

function controller(
  annotationState: AnnotationDraftState,
  confirmationEventId?: string,
): AnnotationController {
  return {
    state: annotationState,
    confirmationEventId,
    eventState: (eventId) =>
      annotationState.events[eventId] ?? { eventId, occurrences: [] },
    toggleEvent: vi.fn(),
    editBoundary: vi.fn(),
    deleteOccurrence: vi.fn(),
    cancelActive: vi.fn(),
    requestClear: vi.fn(),
    confirmClear: vi.fn(),
    cancelClear: vi.fn(),
    markClean: vi.fn(),
    handleKeyDown: vi.fn(),
  };
}

function elementsMatching(
  node: ReactNode,
  predicate: (element: ReactElement) => boolean,
): ReactElement[] {
  const matches: ReactElement[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) {
      return;
    }
    if (predicate(child)) {
      matches.push(child);
    }
    matches.push(
      ...elementsMatching(
        (child.props as { children?: ReactNode }).children,
        predicate,
      ),
    );
  });
  return matches;
}

describe("annotation components", () => {
  it("renders exactly one empty lane per enabled configured event in order", () => {
    const annotationState = state(
      Object.fromEntries(
        threeEvents.map((event) => [
          event.id,
          { eventId: event.id, occurrences: [] },
        ]),
      ),
    );
    const markup = renderToStaticMarkup(
      <AnnotationTimeline
        annotation={controller(annotationState)}
        canonicalDuration={10}
        canonicalTime={0}
        events={threeEvents}
        onInspectBoundary={vi.fn()}
      />,
    );

    expect(markup.match(/annotation timeline/g)).toHaveLength(3);
    expect(markup.match(/0 occurrences/g)).toHaveLength(3);
    expect(markup.indexOf("Walk annotation timeline")).toBeLessThan(
      markup.indexOf("Run annotation timeline"),
    );
    expect(markup.indexOf("Run annotation timeline")).toBeLessThan(
      markup.indexOf("Jump annotation timeline"),
    );
  });

  it("does not create a lane for disabled configuration entries", () => {
    const parsed = parseEventConfig({
      version: "1.0",
      events: [
        { ...threeEvents[1], enabled: true },
        { ...threeEvents[0], enabled: true },
        { ...threeEvents[2], enabled: false },
      ],
    });
    const enabledEvents = parsed.enabledEvents.map(
      ({ id, label, shortcut, color, order }) => ({
        id,
        label,
        shortcut,
        color,
        order,
      }),
    );
    const annotationState = state(
      Object.fromEntries(
        enabledEvents.map((event) => [
          event.id,
          { eventId: event.id, occurrences: [] },
        ]),
      ),
    );
    const markup = renderToStaticMarkup(
      <AnnotationTimeline
        annotation={controller(annotationState)}
        canonicalDuration={10}
        canonicalTime={0}
        events={enabledEvents}
        onInspectBoundary={vi.fn()}
      />,
    );

    expect(markup.match(/annotation timeline/g)).toHaveLength(2);
    expect(markup).toContain("Walk annotation timeline");
    expect(markup).toContain("Run annotation timeline");
    expect(markup).not.toContain("Jump annotation timeline");
  });

  it("renders configured event order and exposes active toggle state", () => {
    const annotationState = state({
      walk: { eventId: "walk", occurrences: [], openStart: 2 },
      run: { eventId: "run", occurrences: [] },
    });
    const markup = renderToStaticMarkup(
      <EventPanel
        annotationState={annotationState}
        disabled={false}
        events={events}
        onToggleEvent={vi.fn()}
      />,
    );

    expect(markup.indexOf("Walk")).toBeLessThan(markup.indexOf("Run"));
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain("Active");
    expect(markup.match(/<kbd>/g)).toHaveLength(2);
  });

  it("routes click and shortcut input to the same configured event operation", () => {
    const onToggleEvent = vi.fn();
    const panel = EventPanel({
      annotationState: state(),
      disabled: false,
      events,
      onToggleEvent,
    });
    const firstEventButton = elementsMatching(
      panel,
      (element) => element.type === "button",
    )[0];
    const shortcutEventId = findAnnotationShortcut(
      {
        key: "w",
        repeat: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        target: null,
      },
      events,
      false,
    );

    (firstEventButton.props as { onClick(): void }).onClick();
    expect(shortcutEventId).toBe("walk");
    expect(onToggleEvent).toHaveBeenCalledWith(shortcutEventId);
  });

  it("renders one shared playhead, completed and active bars, and lane controls", () => {
    const annotationState = state({
      walk: {
        eventId: "walk",
        occurrences: [
          { occurrenceId: "walk-1", start: 1, end: 3, autoClosed: false },
        ],
        openStart: 5,
      },
      run: { eventId: "run", occurrences: [] },
    });
    const markup = renderToStaticMarkup(
      <AnnotationTimeline
        annotation={controller(annotationState)}
        canonicalDuration={10}
        canonicalTime={7}
        events={events}
        onInspectBoundary={vi.fn()}
      />,
    );

    expect(markup.match(/annotation-playhead/g)).toHaveLength(1);
    expect(markup).toContain("Walk: 1.0–3.0 s");
    expect(markup).toContain("Walk active occurrence from 5.0 seconds");
    expect(markup).toContain("Cancel Active");
    expect(markup).toContain("Delete Walk occurrence");
    expect(markup).toContain("1 total");
  });

  it("surfaces removed historical events as read-only lanes", () => {
    const historical = {
      id: "removed",
      label: "Removed event",
      shortcut: "Stored",
      color: "#888888",
      order: 3,
      readOnly: true,
    } as const;
    const annotationState = state({
      walk: { eventId: "walk", occurrences: [] },
      run: { eventId: "run", occurrences: [] },
      removed: {
        eventId: "removed",
        occurrences: [
          { occurrenceId: "old", start: 1, end: 2, autoClosed: false },
        ],
      },
    });
    const markup = renderToStaticMarkup(
      <AnnotationTimeline
        annotation={controller(annotationState)}
        canonicalDuration={10}
        canonicalTime={2}
        events={[...events, historical]}
        onInspectBoundary={vi.fn()}
      />,
    );

    expect(markup).toContain("Removed event annotation timeline");
    expect(markup).toContain("Read only");
    expect(markup).toContain("Removed event: 1.0–2.0 s");
    expect(markup).not.toContain("Delete Removed event occurrence");
    expect(markup).not.toContain("Adjust Removed event");
  });

  it("renders a scoped clear confirmation dialog", () => {
    const markup = renderToStaticMarkup(
      <AnnotationTimeline
        annotation={controller(state(), "walk")}
        canonicalDuration={10}
        canonicalTime={2}
        events={events}
        onInspectBoundary={vi.fn()}
      />,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("Clear Walk?");
    expect(markup).toContain("Clear event");
  });

  it("keeps an empty event lane after its final occurrence is deleted", () => {
    const initial = state({
      walk: {
        eventId: "walk",
        occurrences: [
          { occurrenceId: "only", start: 1, end: 2, autoClosed: false },
        ],
      },
      run: { eventId: "run", occurrences: [] },
    });
    const deleted = deleteOccurrence(initial, "walk", "only");
    const markup = renderToStaticMarkup(
      <AnnotationTimeline
        annotation={controller(deleted)}
        canonicalDuration={10}
        canonicalTime={2}
        events={events}
        onInspectBoundary={vi.fn()}
      />,
    );

    expect(markup).toContain("Walk annotation timeline");
    expect(markup.match(/0 occurrences/g)).toHaveLength(2);
    expect(markup).not.toContain("Delete Walk occurrence");
  });

  it("keeps an empty event lane after Clear removes its annotations", () => {
    const initial = state({
      walk: {
        eventId: "walk",
        occurrences: [
          { occurrenceId: "only", start: 1, end: 2, autoClosed: false },
        ],
        openStart: 3,
      },
      run: { eventId: "run", occurrences: [] },
    });
    const cleared = clearEventAnnotations(initial, "walk");
    const markup = renderToStaticMarkup(
      <AnnotationTimeline
        annotation={controller(cleared)}
        canonicalDuration={10}
        canonicalTime={4}
        events={events}
        onInspectBoundary={vi.fn()}
      />,
    );

    expect(markup).toContain("Walk annotation timeline");
    expect(markup).not.toContain("Walk active occurrence");
    expect(markup).not.toContain("Delete Walk occurrence");
  });

  it("renders all configured lanes in the scrollable region at 30 classes", () => {
    const manyEvents = Array.from({ length: 30 }, (_, index) => ({
      id: `event-${index}`,
      label: `Event ${index}`,
      shortcut: String(index % 10),
      color: "#6C7CFF",
      order: index,
    }));
    const manyState = state(
      Object.fromEntries(
        manyEvents.map((event) => [
          event.id,
          { eventId: event.id, occurrences: [] },
        ]),
      ),
    );
    const markup = renderToStaticMarkup(
      <AnnotationTimeline
        annotation={controller(manyState)}
        canonicalDuration={10}
        canonicalTime={2}
        events={manyEvents}
        onInspectBoundary={vi.fn()}
      />,
    );

    expect(markup).toContain("annotation-lanes-scroll");
    expect(markup.match(/annotation timeline/g)).toHaveLength(30);
  });
});
