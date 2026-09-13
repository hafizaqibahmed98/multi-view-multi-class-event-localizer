"use client";

interface TakeNavigationProps {
  hasPrevious: boolean;
  hasNext: boolean;
  isSaving: boolean;
  saveBlocked: boolean;
  onPrevious(): void;
  onNext(): void;
  onSaveNext(): void;
}

export function TakeNavigation({
  hasPrevious,
  hasNext,
  isSaving,
  saveBlocked,
  onPrevious,
  onNext,
  onSaveNext,
}: TakeNavigationProps) {
  return (
    <nav aria-label="Take navigation" className="take-navigation">
      <button disabled={!hasPrevious || isSaving} onClick={onPrevious} type="button">
        Previous
      </button>
      <button disabled={!hasNext || isSaving} onClick={onNext} type="button">
        Next
      </button>
      <button
        className="save-next"
        disabled={saveBlocked || isSaving}
        onClick={onSaveNext}
        type="button"
      >
        {isSaving ? "Saving…" : "Save & Next"}
      </button>
    </nav>
  );
}
