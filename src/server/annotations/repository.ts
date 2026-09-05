import { createHash, randomUUID } from "node:crypto";
import { open, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";

import {
  annotationDocumentSchema,
  saveTakeAnnotationInputSchema,
} from "@/schemas/annotation-document";
import { FoundationError } from "@/server/errors";
import type { ServerFoundation } from "@/server/foundation/provider";
import { messages } from "@/messages";
import type {
  AnnotationDocument,
  PersistedTakeAnnotation,
  PersistedViewAvailability,
  SaveTakeAnnotationInput,
} from "@/types";

export type AtomicFileWriter = (targetPath: string, contents: string) => Promise<void>;

interface AnnotationRepositoryOptions {
  annotationFile: string;
  foundation: ServerFoundation;
  now?: () => Date;
  atomicWriter?: AtomicFileWriter;
}

function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function fingerprint(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

async function readCurrentFile(filePath: string): Promise<{ contents?: string; fingerprint?: string }> {
  try {
    const contents = await readFile(filePath, "utf8");
    return { contents, fingerprint: fingerprint(contents) };
  } catch (error) {
    if (isMissingFile(error)) {
      return {};
    }
    throw error;
  }
}

export async function atomicReplaceFile(targetPath: string, contents: string): Promise<void> {
  const temporaryPath = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(temporaryPath, "wx", 0o600);
    await handle.writeFile(contents, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, targetPath);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

function orderTakes(
  takes: readonly PersistedTakeAnnotation[],
  manifest: ServerFoundation["manifest"],
): PersistedTakeAnnotation[] {
  const byName = new Map(takes.map((take) => [take.takeName, take]));
  const ordered = manifest.flatMap((entry) => {
    const take = byName.get(entry.takeName);
    if (!take) return [];
    byName.delete(entry.takeName);
    return [take];
  });
  return [...ordered, ...byName.values()];
}

export class AnnotationRepository {
  private readonly annotationFile: string;
  private readonly foundation: ServerFoundation;
  private readonly now: () => Date;
  private readonly atomicWriter: AtomicFileWriter;
  private document?: AnnotationDocument;
  private loadedFingerprint?: string;
  private initialization?: Promise<void>;
  private saveQueue: Promise<unknown> = Promise.resolve();

  constructor(options: AnnotationRepositoryOptions) {
    this.annotationFile = options.annotationFile;
    this.foundation = options.foundation;
    this.now = options.now ?? (() => new Date());
    this.atomicWriter = options.atomicWriter ?? atomicReplaceFile;
  }

  private async initialize(): Promise<void> {
    const current = await readCurrentFile(this.annotationFile);
    this.loadedFingerprint = current.fingerprint;
    if (current.contents === undefined) {
      const timestamp = this.now().toISOString();
      this.document = {
        schemaVersion: "1.0",
        eventConfigVersion: this.foundation.eventConfiguration.config.version,
        createdAt: timestamp,
        updatedAt: timestamp,
        takes: [],
      };
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(current.contents);
    } catch (error) {
      throw new FoundationError("ANNOTATION_MALFORMED", messages.malformedAnnotations, {
        cause: error,
        status: 409,
      });
    }
    const result = annotationDocumentSchema.safeParse(parsed);
    if (!result.success) {
      throw new FoundationError("ANNOTATION_MALFORMED", messages.malformedAnnotations, {
        cause: result.error,
        status: 409,
      });
    }
    this.document = result.data;
  }

  private async ensureLoaded(): Promise<void> {
    this.initialization ??= this.initialize();
    await this.initialization;
  }

  async snapshot(): Promise<AnnotationDocument> {
    await this.ensureLoaded();
    return structuredClone(this.document!);
  }

  async save(
    input: SaveTakeAnnotationInput,
    views: readonly PersistedViewAvailability[],
  ): Promise<AnnotationDocument> {
    const operation = this.saveQueue.then(() => this.performSave(input, views));
    this.saveQueue = operation.catch(() => undefined);
    return operation;
  }

  private async performSave(
    input: SaveTakeAnnotationInput,
    views: readonly PersistedViewAvailability[],
  ): Promise<AnnotationDocument> {
    await this.ensureLoaded();
    const payload = saveTakeAnnotationInputSchema.safeParse(input);
    const manifestEntry = this.foundation.manifest.find(
      (entry) => entry.takeName === input.takeName,
    );
    if (!payload.success || !manifestEntry) {
      throw new FoundationError("ANNOTATION_INVALID", messages.invalidAnnotationPayload, {
        cause: payload.success ? undefined : payload.error,
        status: 400,
      });
    }

    const configuredEvents = this.foundation.eventConfiguration.enabledEvents;
    const submittedById = new Map(payload.data.events.map((event) => [event.id, event]));
    if (
      payload.data.events.length !== configuredEvents.length ||
      submittedById.size !== configuredEvents.length ||
      configuredEvents.some((event) => !submittedById.has(event.id))
    ) {
      throw new FoundationError("ANNOTATION_INVALID", messages.invalidAnnotationPayload, {
        status: 400,
      });
    }

    const currentFile = await readCurrentFile(this.annotationFile);
    if (currentFile.fingerprint !== this.loadedFingerprint) {
      throw new FoundationError("ANNOTATION_STALE", messages.staleAnnotations, { status: 409 });
    }

    const currentDocument = this.document!;
    const existing = currentDocument.takes.find((take) => take.takeName === input.takeName);
    const timestamp = this.now().toISOString();
    const configuredIds = new Set(configuredEvents.map((event) => event.id));
    const historicalEvents = existing?.events.filter((event) => !configuredIds.has(event.id)) ?? [];
    const savedTake: PersistedTakeAnnotation = {
      takeName: input.takeName,
      completed: true,
      eventConfigVersion: this.foundation.eventConfiguration.config.version,
      durationSeconds: payload.data.durationSeconds,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      views: views.map((view) => ({ ...view })),
      events: [
        ...configuredEvents.map((event) => ({
          id: event.id,
          name: event.label,
          color: event.color,
          occurrences: submittedById.get(event.id)!.occurrences.map((occurrence) => ({
            ...occurrence,
          })),
        })),
        ...historicalEvents.map((event) => structuredClone(event)),
      ],
    };
    const proposed: AnnotationDocument = {
      ...currentDocument,
      eventConfigVersion: this.foundation.eventConfiguration.config.version,
      updatedAt: timestamp,
      takes: orderTakes(
        [...currentDocument.takes.filter((take) => take.takeName !== input.takeName), savedTake],
        this.foundation.manifest,
      ),
    };
    const validated = annotationDocumentSchema.safeParse(proposed);
    if (!validated.success) {
      throw new FoundationError("ANNOTATION_INVALID", messages.invalidAnnotationPayload, {
        cause: validated.error,
        status: 400,
      });
    }

    const serialized = `${JSON.stringify(validated.data, null, 2)}\n`;
    const recheckedFile = await readCurrentFile(this.annotationFile);
    if (recheckedFile.fingerprint !== this.loadedFingerprint) {
      throw new FoundationError("ANNOTATION_STALE", messages.staleAnnotations, { status: 409 });
    }
    try {
      await this.atomicWriter(this.annotationFile, serialized);
    } catch (error) {
      throw new FoundationError("ANNOTATION_WRITE_FAILED", messages.annotationWriteFailure, {
        cause: error,
        status: 500,
      });
    }
    this.document = validated.data;
    this.loadedFingerprint = fingerprint(serialized);
    return structuredClone(validated.data);
  }
}

interface AnnotationRepositoryGlobal {
  __eventLocalizerAnnotationRepositories?: Map<string, AnnotationRepository>;
}

const applicationGlobal = globalThis as typeof globalThis & AnnotationRepositoryGlobal;
const repositories =
  applicationGlobal.__eventLocalizerAnnotationRepositories ??= new Map<string, AnnotationRepository>();

export function getAnnotationRepository(foundation: ServerFoundation): AnnotationRepository {
  const filePath = foundation.deployment.annotationFile;
  let repository = repositories.get(filePath);
  if (!repository) {
    repository = new AnnotationRepository({ annotationFile: filePath, foundation });
    repositories.set(filePath, repository);
  }
  return repository;
}

export function resetAnnotationRepositoriesForTests(): void {
  repositories.clear();
}
