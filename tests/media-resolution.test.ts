import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DeploymentConfig } from "@/server/config/types";
import { getSafeTakeMetadata, resolveMediaPath } from "@/server/media/resolve-media";
import type { TakeManifestEntry } from "@/types";
import { createTemporaryDirectory } from "./helpers/fixtures";

describe("media path resolution and availability", () => {
  let directory: string;
  let cleanup: () => Promise<void>;
  let config: DeploymentConfig;
  const manifest: TakeManifestEntry[] = [{ takeName: "take_001", index: 0 }];

  beforeEach(async () => {
    ({ directory, cleanup } = await createTemporaryDirectory());
    config = {
      datasetRoot: path.join(directory, "dataset"),
      takeVideoSubdirectory: "frame_aligned_videos",
      manifestPath: path.join(directory, "takes.xlsx"),
      manifestSheet: "Takes",
      annotationFile: path.join(directory, "annotations.json"),
      eventConfigFile: path.join(directory, "events.json"),
      theme: "dark",
      viewOrder: ["view3", "ego"],
      viewFilenames: { view3: "cam03.mp4", ego: "egoView.mp4" },
    };
  });

  afterEach(async () => {
    await cleanup();
  });

  it("keeps a missing take navigable and marks all configured views unavailable", async () => {
    await expect(getSafeTakeMetadata(config, manifest, "take_001")).resolves.toEqual({
      takeName: "take_001",
      index: 0,
      views: [
        { id: "view3", label: "View 3", available: false },
        { id: "ego", label: "Ego view", available: false },
      ],
    });
  });

  it("preserves view order and reports partially missing media", async () => {
    const mediaDirectory = path.join(
      config.datasetRoot,
      "take_001",
      config.takeVideoSubdirectory,
    );
    await mkdir(mediaDirectory, { recursive: true });
    await writeFile(path.join(mediaDirectory, "cam03.mp4"), "fixture", "utf8");

    const metadata = await getSafeTakeMetadata(config, manifest, "take_001");
    expect(metadata.views).toEqual([
      {
        id: "view3",
        label: "View 3",
        available: true,
        mediaUrl: "/api/media/take_001/view3",
      },
      { id: "ego", label: "Ego view", available: false },
    ]);
    expect(JSON.stringify(metadata)).not.toContain(directory);
  });

  it("ignores files belonging to unconfigured logical views", async () => {
    const mediaDirectory = path.join(
      config.datasetRoot,
      "take_001",
      config.takeVideoSubdirectory,
    );
    await mkdir(mediaDirectory, { recursive: true });
    await writeFile(path.join(mediaDirectory, "cam01.mp4"), "unused", "utf8");

    const metadata = await getSafeTakeMetadata(config, manifest, "take_001");
    expect(metadata.views.map(({ id }) => id)).toEqual(["view3", "ego"]);
    expect(JSON.stringify(metadata)).not.toContain("view1");
    expect(JSON.stringify(metadata)).not.toContain("cam01.mp4");
  });

  it("rejects takes outside the loaded manifest", () => {
    expect(() => resolveMediaPath(config, manifest, "take_999", "ego")).toThrowError(
      /not present in the configured manifest/,
    );
  });

  it("rejects logical views that are not configured", () => {
    expect(() => resolveMediaPath(config, manifest, "take_001", "view1")).toThrowError(
      /not configured/,
    );
  });
});
