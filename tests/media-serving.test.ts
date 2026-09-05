import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DeploymentConfig } from "@/server/config/types";
import { serveConfiguredMedia } from "@/server/media/serve-media";
import type { LogicalViewId, TakeManifestEntry } from "@/types";
import { createTemporaryDirectory } from "./helpers/fixtures";

describe("configured media responses", () => {
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
    const mediaDirectory = path.join(
      config.datasetRoot,
      "take_001",
      config.takeVideoSubdirectory,
    );
    await mkdir(mediaDirectory, { recursive: true });
    await writeFile(path.join(mediaDirectory, "cam03.mp4"), Buffer.from("0123456789"));
  });

  afterEach(async () => {
    await cleanup();
  });

  function request(range?: string): Request {
    return new Request("http://localhost/api/media/take_001/view3", {
      headers: range ? { Range: range } : undefined,
    });
  }

  it("serves a configured media file without exposing its path", async () => {
    const response = await serveConfiguredMedia(
      request(),
      config,
      manifest,
      "take_001",
      "view3",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-length")).toBe("10");
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(await response.text()).toBe("0123456789");
    expect([...response.headers.values()].join(" ")).not.toContain(directory);
  });

  it("serves bounded, open-ended, and suffix byte ranges", async () => {
    const bounded = await serveConfiguredMedia(
      request("bytes=2-5"), config, manifest, "take_001", "view3",
    );
    expect(bounded.status).toBe(206);
    expect(bounded.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(await bounded.text()).toBe("2345");

    const openEnded = await serveConfiguredMedia(
      request("bytes=7-"), config, manifest, "take_001", "view3",
    );
    expect(await openEnded.text()).toBe("789");

    const suffix = await serveConfiguredMedia(
      request("bytes=-3"), config, manifest, "take_001", "view3",
    );
    expect(await suffix.text()).toBe("789");
  });

  it.each(["bytes=10-12", "bytes=8-4", "items=0-2", "bytes=0-1,4-5"])(
    "returns 416 for invalid range %s",
    async (range) => {
      const response = await serveConfiguredMedia(
        request(range), config, manifest, "take_001", "view3",
      );
      expect(response.status).toBe(416);
      expect(response.headers.get("content-range")).toBe("bytes */10");
      expect(await response.json()).toEqual({
        error: {
          code: "INVALID_RANGE",
          message: "The requested media byte range is not satisfiable.",
        },
      });
    },
  );

  it("returns a safe missing-media error", async () => {
    await expect(
      serveConfiguredMedia(request(), config, manifest, "take_001", "ego"),
    ).rejects.toMatchObject({
      code: "MEDIA_UNAVAILABLE",
      status: 404,
      message: "The requested configured media file is unavailable.",
    });
  });

  it("rejects invalid takes, views, and traversal attempts", async () => {
    await expect(
      serveConfiguredMedia(request(), config, manifest, "take_999", "view3"),
    ).rejects.toMatchObject({ code: "TAKE_NOT_FOUND", status: 404 });
    await expect(
      serveConfiguredMedia(request(), config, manifest, "take_001", "view1"),
    ).rejects.toMatchObject({ code: "VIEW_NOT_CONFIGURED", status: 404 });
    await expect(
      serveConfiguredMedia(request(), config, manifest, "../take_001", "view3"),
    ).rejects.toMatchObject({ code: "TAKE_NOT_FOUND" });
    await expect(
      serveConfiguredMedia(
        request(), config, manifest, "take_001", "../view3" as LogicalViewId,
      ),
    ).rejects.toMatchObject({ code: "VIEW_NOT_CONFIGURED" });
  });
});
