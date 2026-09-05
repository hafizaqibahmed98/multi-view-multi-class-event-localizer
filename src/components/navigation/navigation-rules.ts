import type {
  AnnotationDraftState,
  SafeEventDefinition,
  SaveTakeAnnotationInput,
  TakeManifestEntry,
} from "@/types";

export function adjacentTake(
  takes: readonly TakeManifestEntry[],
  currentTakeName: string,
  direction: -1 | 1,
): TakeManifestEntry | undefined {
  const index = takes.findIndex((take) => take.takeName === currentTakeName);
  return index < 0 ? undefined : takes[index + direction];
}

export function navigationRequest(
  dirty: boolean,
  takeName: string,
): { action: "confirm" | "navigate"; takeName: string } {
  return { action: dirty ? "confirm" : "navigate", takeName };
}

export interface SubmissionGate {
  begin(): boolean;
  finish(): void;
}

export function createSubmissionGate(): SubmissionGate {
  let active = false;
  return {
    begin() {
      if (active) return false;
      active = true;
      return true;
    },
    finish() {
      active = false;
    },
  };
}

export async function persistBeforeNavigation<T>(
  persist: () => Promise<T>,
  navigate: (destination: T) => void,
): Promise<void> {
  const destination = await persist();
  navigate(destination);
}

export function openEventLabels(
  state: AnnotationDraftState,
  events: readonly SafeEventDefinition[],
): string[] {
  return events
    .filter((event) => state.events[event.id]?.openStart !== undefined)
    .map((event) => event.label);
}

export function isExplicitlyEmpty(
  state: AnnotationDraftState,
): boolean {
  return Object.values(state.events).every(
    (event) => event.occurrences.length === 0 && event.openStart === undefined,
  );
}

export function buildSaveInput(
  state: AnnotationDraftState,
  events: readonly SafeEventDefinition[],
  durationSeconds: number,
): SaveTakeAnnotationInput {
  return {
    takeName: state.takeName,
    durationSeconds,
    events: events.map((event) => ({
      id: event.id,
      occurrences: (state.events[event.id]?.occurrences ?? []).map((occurrence) => ({
        ...occurrence,
      })),
    })),
  };
}
