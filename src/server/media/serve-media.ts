import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { messages } from "@/messages";
import type { DeploymentConfig } from "@/server/config/types";
import { FoundationError } from "@/server/errors";
import { resolveMediaPath } from "@/server/media/resolve-media";
import type { LogicalViewId, TakeManifestEntry } from "@/types";

interface ByteRange {
  start: number;
  end: number;
}

function mediaType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case ".webm":
      return "video/webm";
    case ".ogg":
    case ".ogv":
      return "video/ogg";
    case ".mov":
      return "video/quicktime";
    default:
      return "video/mp4";
  }
}

export function parseByteRange(rangeHeader: string, size: number): ByteRange | undefined {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match || size <= 0 || (!match[1] && !match[2])) {
    return undefined;
  }

  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      return undefined;
    }
    return { start: Math.max(0, size - suffixLength), end: size - 1 };
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    start >= size ||
    requestedEnd < start
  ) {
    return undefined;
  }

  return { start, end: Math.min(requestedEnd, size - 1) };
}

function streamBody(
  filePath: string,
  range?: ByteRange,
): ReadableStream<Uint8Array> {
  const source = range
    ? createReadStream(filePath, { start: range.start, end: range.end })
    : createReadStream(filePath);
  return Readable.toWeb(source) as ReadableStream<Uint8Array>;
}

export async function serveConfiguredMedia(
  request: Request,
  config: DeploymentConfig,
  manifest: readonly TakeManifestEntry[],
  takeName: string,
  viewId: LogicalViewId,
): Promise<NextResponse> {
  const filePath = resolveMediaPath(config, manifest, takeName, viewId);
  let size: number;

  try {
    const information = await stat(filePath);
    if (!information.isFile()) {
      throw new Error("Configured media is not a file");
    }
    size = information.size;
  } catch (error) {
    throw new FoundationError("MEDIA_UNAVAILABLE", messages.mediaReadFailure, {
      cause: error,
      status: 404,
    });
  }

  const commonHeaders = {
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Type": mediaType(filePath),
  };
  const rangeHeader = request.headers.get("range");

  if (!rangeHeader) {
    return new NextResponse(streamBody(filePath), {
      status: 200,
      headers: { ...commonHeaders, "Content-Length": String(size) },
    });
  }

  const range = parseByteRange(rangeHeader, size);
  if (!range) {
    return NextResponse.json(
      { error: { code: "INVALID_RANGE", message: messages.invalidRange } },
      {
        status: 416,
        headers: { ...commonHeaders, "Content-Range": `bytes */${size}` },
      },
    );
  }

  return new NextResponse(streamBody(filePath, range), {
    status: 206,
    headers: {
      ...commonHeaders,
      "Content-Length": String(range.end - range.start + 1),
      "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
    },
  });
}
