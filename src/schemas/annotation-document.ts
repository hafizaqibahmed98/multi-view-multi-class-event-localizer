import { z } from "zod";

import { intervalsOverlap, isValidOccurrenceBoundary } from "@/schemas/annotation-boundary";
import { LOGICAL_VIEW_IDS } from "@/types";

const safeId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/);
const isoTimestamp = z
  .string()
  .datetime({ offset: true })
  .refine((value) => value.endsWith("Z"), "Timestamp must be UTC");
const occurrenceSchema = z.object({
  occurrenceId: z.string().trim().min(1),
  start: z.number().finite(),
  end: z.number().finite(),
  autoClosed: z.boolean(),
}).strict();

const persistedEventSchema = z.object({
  id: safeId,
  name: z.string().trim().min(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  occurrences: z.array(occurrenceSchema),
}).strict();

const persistedTakeSchema = z.object({
  takeName: z.string().trim().min(1),
  completed: z.literal(true),
  eventConfigVersion: z.string().trim().min(1),
  durationSeconds: z.number().finite().nonnegative(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
  views: z.array(z.object({
    id: z.enum(LOGICAL_VIEW_IDS),
    available: z.boolean(),
  }).strict()),
  events: z.array(persistedEventSchema),
}).strict().superRefine((take, context) => {
  const eventIds = new Set<string>();
  const occurrenceIds = new Set<string>();
  for (const event of take.events) {
    if (eventIds.has(event.id)) {
      context.addIssue({ code: "custom", message: "Duplicate event ID", path: ["events"] });
    }
    eventIds.add(event.id);
    for (const occurrence of event.occurrences) {
      if (occurrenceIds.has(occurrence.occurrenceId)) {
        context.addIssue({ code: "custom", message: "Duplicate occurrence ID", path: ["events"] });
      }
      occurrenceIds.add(occurrence.occurrenceId);
      if (!isValidOccurrenceBoundary(occurrence, take.durationSeconds)) {
        context.addIssue({ code: "custom", message: "Invalid occurrence boundary", path: ["events"] });
      }
    }
    const ordered = event.occurrences.toSorted((left, right) => left.start - right.start);
    for (let index = 1; index < ordered.length; index += 1) {
      if (intervalsOverlap(ordered[index - 1], ordered[index])) {
        context.addIssue({ code: "custom", message: "Same-class occurrence overlap", path: ["events"] });
      }
    }
  }
});

export const annotationDocumentSchema = z.object({
  schemaVersion: z.literal("1.0"),
  eventConfigVersion: z.string().trim().min(1),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
  takes: z.array(persistedTakeSchema),
}).strict().superRefine((document, context) => {
  const takeNames = new Set<string>();
  for (const take of document.takes) {
    if (takeNames.has(take.takeName)) {
      context.addIssue({ code: "custom", message: "Duplicate take entry", path: ["takes"] });
    }
    takeNames.add(take.takeName);
  }
});

export const saveTakeAnnotationInputSchema = z.object({
  takeName: z.string().trim().min(1),
  durationSeconds: z.number().finite().nonnegative(),
  events: z.array(z.object({
    id: safeId,
    occurrences: z.array(occurrenceSchema),
  }).strict()),
}).strict();

export type ParsedAnnotationDocument = z.infer<typeof annotationDocumentSchema>;
