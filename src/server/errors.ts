import { messages } from "@/messages";

const FOUNDATION_ERROR_BRAND = Symbol.for("event-localizer.FoundationError");

export type FoundationErrorCode =
  | "CONFIG_MISSING_ENV"
  | "CONFIG_INVALID"
  | "CONFIG_FILESYSTEM"
  | "EVENT_CONFIG_INVALID"
  | "EVENT_CONFIG_UNAVAILABLE"
  | "MANIFEST_INVALID"
  | "MANIFEST_UNAVAILABLE"
  | "TAKE_NOT_FOUND"
  | "VIEW_NOT_CONFIGURED"
  | "MEDIA_UNAVAILABLE"
  | "INVALID_RANGE"
  | "ANNOTATION_INVALID"
  | "ANNOTATION_MALFORMED"
  | "ANNOTATION_STALE"
  | "ANNOTATION_WRITE_FAILED"
  | "INTERNAL_ERROR";

export class FoundationError extends Error {
  readonly [FOUNDATION_ERROR_BRAND] = true;
  readonly code: FoundationErrorCode;
  readonly status: number;

  constructor(
    code: FoundationErrorCode,
    safeMessage: string,
    options?: { cause?: unknown; status?: number },
  ) {
    super(safeMessage, { cause: options?.cause });
    this.name = "FoundationError";
    this.code = code;
    this.status = options?.status ?? 500;
  }
}

export function toPublicError(error: unknown): {
  code: FoundationErrorCode;
  message: string;
  status: number;
} {
  if (
    error instanceof FoundationError ||
    (typeof error === "object" &&
      error !== null &&
      FOUNDATION_ERROR_BRAND in error &&
      error[FOUNDATION_ERROR_BRAND] === true &&
      "code" in error &&
      "status" in error &&
      "message" in error)
  ) {
    const branded = error as FoundationError;
    return { code: branded.code, message: branded.message, status: branded.status };
  }

  return {
    code: "INTERNAL_ERROR",
    message: messages.unexpectedError,
    status: 500,
  };
}

interface ServerFailureContext {
  operation: string;
  error: unknown;
  takeName?: string;
  logicalView?: string;
}

export function logServerFailure({
  operation,
  error,
  takeName,
  logicalView,
}: ServerFailureContext): void {
  const publicError = toPublicError(error);
  console.error("Server operation failed", {
    operation,
    ...(takeName ? { takeName } : {}),
    ...(logicalView ? { logicalView } : {}),
    category: publicError.code,
  });
}
