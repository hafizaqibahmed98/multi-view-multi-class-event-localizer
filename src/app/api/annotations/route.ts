import { NextResponse } from "next/server";

import { messages } from "@/messages";
import { saveTakeAnnotationInputSchema } from "@/schemas/annotation-document";
import { getAnnotationRepository } from "@/server/annotations/repository";
import { projectTakeAnnotations } from "@/server/annotations/projection";
import { FoundationError, logServerFailure } from "@/server/errors";
import {
  getServerFoundation,
  loadSafeTakeMetadata,
  toSafeClientConfig,
} from "@/server/foundation/provider";
import { safeErrorResponse } from "@/server/http/safe-response";
import { destinationAfterSave } from "@/server/navigation/progress";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const takeName = new URL(request.url).searchParams.get("takeName") ?? undefined;
  try {
    if (!takeName) {
      throw new FoundationError("ANNOTATION_INVALID", messages.invalidAnnotationPayload, {
        status: 400,
      });
    }
    const foundation = await getServerFoundation();
    if (!foundation.manifest.some((entry) => entry.takeName === takeName)) {
      throw new FoundationError("TAKE_NOT_FOUND", messages.takeNotFound, { status: 404 });
    }
    const document = await getAnnotationRepository(foundation).snapshot();
    const projection = projectTakeAnnotations(
      document,
      takeName,
      toSafeClientConfig(foundation).events,
    );
    return NextResponse.json({ annotation: projection });
  } catch (error) {
    logServerFailure({ operation: "load annotations", takeName, error });
    return safeErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  let takeName: string | undefined;
  try {
    let input: unknown;
    try {
      input = await request.json();
    } catch (error) {
      throw new FoundationError("ANNOTATION_INVALID", messages.invalidAnnotationPayload, {
        cause: error,
        status: 400,
      });
    }
    const parsed = saveTakeAnnotationInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new FoundationError("ANNOTATION_INVALID", messages.invalidAnnotationPayload, {
        cause: parsed.error,
        status: 400,
      });
    }
    takeName = parsed.data.takeName;
    const foundation = await getServerFoundation();
    const take = await loadSafeTakeMetadata(foundation, takeName);
    const repository = getAnnotationRepository(foundation);
    const document = await repository.save(
      parsed.data,
      take.views.map(({ id, available }) => ({ id, available })),
    );
    return NextResponse.json({
      saved: document.takes.find((entry) => entry.takeName === takeName),
      destination: destinationAfterSave(foundation.manifest, takeName, document),
    });
  } catch (error) {
    logServerFailure({ operation: "save annotations", takeName, error });
    return safeErrorResponse(error);
  }
}
