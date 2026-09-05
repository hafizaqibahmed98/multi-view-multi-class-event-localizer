import { normalizeAnnotationTime } from "@/schemas/annotation-boundary";
import type { AnnotationOccurrence } from "@/types";

export interface TimelineGeometry {
  leftPercent: number;
  widthPercent: number;
}

export function timeToTimelinePercent(time: number, duration: number): number {
  if (!Number.isFinite(time) || !Number.isFinite(duration) || duration <= 0) {
    return 0;
  }
  return Math.min(Math.max((time / duration) * 100, 0), 100);
}

export function occurrenceTimelineGeometry(
  occurrence: Pick<AnnotationOccurrence, "start" | "end">,
  duration: number,
): TimelineGeometry {
  const leftPercent = timeToTimelinePercent(occurrence.start, duration);
  const endPercent = timeToTimelinePercent(occurrence.end, duration);
  return { leftPercent, widthPercent: Math.max(0, endPercent - leftPercent) };
}

export function openOccurrenceTimelineGeometry(
  openStart: number,
  currentTime: number,
  duration: number,
): TimelineGeometry {
  const end = Math.max(openStart, currentTime);
  return occurrenceTimelineGeometry({ start: openStart, end }, duration);
}

export function pointerToAnnotationTime(
  clientX: number,
  trackLeft: number,
  trackWidth: number,
  duration: number,
): number {
  if (!Number.isFinite(trackWidth) || trackWidth <= 0) {
    return 0;
  }
  const ratio = Math.min(Math.max((clientX - trackLeft) / trackWidth, 0), 1);
  return normalizeAnnotationTime(ratio * duration, duration);
}
