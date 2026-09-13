"use client";

import type { PlaybackViewStatus } from "@/components/playback/playback-rules";
import type { SharedPlaybackController } from "@/components/playback/use-shared-playback-controller";
import { messages } from "@/messages";
import type { SafeViewAvailability } from "@/types";

interface VideoViewCardProps {
  controller: SharedPlaybackController;
  isMain: boolean;
  status: PlaybackViewStatus;
  view: SafeViewAvailability;
}

export function VideoViewCard({ controller, isMain, status, view }: VideoViewCardProps) {
  const unavailable = !view.available || status === "unavailable";

  return (
    <article
      aria-label={`${view.label}${isMain ? ", main view" : ", supporting view"}`}
      className="video-card"
      data-main={isMain}
      data-status={status}
    >
      <div className="video-card-heading">
        <span>{view.label}</span>
        <span className="view-role">{isMain ? "Main view" : "Supporting view"}</span>
      </div>
      <div className="video-frame">
        {view.available && view.mediaUrl ? (
          <video
            aria-label={`${view.label} video`}
            controls={false}
            key={`${view.id}:${view.mediaUrl}`}
            muted
            onEnded={() => controller.handleEnded(view.id)}
            onError={() => controller.handleMediaError(view.id)}
            onLoadedMetadata={(event) =>
              controller.handleLoadedMetadata(view.id, event.currentTarget)
            }
            onTimeUpdate={(event) =>
              controller.handleTimeUpdate(view.id, event.currentTarget)
            }
            playsInline
            preload="metadata"
            ref={(element) => controller.registerVideo(view.id, element)}
            src={view.mediaUrl}
          />
        ) : null}
        {status === "loading" ? (
          <div className="media-state" role="status">
            <span className="loading-indicator" aria-hidden="true" />
            Loading {view.label}
          </div>
        ) : null}
        {unavailable ? (
          <div className="media-state media-unavailable" role="status">
            <span aria-hidden="true" className="unavailable-mark">×</span>
            <strong>{messages.mediaUnavailable}</strong>
            <span>{view.label}</span>
          </div>
        ) : null}
      </div>
    </article>
  );
}
