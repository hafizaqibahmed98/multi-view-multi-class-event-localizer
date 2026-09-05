import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SharedPlaybackControls } from "@/components/playback/shared-playback-controls";
import type { SharedPlaybackController } from "@/components/playback/use-shared-playback-controller";
import { VideoViewCard } from "@/components/workspace/video-view-card";

function controller(
  overrides: Partial<SharedPlaybackController> = {},
): SharedPlaybackController {
  return {
    canonicalTime: 2,
    canonicalDuration: 10,
    isPlaying: false,
    isLoading: false,
    canPlay: true,
    durationMismatch: false,
    naturalCompletionCount: 0,
    technicalClockId: "view3",
    statusForView: () => "ready",
    registerVideo: vi.fn(),
    handleLoadedMetadata: vi.fn(),
    handleTimeUpdate: vi.fn(),
    handleMediaError: vi.fn(),
    handleEnded: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    toggle: vi.fn(),
    seek: vi.fn(),
    handleWorkspaceKeyDown: vi.fn(),
    ...overrides,
  };
}

describe("workspace components", () => {
  it("renders useful accessible unavailable text in the retained card", () => {
    const markup = renderToStaticMarkup(
      <VideoViewCard
        controller={controller({ canPlay: false })}
        isMain
        status="unavailable"
        view={{ id: "view3", label: "View 3", available: false }}
      />,
    );
    expect(markup).toContain("View 3, main view");
    expect(markup).toContain("Media unavailable");
    expect(markup).toContain("role=\"status\"");
  });

  it("renders video without independent native controls", () => {
    const markup = renderToStaticMarkup(
      <VideoViewCard
        controller={controller()}
        isMain={false}
        status="ready"
        view={{
          id: "ego",
          label: "Ego view",
          available: true,
          mediaUrl: "/api/media/take_001/ego",
        }}
      />,
    );
    expect(markup).toContain("<video");
    expect(markup).not.toMatch(/\scontrols(?:=|\s|>)/);
    expect(markup).not.toContain("type=\"number\"");
  });

  it("exposes one named toggle and one keyboard-accessible shared seek control", () => {
    const markup = renderToStaticMarkup(
      <SharedPlaybackControls controller={controller()} />,
    );
    expect(markup).toContain('aria-label="Play all videos"');
    expect(markup).toContain('aria-label="Shared playback position"');
    expect(markup).toContain('type="range"');
    expect(markup.match(/<button/g)).toHaveLength(1);
    expect(markup.match(/type="range"/g)).toHaveLength(1);
  });

  it("disables the shared controls when no playable clock exists", () => {
    const markup = renderToStaticMarkup(
      <SharedPlaybackControls
        controller={controller({ canPlay: false, canonicalDuration: 0 })}
      />,
    );
    expect(markup.match(/disabled=""/g)).toHaveLength(2);
  });
});
