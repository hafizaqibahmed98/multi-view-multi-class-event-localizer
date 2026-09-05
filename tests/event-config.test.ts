import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { parseEventConfig } from "@/schemas/event-config";
import { loadEventConfig } from "@/server/config/load-event-config";
import {
  createTemporaryDirectory,
  validEventConfiguration,
} from "./helpers/fixtures";

describe("event configuration", () => {
  it("validates the shipped synthetic event configuration", async () => {
    const source = await readFile(
      path.join(process.cwd(), "config", "events.example.json"),
      "utf8",
    );
    const result = parseEventConfig(JSON.parse(source));

    expect(result.config.version).toBe("1.0");
    expect(result.enabledEvents.map(({ id }) => id)).toEqual(["walk", "run", "jump"]);
  });

  it("retains the version and returns only enabled events in configured order", () => {
    const result = parseEventConfig(validEventConfiguration);

    expect(result.config.version).toBe("1.0");
    expect(result.config.events).toHaveLength(3);
    expect(result.enabledEvents.map(({ id }) => id)).toEqual(["walk", "run"]);
  });

  it("rejects duplicate enabled IDs", () => {
    expect(() =>
      parseEventConfig({
        ...validEventConfiguration,
        events: [
          validEventConfiguration.events[0],
          { ...validEventConfiguration.events[0], shortcut: "S" },
        ],
      }),
    ).toThrowError(/required event schema/);
  });

  it("rejects duplicate enabled shortcuts case-insensitively", () => {
    expect(() =>
      parseEventConfig({
        ...validEventConfiguration,
        events: [
          validEventConfiguration.events[0],
          { ...validEventConfiguration.events[1], shortcut: "r" },
        ],
      }),
    ).toThrowError(/required event schema/);
  });

  it.each(["Escape", " ", "F1", "-"])("rejects invalid shortcut %j", (shortcut) => {
    expect(() =>
      parseEventConfig({
        ...validEventConfiguration,
        events: [{ ...validEventConfiguration.events[0], shortcut }],
      }),
    ).toThrowError(/required event schema/);
  });

  it("rejects malformed colors", () => {
    expect(() =>
      parseEventConfig({
        ...validEventConfiguration,
        events: [{ ...validEventConfiguration.events[0], color: "blue" }],
      }),
    ).toThrowError(/required event schema/);
  });

  it("rejects an empty enabled label", () => {
    expect(() =>
      parseEventConfig({
        ...validEventConfiguration,
        events: [{ ...validEventConfiguration.events[0], label: "   " }],
      }),
    ).toThrowError(/required event schema/);
  });

  it("rejects invalid IDs and malformed event objects", () => {
    expect(() =>
      parseEventConfig({
        version: "1.0",
        events: [{ ...validEventConfiguration.events[0], id: "../run" }],
      }),
    ).toThrowError(/required event schema/);
    expect(() => parseEventConfig({ version: "1.0", events: [{ id: "run" }] })).toThrowError(
      /required event schema/,
    );
  });
});

describe("event configuration file loading", () => {
  let directory: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ directory, cleanup } = await createTemporaryDirectory());
  });

  afterEach(async () => {
    await cleanup();
  });

  it("rejects malformed JSON with an actionable message", async () => {
    const filePath = path.join(directory, "events.json");
    await writeFile(filePath, "{not-json", "utf8");

    await expect(loadEventConfig(filePath)).rejects.toThrowError(/not valid JSON/);
  });

  it("rejects a missing event configuration file", async () => {
    await expect(loadEventConfig(path.join(directory, "missing.json"))).rejects.toThrowError(
      /readable JSON file/,
    );
  });
});
