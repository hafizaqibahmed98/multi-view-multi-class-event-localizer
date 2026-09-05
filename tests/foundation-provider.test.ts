import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createCachedFoundationLoader,
  createFileSystemConfigurationProvider,
  toSafeClientConfig,
  toSafeTakeList,
} from "@/server/foundation/provider";
import {
  createTemporaryDirectory,
  validEnvironment,
  validEventConfiguration,
  writeJson,
  writeWorkbook,
} from "./helpers/fixtures";

describe("filesystem configuration provider", () => {
  let directory: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ directory, cleanup } = await createTemporaryDirectory());
  });

  afterEach(async () => {
    await cleanup();
  });

  it("loads configuration and exposes only safe browser data", async () => {
    const datasetRoot = path.join(directory, "dataset");
    const annotationDirectory = path.join(directory, "annotations");
    const manifestPath = path.join(datasetRoot, "takes.xlsx");
    const eventConfigFile = path.join(directory, "config", "events.json");
    await mkdir(datasetRoot, { recursive: true });
    await mkdir(annotationDirectory, { recursive: true });
    await writeWorkbook(manifestPath);
    await writeJson(eventConfigFile, validEventConfiguration);
    await mkdir(path.join(datasetRoot, "take_001", "frame_aligned_videos"), {
      recursive: true,
    });
    await writeFile(
      path.join(datasetRoot, "take_001", "frame_aligned_videos", "cam03.mp4"),
      "fixture",
      "utf8",
    );

    const environment = validEnvironment({
      DATASET_ROOT: datasetRoot,
      TAKE_MANIFEST_XLSX: manifestPath,
      ANNOTATION_FILE: path.join(annotationDirectory, "annotations.json"),
      EVENT_CONFIG_FILE: eventConfigFile,
    });
    const provider = createFileSystemConfigurationProvider({
      environment,
      baseDirectory: directory,
    });
    let loadCount = 0;
    const loadFoundation = createCachedFoundationLoader({
      async load() {
        loadCount += 1;
        return provider.load();
      },
    });
    const [foundation, repeatedFoundation] = await Promise.all([
      loadFoundation(),
      loadFoundation(),
    ]);
    const safeConfig = toSafeClientConfig(foundation);
    const safeTakes = toSafeTakeList(foundation);
    const serialized = JSON.stringify({ safeConfig, safeTakes });

    expect(safeConfig.views).toEqual([
      { id: "view3", label: "View 3", isMain: true },
      { id: "ego", label: "Ego view", isMain: false },
    ]);
    expect(safeConfig.events.map(({ id }) => id)).toEqual(["walk", "run"]);
    expect(safeTakes).toEqual([
      { takeName: "take_001", index: 0 },
      { takeName: "take_002", index: 1 },
    ]);
    expect(serialized).not.toContain(directory);
    expect(serialized).not.toContain("ANNOTATION_FILE");
    expect(serialized).not.toContain("EVENT_CONFIG_FILE");
    expect(repeatedFoundation).toBe(foundation);
    expect(loadCount).toBe(1);
  });
});
