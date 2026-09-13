"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { formatPlaybackTime } from "@/components/playback/playback-rules";
import { SharedPlaybackControls } from "@/components/playback/shared-playback-controls";
import { useSharedPlaybackController } from "@/components/playback/use-shared-playback-controller";
import { EventPanel } from "@/components/events/event-panel";
import { useAnnotationController } from "@/components/events/use-annotation-controller";
import { AnnotationTimeline } from "@/components/timeline/annotation-timeline";
import { inspectAnnotationBoundary } from "@/components/timeline/boundary-inspection";
import {
  adjacentTake,
  buildSaveInput,
  createSubmissionGate,
  isExplicitlyEmpty,
  navigationRequest,
  openEventLabels,
  persistBeforeNavigation,
} from "@/components/navigation/navigation-rules";
import { useDirtyBeforeUnload } from "@/components/navigation/use-dirty-before-unload";
import { TakeNavigation } from "@/components/navigation/take-navigation";
import { createWorkspaceViewLayout } from "@/components/workspace/workspace-layout";
import { VideoViewCard } from "@/components/workspace/video-view-card";
import { messages } from "@/messages";
import type { InitialEventAnnotation } from "@/components/events/annotation-state";
import type {
  AnnotationLaneDefinition,
  HistoricalEventDefinition,
  SafeClientConfig,
  SafeTakeMetadata,
  TakeManifestEntry,
} from "@/types";

interface WorkspaceShellProps {
  config: SafeClientConfig;
  take: SafeTakeMetadata;
  takes: TakeManifestEntry[];
  initialAnnotations: Record<string, InitialEventAnnotation>;
  historicalEvents: HistoricalEventDefinition[];
}

type WorkspaceDialog =
  | { kind: "leave"; takeName: string }
  | { kind: "empty-save" };

interface SaveResponse {
  destination?: { completion: true } | { completion: false; takeName: string };
  error?: { message?: string };
}

export function WorkspaceShell({
  config,
  take,
  takes,
  initialAnnotations,
  historicalEvents,
}: WorkspaceShellProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<WorkspaceDialog>();
  const [operationError, setOperationError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const submissionGate = useRef(createSubmissionGate());
  const controller = useSharedPlaybackController(take.views);
  const layout = createWorkspaceViewLayout(take.views);
  const annotation = useAnnotationController({
    takeName: take.takeName,
    eventConfigVersion: config.eventConfigVersion,
    events: config.events,
    canonicalTime: controller.canonicalTime,
    canonicalDuration: controller.canonicalDuration,
    naturalCompletionCount: controller.naturalCompletionCount,
    shortcutsBlocked: dialog !== undefined || isSaving,
    initial: initialAnnotations,
  });
  useDirtyBeforeUnload(annotation.state.dirty);
  const canAnnotate = controller.canPlay && controller.canonicalDuration > 0;
  const previousTake = adjacentTake(takes, take.takeName, -1);
  const nextTake = adjacentTake(takes, take.takeName, 1);
  const openLabels = openEventLabels(annotation.state, config.events);
  const laneEvents = useMemo<AnnotationLaneDefinition[]>(
    () => [
      ...config.events,
      ...historicalEvents.map((event, index) => ({
        id: event.id,
        label: event.label,
        color: event.color,
        shortcut: "Stored",
        order: config.events.length + index,
        readOnly: true,
      })),
    ],
    [config.events, historicalEvents],
  );

  const inspectBoundary = (time: number) => {
    inspectAnnotationBoundary(controller, time);
  };

  const goToTake = (takeName: string) => {
    setDialog(undefined);
    setIsNavigating(true);
    router.push(`/?take=${encodeURIComponent(takeName)}`);
  };

  const requestNavigation = (takeName: string) => {
    const request = navigationRequest(annotation.state.dirty, takeName);
    if (request.action === "confirm") {
      setDialog({ kind: "leave", takeName });
      return;
    }
    goToTake(takeName);
  };

  const persistAndContinue = async () => {
    if (openLabels.length > 0 || !submissionGate.current.begin()) return;
    setIsSaving(true);
    setOperationError(undefined);
    try {
      await persistBeforeNavigation(
        async () => {
          const response = await fetch("/api/annotations", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(
              buildSaveInput(annotation.state, config.events, controller.canonicalDuration),
            ),
          });
          const body = (await response.json()) as SaveResponse;
          if (!response.ok || !body.destination) {
            throw new Error(body.error?.message || messages.failedSave);
          }
          return body.destination;
        },
        (destination) => {
          annotation.markClean();
          setDialog(undefined);
          setIsNavigating(true);
          if (destination.completion) {
            router.push("/complete");
          } else {
            router.push(`/?take=${encodeURIComponent(destination.takeName)}`);
          }
        },
      );
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : messages.failedSave);
      setIsSaving(false);
      submissionGate.current.finish();
    }
  };

  const requestSave = () => {
    if (openLabels.length > 0 || isSaving || controller.isLoading) return;
    if (isExplicitlyEmpty(annotation.state)) {
      setDialog({ kind: "empty-save" });
      return;
    }
    void persistAndContinue();
  };

  if (isNavigating) {
    return (
      <main className="take-loading" role="status">
        <span className="loading-indicator" />
        {messages.loadingTake}
      </main>
    );
  }

  return (
    <main
      aria-label="Shared playback workspace"
      className="workspace-shell"
      data-view-count={config.views.length}
      onKeyDown={(event) => {
        annotation.handleKeyDown(event);
        controller.handleWorkspaceKeyDown(event);
      }}
      tabIndex={0}
    >
      <header className="application-header">
        <div className="application-identity">
          <span aria-hidden="true" className="application-mark" />
          <strong>{messages.applicationLabel}</strong>
        </div>
        <dl className="take-summary">
          <div className="dirty-state" data-dirty={annotation.state.dirty}>
            <dt>Status</dt>
            <dd>
              {annotation.state.dirty
                ? messages.annotationUnsaved
                : messages.annotationClean}
            </dd>
          </div>
          <div>
            <dt>Take</dt>
            <dd>{take.takeName}</dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>{formatPlaybackTime(controller.canonicalDuration)}</dd>
          </div>
        </dl>
        <TakeNavigation
          hasNext={nextTake !== undefined}
          hasPrevious={previousTake !== undefined}
          isSaving={isSaving}
          onNext={() => nextTake && requestNavigation(nextTake.takeName)}
          onPrevious={() => previousTake && requestNavigation(previousTake.takeName)}
          onSaveNext={requestSave}
          saveBlocked={openLabels.length > 0 || controller.isLoading}
        />
      </header>

      <section className="workspace-upper">
        <section
          aria-label="Configured video views"
          className="video-workspace"
          data-support-count={layout.supporting.length}
        >
          {layout.main ? (
            <VideoViewCard
              controller={controller}
              isMain
              status={controller.statusForView(layout.main.id)}
              view={layout.main}
            />
          ) : null}
          {layout.supporting.length > 0 ? (
            <div className="supporting-grid">
              {layout.supporting.map((view) => (
                <VideoViewCard
                  controller={controller}
                  isMain={false}
                  key={view.id}
                  status={controller.statusForView(view.id)}
                  view={view}
                />
              ))}
            </div>
          ) : null}
        </section>
        <EventPanel
          annotationState={annotation.state}
          disabled={!canAnnotate}
          events={config.events}
          onToggleEvent={annotation.toggleEvent}
        />
      </section>

      <section className="playback-status" aria-live="polite">
        {controller.durationMismatch ? (
          <p className="duration-warning" role="alert">
            <span aria-hidden="true">!</span>
            {messages.durationMismatch}
          </p>
        ) : null}
        {!controller.canPlay && !controller.isLoading ? (
          <p className="no-media-message">{messages.noPlayableMedia}</p>
        ) : null}
        {annotation.state.feedback ? (
          <p className="annotation-feedback" role="alert">
            {annotation.state.feedback.message}
          </p>
        ) : null}
        {openLabels.length > 0 ? (
          <p className="annotation-feedback" role="alert">
            {messages.openEventsSaveBlock(openLabels)}
          </p>
        ) : null}
        {operationError ? (
          <p className="annotation-feedback" role="alert">{operationError}</p>
        ) : null}
      </section>

      <SharedPlaybackControls controller={controller} />
      <AnnotationTimeline
        annotation={annotation}
        canonicalDuration={controller.canonicalDuration}
        canonicalTime={controller.canonicalTime}
        events={laneEvents}
        onInspectBoundary={inspectBoundary}
      />
      {dialog ? (
        <div className="dialog-backdrop">
          <section aria-modal="true" className="confirmation-dialog" role="dialog">
            <h3>{dialog.kind === "leave" ? "Discard unsaved changes?" : "Save empty take?"}</h3>
            <p>
              {dialog.kind === "leave"
                ? messages.discardConfirmation
                : messages.emptySaveConfirmation}
            </p>
            <div className="dialog-actions">
              <button onClick={() => setDialog(undefined)} type="button">Cancel</button>
              <button
                className={dialog.kind === "leave" ? "danger-action" : "save-next"}
                onClick={() => {
                  if (dialog.kind === "leave") goToTake(dialog.takeName);
                  else void persistAndContinue();
                }}
                type="button"
              >
                {dialog.kind === "leave" ? "Discard and continue" : "Save empty and continue"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
