import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { parseEventConfig } from "@/schemas/event-config";
import {
  AnnotationRepository,
  atomicReplaceFile,
} from "@/server/annotations/repository";
import { projectTakeAnnotations } from "@/server/annotations/projection";
import type { ServerFoundation } from "@/server/foundation/provider";
import type {
  AnnotationDocument,
  SaveTakeAnnotationInput,
} from "@/types";
import {
  createTemporaryDirectory,
  validEventConfiguration,
} from "./helpers/fixtures";

function foundation(annotationFile: string): ServerFoundation {
  return {
    deployment: {
      datasetRoot: path.dirname(annotationFile),
      takeVideoSubdirectory: "videos",
      manifestPath: "takes.xlsx",
      manifestSheet: "Takes",
      annotationFile,
      eventConfigFile: "events.json",
      theme: "dark",
      viewOrder: ["view3", "ego"],
      viewFilenames: { view3: "cam03.mp4", ego: "ego.mp4" },
    },
    eventConfiguration: parseEventConfig(validEventConfiguration),
    manifest: [
      { takeName: "take_001", index: 0 },
      { takeName: "take_002", index: 1 },
    ],
  };
}

function input(
  takeName = "take_001",
  walkOccurrences: SaveTakeAnnotationInput["events"][number]["occurrences"] = [],
): SaveTakeAnnotationInput {
  return {
    takeName,
    durationSeconds: 10,
    events: [
      { id: "walk", occurrences: walkOccurrences },
      { id: "run", occurrences: [] },
    ],
  };
}

function clock() {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 8, 4, 10, 0, tick++));
}

const views = [
  { id: "view3" as const, available: true },
  { id: "ego" as const, available: false },
];

describe("annotation persistence", () => {
  let directory: string;
  let annotationFile: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ directory, cleanup } = await createTemporaryDirectory());
    annotationFile = path.join(directory, "annotations.json");
  });

  afterEach(async () => cleanup());

  it("keeps a missing file in memory until the first successful save", async () => {
    const repository = new AnnotationRepository({
      annotationFile,
      foundation: foundation(annotationFile),
      now: clock(),
    });
    await expect(readFile(annotationFile, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    expect((await repository.snapshot()).takes).toEqual([]);
    await expect(readFile(annotationFile, "utf8")).rejects.toMatchObject({ code: "ENOENT" });

    const saved = await repository.save(input(), views);
    expect(saved.takes).toHaveLength(1);
    expect(JSON.parse(await readFile(annotationFile, "utf8"))).toEqual(saved);
    expect(await readdir(directory)).toEqual(["annotations.json"]);
  });

  it("inserts then updates one manifest take without duplication", async () => {
    const repository = new AnnotationRepository({
      annotationFile,
      foundation: foundation(annotationFile),
      now: clock(),
    });
    const first = await repository.save(input(), views);
    const createdAt = first.takes[0].createdAt;
    const second = await repository.save(
      input("take_001", [
        { occurrenceId: "walk-1", start: 1, end: 2, autoClosed: false },
      ]),
      views,
    );

    expect(second.takes).toHaveLength(1);
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt).not.toBe(first.updatedAt);
    expect(second.takes[0].createdAt).toBe(createdAt);
    expect(second.takes[0].updatedAt).not.toBe(first.takes[0].updatedAt);
    expect(second.takes[0].events.map(({ id }) => id)).toEqual(["walk", "run"]);
    expect(second.takes[0].events[1].occurrences).toEqual([]);
    expect(second.takes[0]).toMatchObject({
      eventConfigVersion: "1.0",
      durationSeconds: 10,
      views,
    });
  });

  it("keeps manifest takes ordered regardless of save order", async () => {
    const repository = new AnnotationRepository({
      annotationFile,
      foundation: foundation(annotationFile),
      now: clock(),
    });
    await repository.save(input("take_002"), views);
    const saved = await repository.save(input("take_001"), views);
    expect(saved.takes.map(({ takeName }) => takeName)).toEqual(["take_001", "take_002"]);
  });

  it("validates manifest membership, enabled-event completeness, IDs, bounds, and overlap", async () => {
    const repository = new AnnotationRepository({
      annotationFile,
      foundation: foundation(annotationFile),
      now: clock(),
    });
    await expect(repository.save(input("unknown"), views)).rejects.toMatchObject({
      code: "ANNOTATION_INVALID",
    });
    await expect(
      repository.save({ ...input(), events: [{ id: "walk", occurrences: [] }] }, views),
    ).rejects.toMatchObject({ code: "ANNOTATION_INVALID" });
    await expect(
      repository.save(
        input("take_001", [
          { occurrenceId: "duplicate", start: 1, end: 3, autoClosed: false },
          { occurrenceId: "duplicate", start: 4, end: 5, autoClosed: false },
        ]),
        views,
      ),
    ).rejects.toMatchObject({ code: "ANNOTATION_INVALID" });
    await expect(
      repository.save(
        input("take_001", [
          { occurrenceId: "one", start: 1, end: 4, autoClosed: false },
          { occurrenceId: "two", start: 3, end: 5, autoClosed: false },
        ]),
        views,
      ),
    ).rejects.toMatchObject({ code: "ANNOTATION_INVALID" });
    await expect(
      repository.save(
        input("take_001", [
          { occurrenceId: "late", start: 9, end: 11, autoClosed: false },
        ]),
        views,
      ),
    ).rejects.toMatchObject({ code: "ANNOTATION_INVALID" });
  });

  it("rejects stale external modification without overwriting it", async () => {
    const repository = new AnnotationRepository({
      annotationFile,
      foundation: foundation(annotationFile),
      now: clock(),
    });
    await repository.save(input(), views);
    const external = JSON.parse(await readFile(annotationFile, "utf8")) as AnnotationDocument;
    external.updatedAt = "2026-09-04T12:00:00.000Z";
    await writeFile(annotationFile, JSON.stringify(external), "utf8");

    await expect(repository.save(input(), views)).rejects.toMatchObject({
      code: "ANNOTATION_STALE",
    });
    expect(JSON.parse(await readFile(annotationFile, "utf8"))).toEqual(external);
  });

  it("blocks saves when the existing file is malformed", async () => {
    await writeFile(annotationFile, "{broken", "utf8");
    const repository = new AnnotationRepository({
      annotationFile,
      foundation: foundation(annotationFile),
    });
    await expect(repository.snapshot()).rejects.toMatchObject({ code: "ANNOTATION_MALFORMED" });
    await expect(repository.save(input(), views)).rejects.toMatchObject({
      code: "ANNOTATION_MALFORMED",
    });
    expect(await readFile(annotationFile, "utf8")).toBe("{broken");
  });

  it("rejects non-UTC persisted timestamps", async () => {
    const timestamp = "2026-09-04T12:00:00.000+02:00";
    await writeFile(annotationFile, JSON.stringify({
      schemaVersion: "1.0",
      eventConfigVersion: "1.0",
      createdAt: timestamp,
      updatedAt: timestamp,
      takes: [],
    }), "utf8");
    const repository = new AnnotationRepository({
      annotationFile,
      foundation: foundation(annotationFile),
    });

    await expect(repository.snapshot()).rejects.toMatchObject({
      code: "ANNOTATION_MALFORMED",
    });
  });

  it("preserves the old file on atomic failure and retries without duplication", async () => {
    const initial = new AnnotationRepository({
      annotationFile,
      foundation: foundation(annotationFile),
      now: clock(),
    });
    await initial.save(input(), views);
    const before = await readFile(annotationFile, "utf8");
    let attempts = 0;
    const retrying = new AnnotationRepository({
      annotationFile,
      foundation: foundation(annotationFile),
      now: clock(),
      atomicWriter: async (target, contents) => {
        attempts += 1;
        if (attempts === 1) throw new Error("simulated replacement failure");
        await atomicReplaceFile(target, contents);
      },
    });
    await retrying.snapshot();
    await expect(retrying.save(input(), views)).rejects.toMatchObject({
      code: "ANNOTATION_WRITE_FAILED",
    });
    expect(await readFile(annotationFile, "utf8")).toBe(before);
    const saved = await retrying.save(input(), views);
    expect(saved.takes.filter((take) => take.takeName === "take_001")).toHaveLength(1);
  });

  it("preserves removed takes and historical events", async () => {
    const timestamp = "2026-09-04T10:00:00.000Z";
    const seed: AnnotationDocument = {
      schemaVersion: "1.0",
      eventConfigVersion: "old",
      createdAt: timestamp,
      updatedAt: timestamp,
      takes: [
        {
          takeName: "removed_take",
          completed: true,
          eventConfigVersion: "old",
          durationSeconds: 5,
          createdAt: timestamp,
          updatedAt: timestamp,
          views: [],
          events: [],
        },
        {
          takeName: "take_001",
          completed: true,
          eventConfigVersion: "old",
          durationSeconds: 10,
          createdAt: timestamp,
          updatedAt: timestamp,
          views: [],
          events: [
            {
              id: "historical",
              name: "Historical",
              color: "#888888",
              occurrences: [
                { occurrenceId: "history-1", start: 1, end: 2, autoClosed: false },
              ],
            },
          ],
        },
      ],
    };
    await writeFile(annotationFile, JSON.stringify(seed), "utf8");
    const repository = new AnnotationRepository({
      annotationFile,
      foundation: foundation(annotationFile),
      now: clock(),
    });
    const saved = await repository.save(input(), views);
    expect(saved.takes.map(({ takeName }) => takeName)).toEqual(["take_001", "removed_take"]);
    expect(saved.takes[0].events.at(-1)?.id).toBe("historical");
  });
});

describe("saved annotation projection", () => {
  it("adds new configured events empty and surfaces unknown stored events read-only", () => {
    const timestamp = "2026-09-04T10:00:00.000Z";
    const document: AnnotationDocument = {
      schemaVersion: "1.0",
      eventConfigVersion: "old",
      createdAt: timestamp,
      updatedAt: timestamp,
      takes: [{
        takeName: "take_001",
        completed: true,
        eventConfigVersion: "old",
        durationSeconds: 10,
        createdAt: timestamp,
        updatedAt: timestamp,
        views: [],
        events: [{
          id: "removed",
          name: "Removed event",
          color: "#888888",
          occurrences: [{ occurrenceId: "old-1", start: 1, end: 2, autoClosed: false }],
        }],
      }],
    };
    const projection = projectTakeAnnotations(document, "take_001", [
      { id: "new", label: "New", shortcut: "N", color: "#123456", order: 1 },
    ]);
    expect(projection.initial.new).toBeUndefined();
    expect(projection.historicalEvents).toEqual([{
      id: "removed",
      label: "Removed event",
      color: "#888888",
      occurrences: [{ occurrenceId: "old-1", start: 1, end: 2, autoClosed: false }],
      readOnly: true,
    }]);
  });
});
