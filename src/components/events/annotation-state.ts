import { messages } from "@/messages";
import {
  intervalsOverlap,
  isValidOccurrenceBoundary,
  maximumAnnotationTime,
  normalizeAnnotationTime,
} from "@/schemas/annotation-boundary";
import type {
  AnnotationDraftState,
  AnnotationFeedbackCode,
  AnnotationOccurrence,
  EventAnnotationDraft,
  SafeEventDefinition,
} from "@/types";

export type OccurrenceIdFactory = () => string;
export type BoundaryEdge = "start" | "end";

export interface InitialEventAnnotation {
  occurrences?: readonly AnnotationOccurrence[];
  openStart?: number;
}

interface CreateAnnotationDraftOptions {
  takeName: string;
  eventConfigVersion: string;
  events: readonly SafeEventDefinition[];
  initial?: Readonly<Record<string, InitialEventAnnotation>>;
}

let fallbackOccurrenceSequence = 0;

function defaultOccurrenceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  fallbackOccurrenceSequence += 1;
  return `occurrence-${Date.now()}-${fallbackOccurrenceSequence}`;
}

function eventDraft(
  state: AnnotationDraftState,
  eventId: string,
): EventAnnotationDraft | undefined {
  return state.events[eventId];
}

function replaceEvent(
  state: AnnotationDraftState,
  event: EventAnnotationDraft,
  dirty = true,
): AnnotationDraftState {
  return {
    ...state,
    dirty: dirty || state.dirty,
    feedback: undefined,
    events: { ...state.events, [event.eventId]: event },
  };
}

function feedback(
  state: AnnotationDraftState,
  eventId: string,
  code: AnnotationFeedbackCode,
  message: string,
): AnnotationDraftState {
  return { ...state, feedback: { eventId, code, message } };
}

function overlapsExisting(
  occurrences: readonly AnnotationOccurrence[],
  candidate: Pick<AnnotationOccurrence, "start" | "end">,
  excludedOccurrenceId?: string,
): boolean {
  return occurrences.some(
    (occurrence) =>
      occurrence.occurrenceId !== excludedOccurrenceId &&
      intervalsOverlap(occurrence, candidate),
  );
}

function uniqueOccurrenceId(
  state: AnnotationDraftState,
  factory: OccurrenceIdFactory,
): string {
  const existingIds = new Set(
    Object.values(state.events).flatMap((event) =>
      event.occurrences.map((occurrence) => occurrence.occurrenceId),
    ),
  );
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = factory();
    if (candidate && !existingIds.has(candidate)) {
      return candidate;
    }
  }
  return `${factory()}-${existingIds.size + 1}`;
}

export function createAnnotationDraft({
  takeName,
  eventConfigVersion,
  events,
  initial = {},
}: CreateAnnotationDraftOptions): AnnotationDraftState {
  const configuredIds = new Set(events.map((event) => event.id));
  const historicalIds = Object.keys(initial).filter(
    (eventId) => !configuredIds.has(eventId),
  );
  return {
    takeName,
    eventConfigVersion,
    dirty: false,
    events: Object.fromEntries(
      [...events.map((event) => event.id), ...historicalIds].map((eventId) => {
        const supplied = initial[eventId];
        return [
          eventId,
          {
            eventId,
            occurrences: supplied?.occurrences?.map((occurrence) => ({ ...occurrence })) ?? [],
            ...(supplied?.openStart === undefined
              ? {}
              : { openStart: supplied.openStart }),
          },
        ];
      }),
    ),
  };
}

export function toggleAnnotationEvent(
  state: AnnotationDraftState,
  eventId: string,
  currentTime: number,
  canonicalDuration: number,
  occurrenceIdFactory: OccurrenceIdFactory = defaultOccurrenceId,
): AnnotationDraftState {
  const event = eventDraft(state, eventId);
  if (!event || maximumAnnotationTime(canonicalDuration) <= 0) {
    return feedback(
      state,
      eventId,
      "INVALID_TIME",
      messages.annotationTimeUnavailable,
    );
  }

  const time = normalizeAnnotationTime(currentTime, canonicalDuration);
  if (event.openStart === undefined) {
    const startsInsideOccurrence = event.occurrences.some(
      (occurrence) => occurrence.start <= time && time < occurrence.end,
    );
    if (startsInsideOccurrence) {
      return feedback(
        state,
        eventId,
        "SAME_CLASS_OVERLAP",
        messages.annotationOverlap,
      );
    }
    return replaceEvent(state, { ...event, openStart: time });
  }

  if (time < event.openStart) {
    return replaceEvent(state, { ...event, openStart: time });
  }
  if (time === event.openStart) {
    return feedback(
      state,
      eventId,
      "ZERO_DURATION",
      messages.annotationLaterEndpoint,
    );
  }

  const candidate = { start: event.openStart, end: time };
  if (
    !isValidOccurrenceBoundary(candidate, canonicalDuration) ||
    overlapsExisting(event.occurrences, candidate)
  ) {
    return feedback(
      state,
      eventId,
      "SAME_CLASS_OVERLAP",
      messages.annotationOverlap,
    );
  }

  const occurrence: AnnotationOccurrence = {
    occurrenceId: uniqueOccurrenceId(state, occurrenceIdFactory),
    ...candidate,
    autoClosed: false,
  };
  return replaceEvent(state, {
    eventId,
    occurrences: [...event.occurrences, occurrence].toSorted(
      (left, right) => left.start - right.start,
    ),
  });
}

export function autoCloseOpenAnnotations(
  state: AnnotationDraftState,
  canonicalDuration: number,
  occurrenceIdFactory: OccurrenceIdFactory = defaultOccurrenceId,
): AnnotationDraftState {
  const end = maximumAnnotationTime(canonicalDuration);
  let nextState = state;
  let changed = false;

  for (const event of Object.values(state.events)) {
    if (event.openStart === undefined) {
      continue;
    }
    const candidate = { start: event.openStart, end };
    if (
      !isValidOccurrenceBoundary(candidate, canonicalDuration) ||
      overlapsExisting(event.occurrences, candidate)
    ) {
      nextState = feedback(
        nextState,
        event.eventId,
        "SAME_CLASS_OVERLAP",
        messages.annotationOverlap,
      );
      continue;
    }
    const occurrence: AnnotationOccurrence = {
      occurrenceId: uniqueOccurrenceId(nextState, occurrenceIdFactory),
      ...candidate,
      autoClosed: true,
    };
    nextState = replaceEvent(nextState, {
      eventId: event.eventId,
      occurrences: [...event.occurrences, occurrence].toSorted(
        (left, right) => left.start - right.start,
      ),
    });
    changed = true;
  }

  return changed ? { ...nextState, dirty: true } : nextState;
}

export function editOccurrenceBoundary(
  state: AnnotationDraftState,
  eventId: string,
  occurrenceId: string,
  edge: BoundaryEdge,
  candidateTime: number,
  canonicalDuration: number,
): AnnotationDraftState {
  const event = eventDraft(state, eventId);
  const occurrence = event?.occurrences.find(
    (candidate) => candidate.occurrenceId === occurrenceId,
  );
  if (!event || !occurrence) {
    return state;
  }

  const boundary = normalizeAnnotationTime(candidateTime, canonicalDuration);
  const candidate = {
    ...occurrence,
    [edge]: boundary,
  };
  const collidesWithOpenStart =
    event.openStart !== undefined &&
    candidate.start <= event.openStart &&
    candidate.end > event.openStart;

  if (!isValidOccurrenceBoundary(candidate, canonicalDuration)) {
    return feedback(
      state,
      eventId,
      "INVALID_BOUNDARY",
      messages.annotationInvalidBoundary,
    );
  }
  if (
    collidesWithOpenStart ||
    overlapsExisting(event.occurrences, candidate, occurrenceId)
  ) {
    return feedback(
      state,
      eventId,
      "SAME_CLASS_OVERLAP",
      messages.annotationOverlap,
    );
  }
  if (candidate[edge] === occurrence[edge]) {
    return { ...state, feedback: undefined };
  }

  return replaceEvent(state, {
    ...event,
    occurrences: event.occurrences
      .map((existing) =>
        existing.occurrenceId === occurrenceId ? candidate : existing,
      )
      .toSorted((left, right) => left.start - right.start),
  });
}

export function deleteOccurrence(
  state: AnnotationDraftState,
  eventId: string,
  occurrenceId: string,
): AnnotationDraftState {
  const event = eventDraft(state, eventId);
  if (!event || !event.occurrences.some((item) => item.occurrenceId === occurrenceId)) {
    return state;
  }
  return replaceEvent(state, {
    ...event,
    occurrences: event.occurrences.filter(
      (occurrence) => occurrence.occurrenceId !== occurrenceId,
    ),
  });
}

export function clearEventAnnotations(
  state: AnnotationDraftState,
  eventId: string,
): AnnotationDraftState {
  const event = eventDraft(state, eventId);
  if (!event || (event.occurrences.length === 0 && event.openStart === undefined)) {
    return state;
  }
  return replaceEvent(state, { eventId, occurrences: [] });
}

export function cancelOpenAnnotation(
  state: AnnotationDraftState,
  eventId: string,
): AnnotationDraftState {
  const event = eventDraft(state, eventId);
  if (!event || event.openStart === undefined) {
    return state;
  }
  return replaceEvent(state, {
    eventId,
    occurrences: event.occurrences,
  });
}

export function markAnnotationDraftClean(
  state: AnnotationDraftState,
): AnnotationDraftState {
  return { ...state, dirty: false, feedback: undefined };
}
