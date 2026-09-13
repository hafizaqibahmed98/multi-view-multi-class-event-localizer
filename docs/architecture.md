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