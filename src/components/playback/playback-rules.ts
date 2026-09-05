import type { LogicalViewId, SafeViewAvailability } from "@/types";

export const DRIFT_THRESHOLD_SECONDS = 0.2;
export const DURATION_MISMATCH_THRESHOLD_SECONDS = 0.5;

export type PlaybackViewStatus = "loading" | "ready" | "unavailable";

export interface PlaybackViewRuntime {
  id: LogicalViewId;
  status: PlaybackViewStatus;
  currentTime: number;
  duration: number;
}

export function createInitialPlaybackRuntime(
  views: readonly SafeViewAvailability[],
): PlaybackViewRuntime[] {
  return views.map((view) => ({
    id: view.id,
    status: view.available ? "loading" : "unavailable",
    currentTime: 0,
    duration: 0,
  }));
}

export function selectTechnicalClock(
  runtime: readonly PlaybackViewRuntime[],
): LogicalViewId | undefined {
  return runtime.find(
    (view) => view.status === "ready" && Number.isFinite(view.duration) && view.duration > 0,
  )?.id;
}

export function clampPlaybackTime(time: number, duration: number): number {
  if (!Number.isFinite(time) || !Number.isFinite(duration) || duration <= 0) {
    return 0;
  }
  return Math.min(Math.max(time, 0), duration);
}

export function needsDriftCorrection(
  currentTime: number,
  canonicalTime: number,
): boolean {
  return (
    Number.isFinite(currentTime) &&
    Number.isFinite(canonicalTime) &&
    Math.abs(currentTime - canonicalTime) > DRIFT_THRESHOLD_SECONDS
  );
}

export function hasDurationMismatch(
  runtime: readonly PlaybackViewRuntime[],
  canonicalDuration: number,
): boolean {
  if (!Number.isFinite(canonicalDuration) || canonicalDuration <= 0) {
    return false;
  }
  return runtime.some(
    (view) =>
      view.status === "ready" &&
      Number.isFinite(view.duration) &&
      Math.abs(view.duration - canonicalDuration) >
        DURATION_MISMATCH_THRESHOLD_SECONDS,
  );
}

export function formatPlaybackTime(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const totalSeconds = Math.floor(safeSeconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

interface PlaybackKeyboardEvent {
  key: string;
  code?: string;
  repeat: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
}

export function shouldTogglePlaybackFromKeyboard(event: PlaybackKeyboardEvent): boolean {
  const isSpace = event.key === " " || event.key === "Spacebar" || event.code === "Space";
  if (
    !isSpace ||
    event.repeat ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  ) {
    return false;
  }

  const target = event.target;
  return !(
    typeof HTMLElement !== "undefined" &&
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName))
  );
}
