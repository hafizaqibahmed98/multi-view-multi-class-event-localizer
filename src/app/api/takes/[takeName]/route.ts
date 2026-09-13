import { NextResponse } from "next/server";

import { logServerFailure } from "@/server/errors";
import { getServerFoundation, loadSafeTakeMetadata } from "@/server/foundation/provider";
import { safeErrorResponse } from "@/server/http/safe-response";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ takeName: string }>;
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  let takeName: string | undefined;
  try {
    const [params, foundation] = await Promise.all([
      context.params,
      getServerFoundation(),
    ]);
    takeName = params.takeName;
    const take = await loadSafeTakeMetadata(foundation, takeName);
    return NextResponse.json({ take });
  } catch (error) {
    logServerFailure({ operation: "load take metadata", takeName, error });
    return safeErrorResponse(error);
  }
}
