import path from "node:path";

import { z } from "zod";

import { messages } from "@/messages";
import { FoundationError } from "@/server/errors";
import { isSafePathSegment, isSafeRelativeDirectory } from "@/server/path-safety";
import type { DeploymentConfig } from "@/server/config/types";
import { LOGICAL_VIEW_IDS, type LogicalViewId } from "@/types";

const requiredText = z.string().trim().min(1);

const rawEnvironmentSchema = z
  .object({
    DATASET_ROOT: requiredText,
    TAKE_VIDEO_SUBDIR: requiredText,
    TAKE_MANIFEST_XLSX: requiredText,
    TAKE_MANIFEST_SHEET: requiredText,
    ANNOTATION_FILE: requiredText.default("C:\\DFKI\\annotations.json"),
    EVENT_CONFIG_FILE: requiredText,
    APP_THEME: requiredText,
    VIDEO_NUMBER_OF_VIEWS: requiredText,
    VIDEO_VIEW_ORDER: requiredText,
    VIDEO_FILENAME_EGO: z.string().trim().optional(),
    VIDEO_FILENAME_VIEW1: z.string().trim().optional(),
    VIDEO_FILENAME_VIEW2: z.string().trim().optional(),
    VIDEO_FILENAME_VIEW3: z.string().trim().optional(),
    VIDEO_FILENAME_VIEW4: z.string().trim().optional(),
  })
  .passthrough();

type FilenameEnvironmentKey =
  | "VIDEO_FILENAME_EGO"
  | "VIDEO_FILENAME_VIEW1"
  | "VIDEO_FILENAME_VIEW2"
  | "VIDEO_FILENAME_VIEW3"
  | "VIDEO_FILENAME_VIEW4";

const filenameEnvironmentKeys: Record<LogicalViewId, FilenameEnvironmentKey> = {
  ego: "VIDEO_FILENAME_EGO",
  view1: "VIDEO_FILENAME_VIEW1",
  view2: "VIDEO_FILENAME_VIEW2",
  view3: "VIDEO_FILENAME_VIEW3",
  view4: "VIDEO_FILENAME_VIEW4",
};

function resolveConfiguredPath(baseDirectory: string, configuredPath: string): string {
  return path.resolve(baseDirectory, configuredPath);
}

export function parseDeploymentEnvironment(
  environment: Record<string, string | undefined>,
  baseDirectory = process.cwd(),
): DeploymentConfig {
  const parsedEnvironment = rawEnvironmentSchema.safeParse(environment);

  if (!parsedEnvironment.success) {
    const variableName = String(parsedEnvironment.error.issues[0]?.path[0] ?? "unknown");
    throw new FoundationError(
      "CONFIG_MISSING_ENV",
      messages.missingEnvironmentVariable(variableName),
      { cause: parsedEnvironment.error },
    );
  }

  const raw = parsedEnvironment.data;
  if (raw.APP_THEME !== "light" && raw.APP_THEME !== "dark") {
    throw new FoundationError("CONFIG_INVALID", messages.invalidTheme);
  }

  if (!/^[1-5]$/.test(raw.VIDEO_NUMBER_OF_VIEWS)) {
    throw new FoundationError("CONFIG_INVALID", messages.invalidViewCount);
  }

  const viewCount = Number(raw.VIDEO_NUMBER_OF_VIEWS);
  const rawViewOrder = raw.VIDEO_VIEW_ORDER.split(",").map((value) => value.trim());
  const uniqueViewOrder = new Set(rawViewOrder);

  if (
    rawViewOrder.some((value) => value.length === 0) ||
    uniqueViewOrder.size !== rawViewOrder.length ||
    uniqueViewOrder.size !== viewCount
  ) {
    throw new FoundationError("CONFIG_INVALID", messages.invalidViewOrder);
  }

  if (rawViewOrder.some((value) => !LOGICAL_VIEW_IDS.includes(value as LogicalViewId))) {
    throw new FoundationError("CONFIG_INVALID", messages.unknownView);
  }

  if (!isSafeRelativeDirectory(raw.TAKE_VIDEO_SUBDIR)) {
    throw new FoundationError("CONFIG_INVALID", messages.invalidVideoSubdirectory);
  }

  if (path.extname(raw.TAKE_MANIFEST_XLSX).toLowerCase() !== ".xlsx") {
    throw new FoundationError("CONFIG_INVALID", messages.invalidManifestExtension);
  }

  if (path.extname(raw.EVENT_CONFIG_FILE).toLowerCase() !== ".json") {
    throw new FoundationError("CONFIG_INVALID", messages.invalidEventConfigExtension);
  }

  if (path.extname(raw.ANNOTATION_FILE).toLowerCase() !== ".json") {
    throw new FoundationError("CONFIG_INVALID", messages.invalidAnnotationPath);
  }

  const viewOrder = rawViewOrder as LogicalViewId[];
  const viewFilenames: Partial<Record<LogicalViewId, string>> = {};

  for (const viewId of viewOrder) {
    const filename = raw[filenameEnvironmentKeys[viewId]];
    if (!filename) {
      throw new FoundationError(
        "CONFIG_MISSING_ENV",
        messages.missingViewFilename(viewId),
      );
    }
    if (!isSafePathSegment(filename)) {
      throw new FoundationError("CONFIG_INVALID", messages.invalidViewFilename);
    }
    viewFilenames[viewId] = filename;
  }

  return {
    datasetRoot: resolveConfiguredPath(baseDirectory, raw.DATASET_ROOT),
    takeVideoSubdirectory: raw.TAKE_VIDEO_SUBDIR,
    manifestPath: resolveConfiguredPath(baseDirectory, raw.TAKE_MANIFEST_XLSX),
    manifestSheet: raw.TAKE_MANIFEST_SHEET,
    annotationFile: resolveConfiguredPath(baseDirectory, raw.ANNOTATION_FILE),
    eventConfigFile: resolveConfiguredPath(baseDirectory, raw.EVENT_CONFIG_FILE),
    theme: raw.APP_THEME,
    viewOrder,
    viewFilenames,
  };
}
