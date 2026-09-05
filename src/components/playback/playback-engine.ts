import {
  clampPlaybackTime,
  needsDriftCorrection,
  type PlaybackViewRuntime,
} from "@/components/playback/playback-rules";
import type { LogicalViewId } from "@/types";

export interface PlaybackMediaElement {
  currentTime: number;
  duration: number;
  pause(): void;
  play(): Promise<void>;
}

export type PlaybackMediaRegistry = ReadonlyMap<LogicalViewId, PlaybackMediaElement>;

function readyRuntime(
  runtime: readonly PlaybackViewRuntime[],
  id: LogicalViewId,
): PlaybackViewRuntime | undefined {
  return runtime.find((view) => view.id === id && view.status === "ready");
}

export async function playReadyMedia(
  media: PlaybackMediaRegistry,
  runtime: readonly PlaybackViewRuntime[],
): Promise<number> {
  const attempts = [...media.entries()]
    .filter(([id]) => readyRuntime(runtime, id))
    .map(([, element]) => element.play());
  const results = await Promise.allSettled(attempts);
  return results.filter((result) => result.status === "fulfilled").length;
}

export function pauseMedia(media: PlaybackMediaRegistry): void {
  for (const element of media.values()) {
    element.pause();
  }
}

export function seekReadyMedia(
  media: PlaybackMediaRegistry,
  runtime: readonly PlaybackViewRuntime[],
  time: number,
): void {
  for (const [id, element] of media.entries()) {
    const view = readyRuntime(runtime, id);
    if (view) {
      element.currentTime = clampPlaybackTime(time, view.duration);
    }
  }
}

export function correctPlaybackDrift(
  media: PlaybackMediaRegistry,
  runtime: readonly PlaybackViewRuntime[],
  technicalClockId: LogicalViewId,
  canonicalTime: number,
): LogicalViewId[] {
  const corrected: LogicalViewId[] = [];
  for (const [id, element] of media.entries()) {
    const view = readyRuntime(runtime, id);
    if (
      id !== technicalClockId &&
      view &&
      needsDriftCorrection(element.currentTime, canonicalTime)
    ) {
      element.currentTime = clampPlaybackTime(canonicalTime, view.duration);
      corrected.push(id);
    }
  }
  return corrected;
}
