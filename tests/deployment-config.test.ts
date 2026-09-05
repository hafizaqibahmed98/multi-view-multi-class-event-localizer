import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { parseDeploymentEnvironment } from "@/schemas/deployment-config";
import { loadDeploymentConfig } from "@/server/config/load-deployment-config";
import { FoundationError } from "@/server/errors";
import { createTemporaryDirectory, validEnvironment } from "./helpers/fixtures";

describe("deployment configuration", () => {
  it("parses the configured view order and resolves server paths", () => {
    const baseDirectory = path.resolve("fixture-root");
    const config = parseDeploymentEnvironment(validEnvironment(), baseDirectory);

    expect(config.theme).toBe("dark");
    expect(config.viewOrder).toEqual(["view3", "ego"]);
    expect(config.datasetRoot).toBe(path.resolve(baseDirectory, "dataset"));
    expect(config.annotationFile.endsWith("annotations.json")).toBe(true);
  });

  it("uses the agreed configurable annotation default", () => {
    const config = parseDeploymentEnvironment(
      validEnvironment({ ANNOTATION_FILE: undefined }),
    );
    expect(config.annotationFile).toBe(path.resolve("C:\\DFKI\\annotations.json"));
  });

  it("rejects a missing required environment variable", () => {
    expect(() =>
      parseDeploymentEnvironment(validEnvironment({ DATASET_ROOT: undefined })),
    ).toThrowError(/DATASET_ROOT/);
  });

  it("rejects an invalid theme", () => {
    expect(() =>
      parseDeploymentEnvironment(validEnvironment({ APP_THEME: "system" })),
    ).toThrowError("APP_THEME must be exactly light or dark.");
  });

  it("rejects a view count and order mismatch", () => {
    expect(() =>
      parseDeploymentEnvironment(validEnvironment({ VIDEO_NUMBER_OF_VIEWS: "3" })),
    ).toThrowError(/VIDEO_VIEW_ORDER/);
  });

  it("rejects duplicate view identifiers", () => {
    expect(() =>
      parseDeploymentEnvironment(
        validEnvironment({ VIDEO_VIEW_ORDER: "ego,ego" }),
      ),
    ).toThrowError(/unique supported view IDs/);
  });

  it("rejects an unknown view identifier", () => {
    expect(() =>
      parseDeploymentEnvironment(
        validEnvironment({ VIDEO_VIEW_ORDER: "ego,overhead" }),
      ),
    ).toThrowError(/unsupported logical view/);
  });

  it("requires a filename for every configured view", () => {
    expect(() =>
      parseDeploymentEnvironment(validEnvironment({ VIDEO_FILENAME_VIEW3: undefined })),
    ).toThrowError(/view3/);
  });

  it("rejects unsafe filenames and annotation extensions", () => {
    expect(() =>
      parseDeploymentEnvironment(validEnvironment({ VIDEO_FILENAME_EGO: "../ego.mp4" })),
    ).toThrowError(/plain filenames/);
    expect(() =>
      parseDeploymentEnvironment(validEnvironment({ ANNOTATION_FILE: "annotations.txt" })),
    ).toThrowError(/\.json/);
  });

  it("returns typed foundation errors", () => {
    try {
      parseDeploymentEnvironment(validEnvironment({ APP_THEME: "auto" }));
    } catch (error) {
      expect(error).toBeInstanceOf(FoundationError);
    }
  });

  it("rejects missing dataset and annotation parent directories before startup", async () => {
    const temporary = await createTemporaryDirectory();
    try {
      const datasetRoot = path.join(temporary.directory, "dataset");
      await mkdir(datasetRoot);
      await expect(
        loadDeploymentConfig(
          validEnvironment({
            DATASET_ROOT: datasetRoot,
            ANNOTATION_FILE: path.join(temporary.directory, "missing", "annotations.json"),
          }),
          temporary.directory,
        ),
      ).rejects.toThrowError(/parent directory must exist and be writable/);

      await expect(
        loadDeploymentConfig(
          validEnvironment({
            DATASET_ROOT: path.join(temporary.directory, "missing-dataset"),
            ANNOTATION_FILE: path.join(temporary.directory, "annotations.json"),
          }),
          temporary.directory,
        ),
      ).rejects.toThrowError(/readable directory/);
    } finally {
      await temporary.cleanup();
    }
  });

  it("rejects an annotation parent path that is not a writable directory", async () => {
    const temporary = await createTemporaryDirectory();
    try {
      const datasetRoot = path.join(temporary.directory, "dataset");
      const parentFile = path.join(temporary.directory, "not-a-directory");
      await mkdir(datasetRoot);
      await writeFile(parentFile, "fixture", "utf8");

      await expect(
        loadDeploymentConfig(
          validEnvironment({
            DATASET_ROOT: datasetRoot,
            ANNOTATION_FILE: path.join(parentFile, "annotations.json"),
          }),
          temporary.directory,
        ),
      ).rejects.toThrowError(/parent directory must exist and be writable/);
    } finally {
      await temporary.cleanup();
    }
  });
});
