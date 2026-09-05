"use client";

import { formatPlaybackTime } from "@/components/playback/playback-rules";
import type { SharedPlaybackController } from "@/components/playback/use-shared-playback-controller";

interface SharedPlaybackControlsProps {
  controller: SharedPlaybackController;
}

export function SharedPlaybackControls({ controller }: SharedPlaybackControlsProps) {
  const disabled = !controller.canPlay;

  return (
    <section aria-label="Shared playback controls" className="playback-controls">
      <button
        aria-label={controller.isPlaying ? "Pause all videos" : "Play all videos"}
        className="playback-toggle"
        disabled={disabled}
        onClick={controller.toggle}
        type="button"
      >
        <span aria-hidden="true">{controller.isPlaying ? "Ⅱ" : "▶"}</span>
        {controller.isPlaying ? "Pause" : "Play"}
      </button>
      <output className="playback-time" aria-live="off">
        {formatPlaybackTime(controller.canonicalTime)}
      </output>
      <input
        aria-label="Shared playback position"
        className="playback-seek"
        disabled={disabled}
        max={Math.max(controller.canonicalDuration, 0)}
        min="0"
        onChange={(event) => controller.seek(Number(event.currentTarget.value))}
        step="0.01"
        type="range"
        value={Math.min(controller.canonicalTime, controller.canonicalDuration || 0)}
      />
      <output className="playback-time" aria-label="Total duration">
        {formatPlaybackTime(controller.canonicalDuration)}
      </output>
      <span className="shortcut-hint"><kbd>Space</kbd> play / pause</span>
    </section>
  );
}
