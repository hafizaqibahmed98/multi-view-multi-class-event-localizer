import { NextResponse } from "next/server";

import { toPublicError } from "@/server/errors";

export function safeErrorResponse(error: unknown): NextResponse {
  const publicError = toPublicError(error);
  return NextResponse.json(
    { error: { code: publicError.code, message: publicError.message } },
    { status: publicError.status },
  );
}
