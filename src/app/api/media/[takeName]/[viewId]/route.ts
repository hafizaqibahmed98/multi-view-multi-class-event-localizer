import { logServerFailure } from "@/server/errors";
import { getServerFoundation } from "@/server/foundation/provider";
import { safeErrorResponse } from "@/server/http/safe-response";
import { serveConfiguredMedia } from "@/server/media/serve-media";
import type { LogicalViewId } from "@/types";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ takeName: string; viewId: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  let takeName: string | undefined;
  let logicalView: string | undefined;
  try {
    const [params, foundation] = await Promise.all([
      context.params,
      getServerFoundation(),
    ]);
    takeName = params.takeName;
    logicalView = params.viewId;
    return await serveConfiguredMedia(
      request,
      foundation.deployment,
      foundation.manifest,
      takeName,
      logicalView as LogicalViewId,
    );
  } catch (error) {
    logServerFailure({ operation: "serve media", takeName, logicalView, error });
    return safeErrorResponse(error);
  }
}
