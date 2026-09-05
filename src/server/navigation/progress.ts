import type { AnnotationDocument, TakeManifestEntry } from "@/types";

export interface AnnotationProgress {
  allComplete: boolean;
  firstIncompleteTakeName?: string;
}

export function getAnnotationProgress(
  manifest: readonly TakeManifestEntry[],
  document: AnnotationDocument,
): AnnotationProgress {
  const completed = new Set(
    document.takes.filter((take) => take.completed).map((take) => take.takeName),
  );
  const firstIncomplete = manifest.find((take) => !completed.has(take.takeName));
  return firstIncomplete
    ? { allComplete: false, firstIncompleteTakeName: firstIncomplete.takeName }
    : { allComplete: true };
}

export function destinationAfterSave(
  manifest: readonly TakeManifestEntry[],
  currentTakeName: string,
  document: AnnotationDocument,
): { completion: true } | { completion: false; takeName: string } {
  const index = manifest.findIndex((take) => take.takeName === currentTakeName);
  if (index >= 0 && index < manifest.length - 1) {
    return { completion: false, takeName: manifest[index + 1].takeName };
  }
  const progress = getAnnotationProgress(manifest, document);
  return progress.allComplete
    ? { completion: true }
    : { completion: false, takeName: progress.firstIncompleteTakeName! };
}
