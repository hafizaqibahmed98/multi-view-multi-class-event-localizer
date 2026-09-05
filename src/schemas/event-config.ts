import { z } from "zod";

import { messages } from "@/messages";
import { FoundationError } from "@/server/errors";
import type { EventConfig, EventDefinition } from "@/types";

const eventDefinitionSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/),
    label: z.string(),
    shortcut: z.string().regex(/^[A-Za-z0-9]$/),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    order: z.number().int().finite(),
    enabled: z.boolean(),
  })
  .strict();

const eventConfigSchema = z
  .object({
    version: z.string().trim().min(1),
    events: z.array(eventDefinitionSchema),
  })
  .strict();

export interface ParsedEventConfig {
  config: EventConfig;
  enabledEvents: EventDefinition[];
}

export function parseEventConfig(input: unknown): ParsedEventConfig {
  const result = eventConfigSchema.safeParse(input);

  if (!result.success) {
    const field = String(result.error.issues[0]?.path.at(-1) ?? "event");
    throw new FoundationError("EVENT_CONFIG_INVALID", messages.invalidEventField(field), {
      cause: result.error,
    });
  }

  const enabledEvents = result.data.events.filter((event) => event.enabled);
  const eventIds = new Set<string>();
  const shortcuts = new Set<string>();

  for (const event of enabledEvents) {
    if (!event.label.trim()) {
      throw new FoundationError("EVENT_CONFIG_INVALID", messages.emptyEventLabel);
    }

    if (eventIds.has(event.id)) {
      throw new FoundationError("EVENT_CONFIG_INVALID", messages.duplicateEventId);
    }
    eventIds.add(event.id);

    const normalizedShortcut = event.shortcut.toLowerCase();
    if (shortcuts.has(normalizedShortcut)) {
      throw new FoundationError("EVENT_CONFIG_INVALID", messages.duplicateEventShortcut);
    }
    shortcuts.add(normalizedShortcut);
  }

  return {
    config: result.data,
    enabledEvents: enabledEvents.toSorted((left, right) => left.order - right.order),
  };
}
