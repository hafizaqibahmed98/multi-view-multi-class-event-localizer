"use client";

import { useRef, type CSSProperties } from "react";

import type { AnnotationController } from "@/components/events/use-annotation-controller";
import {
  openOccurrenceTimelineGeometry,
  timeToTimelinePercent,
} from "@/components/timeline/timeline-geometry";
import { OccurrenceBar } from "@/components/timeline/occurrence-bar";
import { readableEventForeground } from "@/components/timeline/event-color";
import { messages } from "@/messages";
import type { AnnotationLaneDefinition } from "@/types";

interface AnnotationTimelineProps {
  annotation: AnnotationController;
  canonicalDuration: number;
  canonicalTime: number;
  events: readonly AnnotationLaneDefinition[];
  onInspectBoundary(time: number): void;
}

export function AnnotationTimeline({
  annotation,
  canonicalDuration,
  canonicalTime,
  events,
  onInspectBoundary,
}: AnnotationTimelineProps) {
  const trackElements = useRef<Record<string, HTMLDivElement | null>>({});
  const confirmationEvent = events.find(
    (event) => event.id === annotation.confirmationEventId,
  );
  const playheadPercent = timeToTimelinePercent(canonicalTime, canonicalDuration);

  return (
    <section aria-labelledby="annotations-heading" className="annotation-section">
      <div className="annotation-heading">
        <div>
          <p className="section-kicker">Unsaved local state</p>
          <h2 id="annotations-heading">Event annotations</h2>
        </div>
        <span className="annotation-total">
          {Object.values(annotation.state.events).reduce(
            (count, event) => count + event.occurrences.length,
            0,
          )}{" "}
          total
        </span>
      </div>

      <div className="timeline-scale-row" aria-hidden="true">
        <span />
        <div className="timeline-scale">
          {[0, 25, 50, 75, 100].map((percent) => (
            <span key={percent} style={{ left: `${percent}%` }}>
              {((canonicalDuration * percent) / 100).toFixed(1)}
            </span>
          ))}
        </div>
      </div>

      <div className="annotation-lanes-scroll">
        <div className="annotation-lane-grid">
          <div className="lane-labels">
            {events.map((event) => {
              const eventState = annotation.eventState(event.id);
              const active = eventState.openStart !== undefined;
              const empty = eventState.occurrences.length === 0 && !active;
              return (
                <div className="lane-label" data-active={active} key={event.id}>
                  <span
                    aria-hidden="true"
                    className="event-swatch"
                    style={{ backgroundColor: event.color }}
                  />
                  <div className="lane-title">
                    <strong>{event.label}</strong>
                    <span>{eventState.occurrences.length} occurrences</span>
                  </div>
                  <kbd>{event.shortcut}</kbd>
                  <div className="lane-actions">
                    {active && !event.readOnly ? (
                      <button
                        className="text-action"
                        onClick={() => annotation.cancelActive(event.id)}
                        type="button"
                      >
                        Cancel Active
                      </button>
                    ) : null}
                    {event.readOnly ? (
                      <span className="read-only-label">Read only</span>
                    ) : <button
                      className="text-action"
                      disabled={empty}
                      onClick={() => annotation.requestClear(event.id)}
                      type="button"
                    >
                      Clear
                    </button>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lane-tracks">
            <div
              aria-hidden="true"
              className="annotation-playhead"
              style={{ left: `${playheadPercent}%` }}
            />
            {events.map((event) => {
              const eventState = annotation.eventState(event.id);
              const openGeometry =
                eventState.openStart === undefined
                  ? undefined
                  : openOccurrenceTimelineGeometry(
                      eventState.openStart,
                      canonicalTime,
                      canonicalDuration,
                    );
              return (
                <div
                  aria-label={`${event.label} annotation timeline`}
                  className="annotation-track"
                  data-active={eventState.openStart !== undefined}
                  key={event.id}
                  ref={(element) => {
                    trackElements.current[event.id] = element;
                  }}
                >
                  {eventState.occurrences.map((occurrence) => (
                    <OccurrenceBar
                      duration={canonicalDuration}
                      event={event}
                      getTrackElement={() => trackElements.current[event.id] ?? null}
                      key={occurrence.occurrenceId}
                      occurrence={occurrence}
                      readOnly={event.readOnly}
                      onDelete={() =>
                        annotation.deleteOccurrence(event.id, occurrence.occurrenceId)
                      }
                      onEdit={(edge, time) =>
                        annotation.editBoundary(
                          event.id,
                          occurrence.occurrenceId,
                          edge,
                          time,
                        )
                      }
                      onInspectBoundary={onInspectBoundary}
                    />
                  ))}
                  {openGeometry ? (
                    <div
                      aria-label={`${event.label} active occurrence from ${eventState.openStart?.toFixed(1)} seconds`}
                      className="open-occurrence"
                      role="status"
                      style={{
                        "--event-foreground": readableEventForeground(event.color),
                        backgroundColor: event.color,
                        left: `${openGeometry.leftPercent}%`,
                        width: `${Math.max(openGeometry.widthPercent, 0.25)}%`,
                      } as CSSProperties}
                    >
                      <span>Active</span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {confirmationEvent ? (
        <div className="dialog-backdrop">
          <section
            aria-labelledby="clear-dialog-title"
            aria-modal="true"
            className="confirmation-dialog"
            role="dialog"
          >
            <h3 id="clear-dialog-title">Clear {confirmationEvent.label}?</h3>
            <p>{messages.clearEventConfirmation(confirmationEvent.label)}</p>
            <div className="dialog-actions">
              <button onClick={annotation.cancelClear} type="button">Cancel</button>
              <button className="danger-action" onClick={annotation.confirmClear} type="button">
                Clear event
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
