import { redirect } from "next/navigation";

import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { messages } from "@/messages";
import { getAnnotationRepository } from "@/server/annotations/repository";
import { projectTakeAnnotations } from "@/server/annotations/projection";
import { logServerFailure, toPublicError } from "@/server/errors";
import {
  getServerFoundation,
  loadSafeTakeMetadata,
  toSafeClientConfig,
  toSafeTakeList,
} from "@/server/foundation/provider";
import { getAnnotationProgress } from "@/server/navigation/progress";

export const dynamic = "force-dynamic";

async function loadWorkspace(requestedTakeName?: string) {
  try {
    const foundation = await getServerFoundation();
    const config = toSafeClientConfig(foundation);
    const takes = toSafeTakeList(foundation);
    const document = await getAnnotationRepository(foundation).snapshot();
    const progress = getAnnotationProgress(takes, document);
    const selectedTakeName = requestedTakeName ?? progress.firstIncompleteTakeName;
    if (!selectedTakeName && takes.length > 0) {
      return { ok: true as const, completion: true as const };
    }
    const take = selectedTakeName
      ? await loadSafeTakeMetadata(foundation, selectedTakeName)
      : undefined;
    const annotation = take
      ? projectTakeAnnotations(document, take.takeName, config.events)
      : { initial: {}, historicalEvents: [] };

    return { ok: true as const, completion: false as const, config, take, takes, annotation };
  } catch (error) {
    logServerFailure({
      operation: "load workspace",
      takeName: requestedTakeName,
      error,
    });
    return { ok: false as const, error: toPublicError(error) };
  }
}

interface HomeProps {
  searchParams: Promise<{ take?: string | string[] }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const requestedTakeName = typeof params.take === "string" ? params.take : undefined;
  const result = await loadWorkspace(requestedTakeName);

  if (!result.ok) {
    return (
      <main className="bootstrap-shell">
        <section aria-labelledby="project-title" className="bootstrap-card">
          <p className="eyebrow">{messages.phaseLabel}</p>
          <h1 id="project-title">Multi View Multi Class Event Localizer</h1>
          <h2>Startup configuration error</h2>
          <p className="error-message">{result.error.message}</p>
          <p className="error-code">Error code: {result.error.code}</p>
        </section>
      </main>
    );
  }

  if (result.completion) {
    redirect("/complete");
  }

  if (!result.take) {
    return (
      <main className="empty-workspace">
        <p className="eyebrow">{messages.phaseLabel}</p>
        <h1>{messages.applicationLabel}</h1>
        <p>{messages.noTakes}</p>
      </main>
    );
  }

  return (
    <WorkspaceShell
      config={result.config}
      historicalEvents={result.annotation.historicalEvents}
      initialAnnotations={result.annotation.initial}
      key={result.take.takeName}
      take={result.take}
      takes={result.takes}
    />
  );
}
