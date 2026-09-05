"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  autoCloseOpenAnnotations,
  cancelOpenAnnotation,
  clearEventAnnotations,
  createAnnotationDraft,
  deleteOccurrence,
  editOccurrenceBoundary,
  markAnnotationDraftClean,
  toggleAnnotationEvent,
  type BoundaryEdge,
  type InitialEventAnnotation,
} from "@/components/events/annotation-state";
import { findAnnotationShortcut } from "@/components/events/annotation-shortcuts";
import type {
  AnnotationDraftState,
  EventAnnotationDraft,
  SafeEventDefinition,
} from "@/types";

interface UseAnnotationControllerOptions {
  takeName: string;
  eventConfigVersion: string;
  events: readonly SafeEventDefinition[];
  canonicalTime: number;
  canonicalDuration: number;
  naturalCompletionCount: number;
  shortcutsBlocked?: boolean;
  initial?: Readonly<Record<string, InitialEventAnnotation>>;
}

export interface AnnotationController {
  state: AnnotationDraftState;
  confirmationEventId?: string;
  eventState(eventId: string): EventAnnotationDraft;
  toggleEvent(eventId: string): void;
  editBoundary(
    eventId: string,
    occurrenceId: string,
    edge: BoundaryEdge,
    time: number,
  ): void;
  deleteOccurrence(eventId: string, occurrenceId: string): void;
  cancelActive(eventId: string): void;
  requestClear(eventId: string): void;
  confirmClear(): void;
  cancelClear(): void;
  markClean(): void;
  handleKeyDown(event: React.KeyboardEvent<HTMLElement>): void;
}

export function useAnnotationController({
  takeName,
  eventConfigVersion,
  events,
  canonicalTime,
  canonicalDuration,
  naturalCompletionCount,
  shortcutsBlocked = false,
  initial,
}: UseAnnotationControllerOptions): AnnotationController {
  const [state, setState] = useState(() =>
    createAnnotationDraft({ takeName, eventConfigVersion, events, initial }),
  );
  const [confirmationEventId, setConfirmationEventId] = useState<string>();
  const handledCompletionCount = useRef(naturalCompletionCount);

  useEffect(() => {
    if (naturalCompletionCount === handledCompletionCount.current) {
      return;
    }
    handledCompletionCount.current = naturalCompletionCount;
    setState((current) =>
      autoCloseOpenAnnotations(current, canonicalDuration),
    );
  }, [canonicalDuration, naturalCompletionCount]);

  const toggleEvent = useCallback(
    (eventId: string) => {
      setState((current) =>
        toggleAnnotationEvent(
          current,
          eventId,
          canonicalTime,
          canonicalDuration,
        ),
      );
    },
    [canonicalDuration, canonicalTime],
  );

  const editBoundary = useCallback(
    (
      eventId: string,
      occurrenceId: string,
      edge: BoundaryEdge,
      time: number,
    ) => {
      setState((current) =>
        editOccurrenceBoundary(
          current,
          eventId,
          occurrenceId,
          edge,
          time,
          canonicalDuration,
        ),
      );
    },
    [canonicalDuration],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      const eventId = findAnnotationShortcut(
        event.nativeEvent,
        events,
        confirmationEventId !== undefined || shortcutsBlocked,
      );
      if (!eventId) {
        return;
      }
      event.preventDefault();
      toggleEvent(eventId);
    },
    [confirmationEventId, events, shortcutsBlocked, toggleEvent],
  );

  const confirmClear = useCallback(() => {
    if (!confirmationEventId) {
      return;
    }
    setState((current) =>
      clearEventAnnotations(current, confirmationEventId),
    );
    setConfirmationEventId(undefined);
  }, [confirmationEventId]);

  return {
    state,
    confirmationEventId,
    eventState: (eventId) =>
      state.events[eventId] ?? { eventId, occurrences: [] },
    toggleEvent,
    editBoundary,
    deleteOccurrence: (eventId, occurrenceId) =>
      setState((current) => deleteOccurrence(current, eventId, occurrenceId)),
    cancelActive: (eventId) =>
      setState((current) => cancelOpenAnnotation(current, eventId)),
    requestClear: setConfirmationEventId,
    confirmClear,
    cancelClear: () => setConfirmationEventId(undefined),
    markClean: () => setState((current) => markAnnotationDraftClean(current)),
    handleKeyDown,
  };
}
