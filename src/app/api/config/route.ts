import { NextResponse } from "next/server";

import { logServerFailure } from "@/server/errors";
import { getServerFoundation, toSafeClientConfig } from "@/server/foundation/provider";
import { safeErrorResponse } from "@/server/http/safe-response";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const foundation = await getServerFoundation();
    return NextResponse.json({ config: toSafeClientConfig(foundation) });
  } catch (error) {
    logServerFailure({ operation: "load client configuration", error });
    return safeErrorResponse(error);
  }
}
