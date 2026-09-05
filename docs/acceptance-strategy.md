# Acceptance Test Strategy

The specification defines behavior-level acceptance scenarios for the v1 release candidate. Tests preserve the single-process, configuration-driven, file-based design and exercise server validation independently from browser validation.

## Planned test layers

- Unit tests cover configuration schemas, safe path resolution, timestamp rounding, overlap rules, annotation transitions, shortcut filtering, timeline geometry, playback coordination, navigation, and annotation document validation.
- Server integration tests cover XLSX order, browser-safe configuration projection, media validation, byte ranges, first-save creation, upsert semantics, whole-document validation, atomic failures, stale-file conflicts, malformed-file blocking, and historical preservation.
- Component and pure layout tests cover fixed view order, one-view and five-view composition, unavailable cards, canonical-clock fallback, timing thresholds, loading/reset state, configured event ordering, active presentation, occurrence controls, the shared playhead, clear confirmation, and 30-class lane rendering.
- Production HTTP smoke checks cover startup, rendered server output, safe configuration/take projections, and byte-range media delivery. Interactive Chromium checks cover playback, seeking, pointer editing, viewport layout, navigation dialogs, and the complete operator pilot when browser tooling is available.

## Required fixtures

Current fixtures and generated test state cover one and five views, missing main/supporting/all media, duration mismatch, 30 events, cross-class overlap, backward seeking, explicitly empty annotations, malformed annotation JSON, stale-file changes, simulated write failure, manifest gaps, final completion, and configuration evolution.

## Implemented automated checks

The automated suite verifies the Phase 0 repository contract and Phase 1/2 foundation plus safe media URLs, full and ranged media responses, invalid ranges, missing media, invalid take/view rejection, traversal rejection, one-view and five-view layout, configured order, fixed main position, canonical fallback, all-missing behavior, shared play/pause adapters, per-view seek clamping, drift correction, duration mismatch, Space filtering, and take-state initialization.

Phase 3 checks opening and closing, multiple and simultaneous classes, cross-class overlap, same-class rejection with adjacent boundaries, backward-start replacement, zero-duration rejection, natural-end auto-close, occurrence-ID uniqueness, edge edits and duration clamps, deletion, scoped clearing, active cancellation, clean take initialization, shortcut filtering, live-width timeline geometry, pause-before-boundary inspection, one shared playhead, confirmation UI, and 30 configured lanes. Real encoded-media browser playback remains an environment-dependent smoke check; persistence/reload, navigation, save failures, leave guards, and completion are Phase 4.

Phase 4 checks file absence before first save, insertion and resave without duplication, timestamp semantics, enabled empty events, duration/view provenance, manifest membership, occurrence IDs, bounds and overlap, stale conflicts, malformed input, atomic failure preservation, safe retry, historical takes/events, new configured events, exact Previous/Next order, dirty navigation decisions, duplicate-submission gating, persist-before-navigate sequencing, first-incomplete resume, final-row wrap, and completion.
