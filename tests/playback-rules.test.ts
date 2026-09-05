import { describe, expect, it } from "vitest";

import {
  clampPlaybackTime,
  createInitialPlaybackRuntime,
  formatPlaybackTime,
  hasDurationMismatch,
  needsDriftCorrection,
  selectTechnicalClock,
  shouldTogglePlaybackFromKeyboard,
  type PlaybackViewRuntime,
} from "@/components/playback/playback-rules";
import type { SafeViewAvailability } from "@/types";

const ready = (
  id: PlaybackViewRuntime["id"],
  duration: number,
  currentTime = 0,
): PlaybackViewRuntime => ({ id, status: "ready", duration, currentTime });

describe("shared playback rules", () => {
  it("uses the fixed main view first and falls back without changing order", () => {
    expect(selectTechnicalClock([ready("view3", 30), ready("ego", 30)])).toBe("view3");
    expect(
      selectTechnicalClock([
        { id: "view3", status: "unavailable", duration: 0, currentTime: 0 },
        ready("ego", 30),
      ]),
    ).toBe("ego");
    expect(
      selectTechnicalClock([
        { id: "view3", status: "unavailable", duration: 0, currentTime: 0 },
        { id: "ego", status: "unavailable", duration: 0, currentTime: 0 },
      ]),
    ).toBeUndefined();
  });

  it("resets a new take to zero with fresh loading and unavailable states", () => {
    const views: SafeViewAvailability[] = [
      { id: "view3", label: "View 3", available: true, mediaUrl: "/media" },
      { id: "ego", label: "Ego view", available: false },
    ];
    expect(createInitialPlaybackRuntime(views)).toEqual([
      { id: "view3", status: "loading", duration: 0, currentTime: 0 },
      { id: "ego", status: "unavailable", duration: 0, currentTime: 0 },
    ]);
  });

  it("corrects only drift greater than 0.2 seconds", () => {
    expect(needsDriftCorrection(10.2, 10)).toBe(false);
    expect(needsDriftCorrection(10.2001, 10)).toBe(true);
    expect(needsDriftCorrection(9.7999, 10)).toBe(true);
  });

  it("warns only when a ready duration differs by more than 0.5 seconds", () => {
    expect(hasDurationMismatch([ready("view3", 30), ready("ego", 30.5)], 30)).toBe(false);
    expect(hasDurationMismatch([ready("view3", 30), ready("ego", 30.51)], 30)).toBe(true);
  });

  it("clamps shared time and formats the canonical clock", () => {
    expect(clampPlaybackTime(-1, 20)).toBe(0);
    expect(clampPlaybackTime(25, 20)).toBe(20);
    expect(clampPlaybackTime(4.5, 20)).toBe(4.5);
    expect(formatPlaybackTime(65.9)).toBe("01:05");
  });

  it("accepts unmodified Space but rejects repeats and modifiers", () => {
    const base = {
      key: " ",
      code: "Space",
      repeat: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      target: null,
    };
    expect(shouldTogglePlaybackFromKeyboard(base)).toBe(true);
    expect(shouldTogglePlaybackFromKeyboard({ ...base, repeat: true })).toBe(false);
    expect(shouldTogglePlaybackFromKeyboard({ ...base, ctrlKey: true })).toBe(false);
  });
});
