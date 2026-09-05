import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import path from "node:path";

import { messages } from "@/messages";
import type { DeploymentConfig } from "@/server/config/types";
import { FoundationError } from "@/server/errors";
import { isPathWithin } from "@/server/path-safety";
import {
  LOGICAL_VIEW_LABELS,
  type LogicalViewId,
  type SafeTakeMetadata,
  type TakeManifestEntry,
} from "@/types";

function requireManifestTake(
  manifest: readonly TakeManifestEntry[],
  takeName: string,
): TakeManifestEntry {
  const entry = manifest.find((candidate) => candidate.takeName === takeName);
  if (!entry) {
    throw new FoundationError("TAKE_NOT_FOUND", messages.takeNotFound, { status: 404 });
  }
  return entry;
}

export function resolveMediaPath(
  config: DeploymentConfig,
  manifest: readonly TakeManifestEntry[],
  takeName: string,
  viewId: LogicalViewId,
): string {
  requireManifestTake(manifest, takeName);

  if (!config.viewOrder.includes(viewId)) {
    throw new FoundationError("VIEW_NOT_CONFIGURED", messages.viewNotConfigured, {
      status: 404,
    });
  }

  const filename = config.viewFilenames[viewId];
  if (!filename) {
    throw new FoundationError("CONFIG_INVALID", messages.missingViewFilename(viewId));
  }

  const takeDirectory = path.resolve(config.datasetRoot, takeName);
  const videoDirectory = path.resolve(takeDirectory, config.takeVideoSubdirectory);
  const mediaPath = path.resolve(videoDirectory, filename);

  if (
    !isPathWithin(config.datasetRoot, takeDirectory) ||
    !isPathWithin(takeDirectory, videoDirectory) ||
    !isPathWithin(videoDirectory, mediaPath)
  ) {
    throw new FoundationError("CONFIG_INVALID", messages.invalidViewFilename);
  }

  return mediaPath;
}

async function isReadableFile(filePath: string): Promise<boolean> {
  try {
    const information = await stat(filePath);
    if (!information.isFile()) {
      return false;
    }
    await access(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function getSafeTakeMetadata(
  config: DeploymentConfig,
  manifest: readonly TakeManifestEntry[],
  takeName: string,
): Promise<SafeTakeMetadata> {
  const entry = requireManifestTake(manifest, takeName);
  const views = await Promise.all(
    config.viewOrder.map(async (id) => ({
      id,
      label: LOGICAL_VIEW_LABELS[id],
      ...(await isReadableFile(resolveMediaPath(config, manifest, takeName, id))
        ? {
            available: true,
            mediaUrl: `/api/media/${encodeURIComponent(takeName)}/${id}`,
          }
        : { available: false }),
    })),
  );

  return { ...entry, views };
}
