import Link from "next/link";
import { redirect } from "next/navigation";

import { messages } from "@/messages";
import { getAnnotationRepository } from "@/server/annotations/repository";
import { logServerFailure, toPublicError } from "@/server/errors";
import { getServerFoundation } from "@/server/foundation/provider";
import { getAnnotationProgress } from "@/server/navigation/progress";

export const dynamic = "force-dynamic";

async function loadCompletion() {
  try {
    const foundation = await getServerFoundation();
    const document = await getAnnotationRepository(foundation).snapshot();
    return {
      ok: true as const,
      progress: getAnnotationProgress(foundation.manifest, document),
      finalTake: foundation.manifest.at(-1),
    };
  } catch (error) {
    logServerFailure({ operation: "load completion", error });
    return { ok: false as const, error: toPublicError(error) };
  }
}

export default async function CompletePage() {
  const result = await loadCompletion();
  if (!result.ok) {
    return (
      <main className="bootstrap-shell">
        <section className="bootstrap-card">
          <h1>{messages.completionTitle}</h1>
          <p className="error-message">{result.error.message}</p>
          <p className="error-code">Error code: {result.error.code}</p>
        </section>
      </main>
    );
  }
  if (!result.progress.allComplete) {
    redirect(`/?take=${encodeURIComponent(result.progress.firstIncompleteTakeName!)}`);
  }

  return (
    <main className="completion-shell">
      <section className="completion-card">
        <p className="eyebrow">{messages.applicationLabel}</p>
        <h1>{messages.completionTitle}</h1>
        <p>{messages.completionMessage}</p>
        {result.finalTake ? (
          <Link className="navigation-button" href={`/?take=${encodeURIComponent(result.finalTake.takeName)}`}>
            Previous
          </Link>
        ) : null}
      </section>
    </main>
  );
}
