import { NextResponse } from "next/server";

import { logServerFailure } from "@/server/errors";
import { getServerFoundation, toSafeTakeList } from "@/server/foundation/provider";
import { safeErrorResponse } from "@/server/http/safe-response";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const foundation = await getServerFoundation();
    const takes = toSafeTakeList(foundation);
    return NextResponse.json({ count: takes.length, takes });
  } catch (error) {
    logServerFailure({ operation: "load take list", error });
    return safeErrorResponse(error);
  }
}
