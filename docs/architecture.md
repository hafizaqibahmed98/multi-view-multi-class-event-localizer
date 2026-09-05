# Application Architecture

The application is one TypeScript Next.js repository and one production Node.js process. Browser components receive only safe data; server-only modules own filesystem access, validation, path resolution, media delivery, and annotation persistence.

## Repository structure

```text
src/
  app/                  App Router entry points and global shell
  components/
    workspace/          Multi-view workspace composition
    playback/           Shared playback controls and synchronization
    events/             Configured event list and active state
    timeline/           Event lanes and boundary editing
    navigation/         Previous, Next, Save & Next, and leave guards
    common/             Shared presentational controls
  server/
    config/             Validated, replaceable configuration provider
    manifest/           XLSX loading and safe take discovery
    media/              Media resolution, metadata, and byte-range responses
    annotations/        Validation, stale-write detection, and atomic persistence
  schemas/              Shared validation schemas; server remains authoritative
  types/                Shared TypeScript domain contracts
  messages/             Centralized English user-facing text
  styles/               Theme tokens and global style foundations
```

The application implements the configuration, manifest, media-delivery, workspace, shared-playback, annotation-state, server persistence, navigation, resume, and completion boundaries.

## Core boundaries

The configuration provider validates deployment paths, view composition, event definitions, theme, and the XLSX manifest at startup. It exposes only browser-safe metadata so server filesystem paths never reach client code.

Manifest loading, media access, and annotation persistence are server-only responsibilities. Route handlers validate logical identifiers and delegate filesystem work to dedicated server modules rather than performing it inside client components.

The API exposes safe configuration, take metadata, media, and annotation endpoints. Media responses support byte-range requests for efficient video seeking without exposing local filesystem paths.

The shared playback controller coordinates all available video elements through one canonical time, shared Play/Pause, shared seeking, duration checks, and drift correction. Playback logic is kept separate from presentation so timing behavior can be tested independently.

The annotation controller uses canonical playback time to create and edit event occurrences. Annotation rules such as 0.1-second precision, same-class overlap prevention, backward-start replacement, deletion, clearing, and dirty state are handled in a dedicated state layer.

The timeline renders one lane per configured event, plus read-only historical event lanes when needed. Completed occurrences support edge-only boundary editing, while the shared playhead remains read-only.

## Persistence model

Annotations are stored in one server-managed JSON document with at most one completed entry per take. The server validates the full document before saving, detects external file changes, and uses atomic replacement so a failed save does not corrupt the existing annotation file.

The XLSX manifest defines take order and is never modified by the application.

Saved annotation state can be reloaded for review and editing. Unsaved client state drives navigation warnings, and the completion page appears only when every manifest take has been completed.

## Scope boundary

The architecture intentionally excludes databases, authentication, users, roles, administrative pages, public multi-user hardening, cloud dependencies, and mobile-first UI.
