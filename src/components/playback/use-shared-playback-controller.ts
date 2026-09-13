"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import {
  correctPlaybackDrift,
  pauseMedia,
  playReadyMedia,
  seekReadyMedia,
  type PlaybackMediaElement,
} from "@/components/playback/playback-engine";
import {
  clampPlaybackTime,
  createInitialPlaybackRuntime,
  hasDurationMismatch,
  selectTechnicalClock,
  shouldTogglePlaybackFromKeyboard,
  type PlaybackViewRuntime,
  type PlaybackViewStatus,
} from "@/components/playback/playback-rules";
import type { LogicalViewId, SafeViewAvailability } from "@/types";

export interface SharedPlaybackController {
  canonicalTime: number;
  canonicalDuration: number;
  isPlaying: boolean;
  isLoading: boolean;
  canPlay: boolean;
  durationMismatch: boolean;
  naturalCompletionCount: number;
  technicalClockId?: LogicalViewId;
  statusForView(id: LogicalViewId): PlaybackViewStatus;
  registerVideo(id: LogicalViewId, element: HTMLVideoElement | null): void;
  handleLoadedMetadata(id: LogicalViewId, element: HTMLVideoElement): void;
  handleTimeUpdate(id: LogicalViewId, element: HTMLVideoElement): void;
  handleMediaError(id: LogicalViewId): void;
  handleEnded(id: LogicalViewId): void;
  play(): void;
  pause(): void;
  toggle(): void;
  seek(time: number): void;
  handleWorkspaceKeyDown(event: React.KeyboardEvent<HTMLElement>): void;
}

function updateRuntime(
  runtime: readonly PlaybackViewRuntime[],
  id: LogicalViewId,
  update: Partial<PlaybackViewRuntime>,
): PlaybackViewRuntime[] {
  return runtime.map((view) => (view.id === id ? { ...view, ...update } : view));
}

export function useSharedPlaybackController(
  views: readonly SafeViewAvailability[],
): SharedPlaybackController {
  const media = useRef(new Map<LogicalViewId, PlaybackMediaElement>());
  const [runtime, setRuntime] = useState(() => createInitialPlaybackRuntime(views));
  const [canonicalTime, setCanonicalTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [naturalCompletionCount, setNaturalCompletionCount] = useState(0);

  const technicalClockId = useMemo(() => selectTechnicalClock(runtime), [runtime]);
  const canonicalDuration = useMemo(
    () => runtime.find((view) => view.id === technicalClockId)?.duration ?? 0,
    [runtime, technicalClockId],
  );
  const durationMismatch = useMemo(
    () => hasDurationMismatch(runtime, canonicalDuration),
    [runtime, canonicalDuration],
  );
  const isLoading = runtime.some((view) => view.status === "loading");
  const canPlay = technicalClockId !== undefined;

  const registerVideo = useCallback(
    (id: LogicalViewId, element: HTMLVideoElement | null) => {
      if (element) {
        media.current.set(id, element);
      } else {
        media.current.delete(id);
      }
    },
    [],
  );

  const handleLoadedMetadata = useCallback(
    (id: LogicalViewId, element: HTMLVideoElement) => {
      const duration = Number.isFinite(element.duration) ? element.duration : 0;
      element.currentTime = clampPlaybackTime(canonicalTime, duration);
      setRuntime((current) =>
        updateRuntime(current, id, {
          status: duration > 0 ? "ready" : "unavailable",
          duration,
          currentTime: element.currentTime,
        }),
      );
      if (isPlaying && duration > 0) {
        void element.play();
      }
    },
    [canonicalTime, isPlaying],
  );

  const handleMediaError = useCallback((id: LogicalViewId) => {
    setRuntime((current) =>
      updateRuntime(current, id, {
        status: "unavailable",
        duration: 0,
        currentTime: 0,
      }),
    );
  }, []);

  const handleTimeUpdate = useCallback(
    (id: LogicalViewId, element: HTMLVideoElement) => {
      if (id !== technicalClockId) {
        return;
      }
      const nextTime = clampPlaybackTime(element.currentTime, canonicalDuration);
      setCanonicalTime(nextTime);
      setRuntime((current) =>
        updateRuntime(current, id, { currentTime: nextTime }),
      );
      correctPlaybackDrift(media.current, runtime, id, nextTime);
    },
    [canonicalDuration, runtime, technicalClockId],
  );

  const pause = useCallback(() => {
    pauseMedia(media.current);
    setIsPlaying(false);
  }, []);

  const play = useCallback(() => {
    if (!technicalClockId) {
      return;
    }
    setIsPlaying(true);
    void playReadyMedia(media.current, runtime).then((startedCount) => {
      if (startedCount === 0) {
        setIsPlaying(false);
      }
    });
  }, [runtime, technicalClockId]);

  const toggle = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  const seek = useCallback(
    (time: number) => {
      if (!technicalClockId) {
        return;
      }
      const nextTime = clampPlaybackTime(time, canonicalDuration);
      seekReadyMedia(media.current, runtime, nextTime);
      setCanonicalTime(nextTime);
      setRuntime((current) =>
        current.map((view) =>
          view.status === "ready"
            ? { ...view, currentTime: clampPlaybackTime(nextTime, view.duration) }
            : view,
        ),
      );
    },
    [canonicalDuration, runtime, technicalClockId],
  );

  const handleEnded = useCallback(
    (id: LogicalViewId) => {
      if (id === technicalClockId && isPlaying) {
        pauseMedia(media.current);
        setCanonicalTime(canonicalDuration);
        setIsPlaying(false);
        setNaturalCompletionCount((count) => count + 1);
      }
    },
    [canonicalDuration, isPlaying, technicalClockId],
  );

  const handleWorkspaceKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (shouldTogglePlaybackFromKeyboard(event.nativeEvent)) {
        event.preventDefault();
        toggle();
      }
    },
    [toggle],
  );

  return {
    canonicalTime,
    canonicalDuration,
    isPlaying,
    isLoading,
    canPlay,
    durationMismatch,
    naturalCompletionCount,
    technicalClockId,
    statusForView: (id) =>
      runtime.find((view) => view.id === id)?.status ?? "unavailable",
    registerVideo,
    handleLoadedMetadata,
    handleTimeUpdate,
    handleMediaError,
    handleEnded,
    play,
    pause,
    toggle,
    seek,
    handleWorkspaceKeyDown,
  };
}
