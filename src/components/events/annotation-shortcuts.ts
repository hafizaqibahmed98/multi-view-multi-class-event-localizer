import type { SafeEventDefinition } from "@/types";

interface AnnotationKeyboardEvent {
  key: string;
  repeat: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  defaultPrevented?: boolean;
  target: EventTarget | null;
}

interface EditableTarget {
  tagName?: string;
  isContentEditable?: boolean;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") {
    return false;
  }
  const candidate = target as EditableTarget;
  return (
    candidate.isContentEditable === true ||
    ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(candidate.tagName ?? "")
  );
}

export function findAnnotationShortcut(
  event: AnnotationKeyboardEvent,
  events: readonly SafeEventDefinition[],
  confirmationDialogOpen: boolean,
): string | undefined {
  if (
    confirmationDialogOpen ||
    event.defaultPrevented ||
    event.repeat ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    isEditableTarget(event.target) ||
    event.key.length !== 1 ||
    !/^[A-Za-z0-9]$/.test(event.key)
  ) {
    return undefined;
  }

  const normalizedKey = event.key.toLowerCase();
  return events.find(
    (definition) => definition.shortcut.toLowerCase() === normalizedKey,
  )?.id;
}
