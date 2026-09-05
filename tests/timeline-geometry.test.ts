import { describe, expect, it, vi } from "vitest";

import { inspectAnnotationBoundary } from "@/components/timeline/boundary-inspection";
import {
  occurrenceTimelineGeometry,
  openOccurrenceTimelineGeometry,
  pointerToAnnotationTime,
  timeToTimelinePercent,
} from "@/components/timeline/timeline-geometry";

describe("annotation timeline geometry", () => {
  it("uses one full-duration scale for playhead and occurrence geometry", () => {
    expect(timeToTimelinePercent(5, 20)).toBe(25);
    expect(occurrenceTimelineGeometry({ start: 5, end: 10 }, 20)).toEqual({
      leftPercent: 25,
      widthPercent: 25,
    });
  });

  it("never draws an open interval backwards when seeking before its start", () => {
    expect(openOccurrenceTimelineGeometry(8, 4, 20)).toEqual({
      leftPercent: 40,
      widthPercent: 0,
    });
  });

  it("recomputes pointer time from the current lane width and snaps it", () => {
    expect(pointerToAnnotationTime(155, 100, 200, 20)).toBe(5.5);
    expect(pointerToAnnotationTime(50, 100, 200, 20)).toBe(0);
    expect(pointerToAnnotationTime(400, 100, 200, 20)).toBe(20);
  });

  it("pauses before seeking all videos for boundary inspection", () => {
    const order: string[] = [];
    const playback = {
      pause: vi.fn(() => order.push("pause")),
      seek: vi.fn(() => order.push("seek")),
    };
    inspectAnnotationBoundary(playback, 4.2);
    expect(order).toEqual(["pause", "seek"]);
    expect(playback.seek).toHaveBeenCalledWith(4.2);
  });
});
