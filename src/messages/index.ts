export const messages = {
  applicationLabel: "Event Localizer",
  phaseLabel: "Version 1 release candidate",
  phaseDescription:
    "Configured views and event classes share one canonical annotation timeline.",
  unexpectedError:
    "The server foundation could not be initialized. Check the server logs and deployment configuration.",
  missingEnvironmentVariable: (name: string) =>
    `Missing required environment variable: ${name}. Add it to the server environment and restart the application.`,
  invalidTheme: "APP_THEME must be exactly light or dark.",
  invalidViewCount:
    "VIDEO_NUMBER_OF_VIEWS must be an integer from 1 through 5.",
  invalidViewOrder:
    "VIDEO_VIEW_ORDER must contain unique supported view IDs and match VIDEO_NUMBER_OF_VIEWS.",
  unknownView: "VIDEO_VIEW_ORDER contains an unsupported logical view ID.",
  missingViewFilename: (id: string) =>
    `The configured logical view ${id} requires its VIDEO_FILENAME setting.`,
  invalidViewFilename:
    "Configured video filenames must be plain filenames without absolute paths or traversal segments.",
  invalidVideoSubdirectory:
    "TAKE_VIDEO_SUBDIR must be a relative directory without parent traversal.",
  invalidManifestExtension:
    "TAKE_MANIFEST_XLSX must identify an .xlsx workbook.",
  invalidEventConfigExtension: "EVENT_CONFIG_FILE must identify a .json file.",
  invalidAnnotationPath:
    "ANNOTATION_FILE must resolve to a writable .json file path.",
  datasetUnavailable: "DATASET_ROOT must identify a readable directory.",
  annotationDirectoryUnavailable:
    "The ANNOTATION_FILE parent directory must exist and be writable by the server process.",
  eventConfigUnavailable:
    "EVENT_CONFIG_FILE must identify a readable JSON file.",
  malformedEventJson: "The configured event file is not valid JSON.",
  invalidEventConfig:
    "The configured event file does not match the required event schema.",
  invalidEventField: (field: string) =>
    `The configured event file does not match the required event schema. Check the ${field} field.`,
  duplicateEventId:
    "The configured event file does not match the required event schema. Enabled event IDs must be unique.",
  duplicateEventShortcut:
    "The configured event file does not match the required event schema. Enabled shortcuts must be unique regardless of letter case.",
  emptyEventLabel:
    "The configured event file does not match the required event schema. Enabled event labels must not be blank.",
  manifestUnavailable:
    "TAKE_MANIFEST_XLSX must identify a readable XLSX workbook.",
  malformedManifest:
    "The configured XLSX workbook could not be read. Confirm it is a valid, uncorrupted XLSX workbook.",
  worksheetMissing:
    "The configured worksheet was not found. Check TAKE_MANIFEST_SHEET and restart the application.",
  takeNameColumnMissing:
    "The configured worksheet must contain a take_name column in its first row.",
  duplicateTakeName: "The manifest contains a duplicate take_name value.",
  invalidTakeName:
    "Every non-empty take_name must be a safe folder name, not an absolute or parent-relative path.",
  takeNotFound: "The requested take is not present in the configured manifest.",
  viewNotConfigured:
    "The requested logical view is not configured for this deployment.",
  mediaUnavailable: "Media unavailable",
  mediaReadFailure: "The requested configured media file is unavailable.",
  invalidRange: "The requested media byte range is not satisfiable.",
  durationMismatch:
    "Duration mismatch detected. Views differ from the playback clock by more than 0.5 seconds.",
  noTakes: "No takes were discovered in the configured manifest.",
  noPlayableMedia: "No configured media is available for this take.",
  annotationTimeUnavailable:
    "Annotation requires playable media with a valid canonical duration.",
  annotationLaterEndpoint:
    "Choose a later endpoint. Start and end round to the same tenth of a second.",
  annotationOverlap:
    "This change would overlap another occurrence in the same event class.",
  annotationInvalidBoundary:
    "The boundary must preserve start before end and remain within the take duration.",
  annotationUnsaved: "Unsaved annotation changes",
  annotationClean: "No unsaved annotation changes",
  annotationReady: "Choose an event or use its shortcut.",
  clearEventConfirmation: (label: string) =>
    `Clear every completed and active ${label} annotation for this take?`,
  malformedAnnotations:
    "The existing annotations file is malformed or invalid. Correct it and restart the application before saving.",
  staleAnnotations:
    "The annotations file changed outside this application. Reload the application before trying to save again.",
  invalidAnnotationPayload:
    "The annotation save request is invalid. Review the current take and try again.",
  annotationWriteFailure:
    "The annotation file could not be replaced safely. Your unsaved annotations remain in this browser.",
  failedTakeLoad:
    "The requested take could not be loaded. Reload the application and check the server configuration.",
  failedSave:
    "The take could not be saved. Your unsaved annotations have been preserved.",
  openEventsSaveBlock: (labels: readonly string[]) =>
    `Close or cancel these active events before saving: ${labels.join(", ")}.`,
  emptySaveConfirmation:
    "This take has no completed occurrences. Save it as explicitly empty and continue?",
  discardConfirmation:
    "Discard all unsaved changes for this take and continue?",
  loadingTake: "Loading take and saved annotations…",
  completionTitle: "Annotation complete",
  completionMessage:
    "Congratulations. Every manifest take has a completed annotation entry.",
} as const;
