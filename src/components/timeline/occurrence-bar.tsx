"use client";

import { useRef, type CSSProperties } from "react";

import type { BoundaryEdge } from "@/components/events/annotation-state";
import {
  occurrenceTimelineGeometry,
  pointerToAnnotationTime,
} from "@/components/timeline/timeline-geometry";
import { readableEventForeground } from "@/components/timeline/event-color";
import type { AnnotationOccurrence, SafeEventDefinition } from "@/types";

interface OccurrenceBarProps {
  duration: number;
  event: SafeEventDefinition;
  occurrence: AnnotationOccurrence;
  getTrackElement(): HTMLDivElement | null;
  onDelete(): void;
  onEdit(edge: BoundaryEdge, time: number): void;
  onInspectBoundary(time: number): void;
  readOnly?: boolean;
}

export function OccurrenceBar({
  duration,
  event,
  occurrence,
  getTrackElement,
  onDelete,
  onEdit,
  onInspectBoundary,
  readOnly = false,
}: OccurrenceBarProps) {
  const activeDrag = useRef<
    { edge: BoundaryEdge; pointerId: number } | undefined
  >(undefined);
  const geometry = occurrenceTimelineGeometry(occurrence, duration);
  const timeLabel = `${occurrence.start.toFixed(1)}–${occurrence.end.toFixed(1)} s`;
  const eventStyle = {
    "--event-foreground": readableEventForeground(event.color),
    backgroundColor: event.color,
    left: `${geometry.leftPercent}%`,
    width: `${geometry.widthPercent}%`,
  } as CSSProperties;

  const handlePointerMove = (
    edge: BoundaryEdge,
    pointerId: number,
    clientX: number,
  ) => {
    const trackElement = getTrackElement();
    if (
      !trackElement ||
      activeDrag.current?.edge !== edge ||
      activeDrag.current.pointerId !== pointerId
    ) {
      return;
    }
    const bounds = trackElement.getBoundingClientRect();
    const time = pointerToAnnotationTime(
      clientX,
      bounds.left,
      bounds.width,
      duration,
    );
    onInspectBoundary(time);
    onEdit(edge, time);
  };

  return (
    <div
      className="occurrence-bar"
      data-auto-closed={occurrence.autoClosed}
      style={eventStyle}
      title={`${event.label}: ${timeLabel}${occurrence.autoClosed ? ", auto-closed" : ""}`}
    >
      {readOnly ? null : <button
        aria-label={`Adjust ${event.label} start`}
        className="boundary-handle boundary-start"
        onClick={(event) => event.preventDefault()}
        onPointerCancel={() => {
          activeDrag.current = undefined;
        }}
        onPointerDown={(pointerEvent) => {
          activeDrag.current = { edge: "start", pointerId: pointerEvent.pointerId };
          pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId);
          onInspectBoundary(occurrence.start);
        }}
        onPointerMove={(pointerEvent) =>
          handlePointerMove("start", pointerEvent.pointerId, pointerEvent.clientX)
        }
        onPointerUp={(pointerEvent) => {
          if (pointerEvent.currentTarget.hasPointerCapture(pointerEvent.pointerId)) {
            pointerEvent.currentTarget.releasePointerCapture(pointerEvent.pointerId);
          }
          activeDrag.current = undefined;
        }}
        type="button"
      />}
      <span className="occurrence-time">{timeLabel}</span>
      {readOnly ? null : <button
        aria-label={`Delete ${event.label} occurrence ${timeLabel}`}
        className="occurrence-delete"
        onClick={onDelete}
        title="Delete occurrence"
        type="button"
      >
        ×
      </button>}
      {readOnly ? null : <button
        aria-label={`Adjust ${event.label} end`}
        className="boundary-handle boundary-end"
        onClick={(event) => event.preventDefault()}
        onPointerCancel={() => {
          activeDrag.current = undefined;
        }}
        onPointerDown={(pointerEvent) => {
          activeDrag.current = { edge: "end", pointerId: pointerEvent.pointerId };
          pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId);
          onInspectBoundary(occurrence.end);
        }}
        onPointerMove={(pointerEvent) =>
          handlePointerMove("end", pointerEvent.pointerId, pointerEvent.clientX)
        }
        onPointerUp={(pointerEvent) => {
          if (pointerEvent.currentTarget.hasPointerCapture(pointerEvent.pointerId)) {
            pointerEvent.currentTarget.releasePointerCapture(pointerEvent.pointerId);
          }
          activeDrag.current = undefined;
        }}
        type="button"
      />}
    </div>
  );
}
