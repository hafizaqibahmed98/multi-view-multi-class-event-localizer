import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import path from "node:path";

import { messages } from "@/messages";
import { parseDeploymentEnvironment } from "@/schemas/deployment-config";
import { FoundationError } from "@/server/errors";
import type { DeploymentConfig } from "@/server/config/types";

async function requireReadableDirectory(directoryPath: string): Promise<void> {
  try {
    const information = await stat(directoryPath);
    if (!information.isDirectory()) {
      throw new Error("Not a directory");
    }
    await access(directoryPath, constants.R_OK);
  } catch (error) {
    throw new FoundationError("CONFIG_FILESYSTEM", messages.datasetUnavailable, {
      cause: error,
    });
  }
}

async function requireWritableAnnotationTarget(annotationFile: string): Promise<void> {
  const parentDirectory = path.dirname(annotationFile);

  try {
    const parentInformation = await stat(parentDirectory);
    if (!parentInformation.isDirectory()) {
      throw new Error("Annotation parent is not a directory");
    }
    await access(parentDirectory, constants.W_OK);

    try {
      const targetInformation = await stat(annotationFile);
      if (!targetInformation.isFile()) {
        throw new Error("Annotation target is not a file");
      }
      await access(annotationFile, constants.W_OK);
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }
  } catch (error) {
    throw new FoundationError(
      "CONFIG_FILESYSTEM",
      messages.annotationDirectoryUnavailable,
      { cause: error },
    );
  }
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export async function loadDeploymentConfig(
  environment: Record<string, string | undefined> = process.env,
  baseDirectory = process.cwd(),
): Promise<DeploymentConfig> {
  const config = parseDeploymentEnvironment(environment, baseDirectory);
  await requireReadableDirectory(config.datasetRoot);
  await requireWritableAnnotationTarget(config.annotationFile);
  return config;
}
