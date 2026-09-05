export const LOGICAL_VIEW_IDS = ["ego", "view1", "view2", "view3", "view4"] as const;

export type LogicalViewId = (typeof LOGICAL_VIEW_IDS)[number];
export type AppTheme = "light" | "dark";

export const LOGICAL_VIEW_LABELS: Record<LogicalViewId, string> = {
  ego: "Ego view",
  view1: "View 1",
  view2: "View 2",
  view3: "View 3",
  view4: "View 4",
};

export interface SafeViewConfig {
  id: LogicalViewId;
  label: string;
  isMain: boolean;
}

export interface EventDefinition {
  id: string;
  label: string;
  shortcut: string;
  color: string;
  order: number;
  enabled: boolean;
}

export interface EventConfig {
  version: string;
  events: EventDefinition[];
}

export type SafeEventDefinition = Omit<EventDefinition, "enabled">;

export interface TakeManifestEntry {
  takeName: string;
  index: number;
}

export interface SafeViewAvailability {
  id: LogicalViewId;
  label: string;
  available: boolean;
  mediaUrl?: string;
}

export interface SafeTakeMetadata extends TakeManifestEntry {
  views: SafeViewAvailability[];
}

export interface SafeClientConfig {
  theme: AppTheme;
  views: SafeViewConfig[];
  eventConfigVersion: string;
  events: SafeEventDefinition[];
}

export interface AnnotationOccurrence {
  occurrenceId: string;
  start: number;
  end: number;
  autoClosed: boolean;
}

export interface EventAnnotationDraft {
  eventId: string;
  occurrences: AnnotationOccurrence[];
  openStart?: number;
}

export type AnnotationFeedbackCode =
  | "INVALID_TIME"
  | "ZERO_DURATION"
  | "SAME_CLASS_OVERLAP"
  | "INVALID_BOUNDARY";

export interface AnnotationFeedback {
  code: AnnotationFeedbackCode;
  eventId: string;
  message: string;
}

export interface AnnotationDraftState {
  takeName: string;
  eventConfigVersion: string;
  events: Record<string, EventAnnotationDraft>;
  dirty: boolean;
  feedback?: AnnotationFeedback;
}

export interface PersistedViewAvailability {
  id: LogicalViewId;
  available: boolean;
}

export interface PersistedEventAnnotation {
  id: string;
  name: string;
  color: string;
  occurrences: AnnotationOccurrence[];
}

export interface PersistedTakeAnnotation {
  takeName: string;
  completed: true;
  eventConfigVersion: string;
  durationSeconds: number;
  createdAt: string;
  updatedAt: string;
  views: PersistedViewAvailability[];
  events: PersistedEventAnnotation[];
}

export interface AnnotationDocument {
  schemaVersion: "1.0";
  eventConfigVersion: string;
  createdAt: string;
  updatedAt: string;
  takes: PersistedTakeAnnotation[];
}

export interface SaveTakeEventInput {
  id: string;
  occurrences: AnnotationOccurrence[];
}

export interface SaveTakeAnnotationInput {
  takeName: string;
  durationSeconds: number;
  events: SaveTakeEventInput[];
}

export interface HistoricalEventDefinition {
  id: string;
  label: string;
  color: string;
  occurrences: AnnotationOccurrence[];
  readOnly: true;
}

export interface AnnotationLaneDefinition extends SafeEventDefinition {
  readOnly?: boolean;
}
