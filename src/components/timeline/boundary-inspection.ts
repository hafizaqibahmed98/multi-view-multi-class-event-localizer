export interface BoundaryInspectionPlayback {
  pause(): void;
  seek(time: number): void;
}

export function inspectAnnotationBoundary(
  playback: BoundaryInspectionPlayback,
  time: number,
): void {
  playback.pause();
  playback.seek(time);
}
