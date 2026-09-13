import type { AnnotationOccurrence } from "@/types";

const TENTHS_PER_SECOND = 10;
const PRECISION_EPSILON = 1e-9;

export function roundToTenth(seconds: number): number {
  if (!Number.isFinite(seconds)) {
    return 0;
  }
  return Number(
    (Math.round((seconds + Number.EPSILON) * TENTHS_PER_SECOND) /
      TENTHS_PER_SECOND).toFixed(1),
  );
}

export function maximumAnnotationTime(canonicalDuration: number): number {
  if (!Number.isFinite(canonicalDuration) || canonicalDuration <= 0) {
    return 0;
  }
  return Number(
    (Math.floor((canonicalDuration + PRECISION_EPSILON) * TENTHS_PER_SECOND) /
      TENTHS_PER_SECOND).toFixed(1),
  );
}

export function normalizeAnnotationTime(
  seconds: number,
  canonicalDuration: number,
): number {
  const maximum = maximumAnnotationTime(canonicalDuration);
  return Math.min(Math.max(roundToTenth(seconds), 0), maximum);
}

export function intervalsOverlap(
  left: Pick<AnnotationOccurrence, "start" | "end">,
  right: Pick<AnnotationOccurrence, "start" | "end">,
): boolean {
  return left.start < right.end && left.end > right.start;
}

export function isValidOccurrenceBoundary(
  occurrence: Pick<AnnotationOccurrence, "start" | "end">,
  canonicalDuration: number,
): boolean {
  const maximum = maximumAnnotationTime(canonicalDuration);
  return (
    Number.isFinite(occurrence.start) &&
    Number.isFinite(occurrence.end) &&
    occurrence.start >= 0 &&
    occurrence.start < occurrence.end &&
    occurrence.end <= maximum &&
    Math.abs(occurrence.start * TENTHS_PER_SECOND - Math.round(occurrence.start * TENTHS_PER_SECOND)) <
      PRECISION_EPSILON &&
    Math.abs(occurrence.end * TENTHS_PER_SECOND - Math.round(occurrence.end * TENTHS_PER_SECOND)) <
      PRECISION_EPSILON
  );
}
