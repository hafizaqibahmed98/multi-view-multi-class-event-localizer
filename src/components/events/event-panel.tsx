"use client";

import type { AnnotationDraftState, SafeEventDefinition } from "@/types";

interface EventPanelProps {
  events: readonly SafeEventDefinition[];
  annotationState: AnnotationDraftState;
  disabled: boolean;
  onToggleEvent(eventId: string): void;
}

export function EventPanel({
  events,
  annotationState,
  disabled,
  onToggleEvent,
}: EventPanelProps) {
  return (
    <aside aria-labelledby="events-heading" className="event-panel">
      <div className="event-panel-heading">
        <div>
          <p className="section-kicker">Configured classes</p>
          <h2 id="events-heading">Events</h2>
        </div>
        <span>{events.length}</span>
      </div>
      <p className="event-panel-help">Press a shortcut or select an event to start or stop.</p>
      <div className="event-panel-list">
        {events.map((event) => {
          const draft = annotationState.events[event.id];
          const active = draft?.openStart !== undefined;
          return (
            <button
              aria-pressed={active}
              className="event-panel-item"
              data-active={active}
              disabled={disabled}
              key={event.id}
              onClick={() => onToggleEvent(event.id)}
              type="button"
            >
              <span
                aria-hidden="true"
                className="event-swatch"
                style={{ backgroundColor: event.color }}
              />
              <span className="event-panel-label">{event.label}</span>
              {active ? <span className="active-label">Active</span> : null}
              <kbd>{event.shortcut}</kbd>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
