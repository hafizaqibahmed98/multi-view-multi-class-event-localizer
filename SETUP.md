# Multi View Multi Class Event Localizer Setup

The application validates deployment configuration, event definitions, and the XLSX take manifest when the Node.js server initializes. Startup stops with an actionable error when required configuration is missing or invalid. Configuration changes take effect after restarting the application.

## Prerequisites

Use Node.js 20.9 or newer and pnpm. The application runs as one Next.js Node process and does not require a database, or a cloud service.

A current Chromium-based desktop browser and a viewport of at least 1280 by 720 pixels are the v1 targets.

## pnpm installation

Enable Corepack and activate the pnpm version declared in `package.json`:

```sh
corepack enable
corepack install
```

If Corepack is unavailable, install pnpm using the official pnpm instructions and verify it with `pnpm --version`.

## Dependency installation

Install the locked dependencies from the repository root:

```sh
pnpm install --frozen-lockfile
```

## Development mode

Create `.env.local` as described below, prepare the referenced event configuration and XLSX workbook, then run:

```sh
pnpm dev
```

Open the local URL printed by Next.js. The workspace resumes the first manifest take without a completed annotation entry, or opens the completion page when all manifest takes are complete.

## Production build

Build without embedding deployment filesystem paths:

```sh
pnpm build
```

## Production start

After a successful build and with the required environment available, start the single production process:

```sh
pnpm start
```

The server initialization hook validates configuration and loads the manifest before the application workspace can be served.

## Environment variables

Copy `.env.example` to `.env.local` and replace the neutral examples with paths valid for the server. Do not commit `.env.local`, credentials, machine-specific paths, or study data.

```dotenv
DATASET_ROOT=/path/event-localizer/dataset
TAKE_VIDEO_SUBDIR=frame_aligned_videos
TAKE_MANIFEST_XLSX=/path/event-localizer/dataset/takes.xlsx
TAKE_MANIFEST_SHEET=Takes
ANNOTATION_FILE=/path/event-localizer/annotations/annotations.json
EVENT_CONFIG_FILE=./config/events.json
APP_THEME=dark
VIDEO_NUMBER_OF_VIEWS=3
VIDEO_VIEW_ORDER=view3,ego,view1
VIDEO_FILENAME_EGO=egoView.mp4
VIDEO_FILENAME_VIEW1=cam01.mp4
VIDEO_FILENAME_VIEW2=cam02.mp4
VIDEO_FILENAME_VIEW3=cam03.mp4
VIDEO_FILENAME_VIEW4=cam04.mp4
```

The required deployment settings are:

- `DATASET_ROOT`: readable directory containing one folder per take.
- `TAKE_VIDEO_SUBDIR`: safe relative media directory inside each take folder.
- `TAKE_MANIFEST_XLSX`: readable `.xlsx` workbook.
- `TAKE_MANIFEST_SHEET`: worksheet containing the manifest.
- `ANNOTATION_FILE`: configurable `.json` persistence target. When omitted it uses the agreed deployment default `C:\DFKI\annotations.json`. Its parent directory must already exist and be writable. The neutral example explicitly overrides that default.
- `EVENT_CONFIG_FILE`: readable `.json` event configuration.
- `APP_THEME`: exactly `light` or `dark`.
- `VIDEO_NUMBER_OF_VIEWS`: integer from 1 through 5.
- `VIDEO_VIEW_ORDER`: comma-separated unique logical IDs. Supported IDs are `ego`, `view1`, `view2`, `view3`, and `view4`; the first ID is the permanent main position.
- `VIDEO_FILENAME_EGO` and `VIDEO_FILENAME_VIEW1` through `VIDEO_FILENAME_VIEW4`: plain filenames. Every view included in `VIDEO_VIEW_ORDER` must have its matching filename.

Server filesystem paths are retained only in server modules and are never returned by browser APIs.

## Dataset directory structure

Each manifest `take_name` is a direct folder below `DATASET_ROOT`. Configured files are resolved from `DATASET_ROOT`, `take_name`, `TAKE_VIDEO_SUBDIR`, and the configured logical-view filename.

```text
dataset/
  takes.xlsx
  take_001/
    frame_aligned_videos/
      egoView.mp4
      cam03.mp4
  take_002/
    frame_aligned_videos/
      egoView.mp4
      cam03.mp4
```

A missing take folder or configured video remains visible in its fixed workspace position as `Media unavailable`. Other available views continue to load and play.

Configured videos are not copied into the application or `.next` bundle. The browser requests them through a validated server route. MP4 is the default expected format; WebM, Ogg video, and QuickTime extensions receive their corresponding media content types. Actual playback support depends on codecs available in the target browser, so study media should be verified in the deployment's Chromium-based browser.

## XLSX manifest

The configured worksheet must contain a first-row column named exactly `take_name`. Additional columns are ignored. Non-empty rows define navigation order from top to bottom, blank `take_name` rows are ignored, and duplicates fail startup validation.

```text
take_name
take_001
take_002
take_003
```

Every value must be a safe folder name. Absolute paths, path separators, and parent-relative values such as `../take_001` are rejected. The workbook is loaded once into the server foundation and is never modified.

## Event configuration

Copy the synthetic example before starting a local deployment:

```sh
cp config/events.example.json config/events.json
```

On PowerShell, use:

```powershell
Copy-Item config/events.example.json config/events.json
```

The root object contains a non-empty `version` and an `events` array. Every event contains `id`, `label`, `shortcut`, `color`, `order`, and `enabled`. IDs use letters, digits, underscores, or hyphens; shortcuts are one letter or digit; colors use six-digit hexadecimal notation. Enabled IDs and shortcuts must be unique, with shortcut comparison performed case-insensitively.

Enabled events are exposed in numeric `order`. Disabled entries remain in validated server configuration but are omitted from the browser-facing enabled-event list.

## Annotation storage

Annotations are stored in the file configured by `ANNOTATION_FILE`.

The parent directory must already exist and be writable by the Node.js process. The JSON file, `annotations.json`, itself may be absent initially and is created on the first successful save.

The application protects the annotation file against malformed data, failed writes, and external modifications. If a stale-file conflict is detected, reload the application before saving again.

Regular backups of the annotation file are recommended.

## Local and LAN usage

The application is intended for a trusted local workstation or trusted LAN. It is not an internet-hardened multi-user service. Configure network binding at process launch using the supported Next.js options and restrict access with operating-system or trusted-network controls.

## File permissions

The Node process requires read access to `DATASET_ROOT`, the workbook, event configuration, take directories, media files, and an existing annotations file. The `ANNOTATION_FILE` parent directory requires write permission for first-save creation and same-directory atomic replacement. The target file, when present, must also be writable.

## Startup validation

Startup fails before serving the application when required environment variables, view composition, theme, dataset root, annotation directory, event configuration, workbook, worksheet, or manifest column are invalid. Browser responses use centralized safe messages and do not contain raw stack traces or filesystem paths.

## Troubleshooting

- Missing environment variable: compare `.env.local` with `.env.example`, then restart.
- Invalid view configuration: ensure the count matches the unique IDs in `VIDEO_VIEW_ORDER` and every configured ID has a filename.
- Missing or unreadable `EVENT_CONFIG_FILE`: confirm that the configured file exists, is readable by the Node process, and uses a `.json` extension.
- Malformed event configuration: validate JSON syntax and every required event field; check duplicate enabled IDs and shortcuts, one-letter-or-digit shortcuts, and six-digit hexadecimal colors.
- Missing or corrupted XLSX workbook: confirm `TAKE_MANIFEST_XLSX` exists, is readable, uses the `.xlsx` extension, and opens as a real XLSX workbook rather than a renamed CSV or text file.
- Missing worksheet: set `TAKE_MANIFEST_SHEET` to the exact worksheet name in the workbook.
- Missing `take_name` column: add a first-row header named exactly `take_name`; blank values are ignored and duplicate or unsafe folder names are rejected.
- Unavailable media: confirm the take folder, video subdirectory, and configured filenames. Missing files do not remove the take.
- Video stays in loading state: verify the file is readable, has a browser-supported container and codec, and permits metadata reads through the media endpoint.
- Seeking fails: inspect the media response for `Accept-Ranges: bytes`, `206` status, and a valid `Content-Range`; reverse proxies must preserve the `Range` request header.
- Duration warning: confirm that synchronized source files differ by no more than 0.5 seconds, or regenerate the aligned media.
- Annotation target failure: create the parent directory and grant the Node process write permission.
- Malformed annotations: restore a valid backup or repair the JSON/schema error, then restart; the application will not overwrite it.
- Stale annotation conflict: another process changed the file after load. Preserve any browser work separately if needed, reload the application, review the external change, and retry.
- Save failure: verify free disk space and create/replace/delete permission in the annotation directory. The existing file and current browser state remain unchanged.
- Build failure: run `pnpm lint`, `pnpm typecheck`, and `pnpm test` independently.
