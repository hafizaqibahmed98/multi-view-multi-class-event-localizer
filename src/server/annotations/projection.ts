import type { InitialEventAnnotation } from "@/components/events/annotation-state";
import type {
  AnnotationDocument,
  HistoricalEventDefinition,
  SafeEventDefinition,
} from "@/types";

export interface TakeAnnotationProjection {
  initial: Record<string, InitialEventAnnotation>;
  historicalEvents: HistoricalEventDefinition[];
}

export function projectTakeAnnotations(
  document: AnnotationDocument,
  takeName: string,
  configuredEvents: readonly SafeEventDefinition[],
): TakeAnnotationProjection {
  const savedTake = document.takes.find((take) => take.takeName === takeName);
  if (!savedTake) {
    return { initial: {}, historicalEvents: [] };
  }
  const configuredIds = new Set(configuredEvents.map((event) => event.id));
  return {
    initial: Object.fromEntries(
      savedTake.events.map((event) => [
        event.id,
        { occurrences: event.occurrences.map((occurrence) => ({ ...occurrence })) },
      ]),
    ),
    historicalEvents: savedTake.events
      .filter((event) => !configuredIds.has(event.id))
      .map((event) => ({
        id: event.id,
        label: event.name,
        color: event.color,
        occurrences: event.occurrences.map((occurrence) => ({ ...occurrence })),
        readOnly: true,
      })),
  };
}
