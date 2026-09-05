import { describe, expect, it, vi } from "vitest";

import {
  correctPlaybackDrift,
  pauseMedia,
  playReadyMedia,
  seekReadyMedia,
  type PlaybackMediaElement,
} from "@/components/playback/playback-engine";
import type { PlaybackViewRuntime } from "@/components/playback/playback-rules";
import type { LogicalViewId } from "@/types";

function mediaElement(duration: number): PlaybackMediaElement {
  return { currentTime: 0, duration, pause: vi.fn(), play: vi.fn().mockResolvedValue(undefined) };
}

const runtime: PlaybackViewRuntime[] = [
  { id: "view3", status: "ready", duration: 30, currentTime: 0 },
  { id: "ego", status: "ready", duration: 12, currentTime: 0 },
  { id: "view1", status: "unavailable", duration: 0, currentTime: 0 },
];

describe("shared playback media coordination", () => {
  it("plays ready media and pauses every registered element", async () => {
    const elements = new Map<LogicalViewId, PlaybackMediaElement>([
      ["view3", mediaElement(30)], ["ego", mediaElement(12)], ["view1", mediaElement(0)],
    ]);
    await expect(playReadyMedia(elements, runtime)).resolves.toBe(2);
    expect(elements.get("view3")?.play).toHaveBeenCalledOnce();
    expect(elements.get("ego")?.play).toHaveBeenCalledOnce();
    expect(elements.get("view1")?.play).not.toHaveBeenCalled();
    pauseMedia(elements);
    expect(elements.get("view3")?.pause).toHaveBeenCalledOnce();
    expect(elements.get("ego")?.pause).toHaveBeenCalledOnce();
  });

  it("seeks all ready media and clamps each to its own duration", () => {
    const main = mediaElement(30);
    const support = mediaElement(12);
    const elements = new Map<LogicalViewId, PlaybackMediaElement>([
      ["view3", main], ["ego", support],
    ]);
    seekReadyMedia(elements, runtime, 20);
    expect(main.currentTime).toBe(20);
    expect(support.currentTime).toBe(12);
  });

  it("corrects drifting supporting views without touching the clock", () => {
    const main = mediaElement(30);
    main.currentTime = 10;
    const support = mediaElement(12);
    support.currentTime = 9.7;
    const elements = new Map<LogicalViewId, PlaybackMediaElement>([
      ["view3", main], ["ego", support],
    ]);
    expect(correctPlaybackDrift(elements, runtime, "view3", 10)).toEqual(["ego"]);
    expect(main.currentTime).toBe(10);
    expect(support.currentTime).toBe(10);
  });
});
