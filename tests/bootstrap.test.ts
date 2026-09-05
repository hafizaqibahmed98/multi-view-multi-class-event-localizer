import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(resolve(repositoryRoot, relativePath), "utf8"));
}

describe("Phase 0 repository bootstrap", () => {
  it("declares the required project commands", () => {
    const packageJson = readJson("package.json") as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts).toMatchObject({
      build: "next build",
      dev: "next dev",
      lint: "eslint .",
      start: "next start",
      typecheck: "tsc --noEmit",
    });
  });

  it("ships synthetic event configuration with stable unique keys", () => {
    const eventConfig = readJson("config/events.example.json") as {
      version: string;
      events: Array<{ id: string; shortcut: string }>;
    };
    const eventIds = eventConfig.events.map(({ id }) => id);
    const shortcuts = eventConfig.events.map(({ shortcut }) => shortcut.toLowerCase());

    expect(eventConfig.version).toBe("1.0");
    expect(new Set(eventIds).size).toBe(eventIds.length);
    expect(new Set(shortcuts).size).toBe(shortcuts.length);
  });

  it("keeps the supplied interface reference in documentation", () => {
    const screenshot = readFileSync(
      resolve(repositoryRoot, "docs/screenshots/interface-reference.png"),
    );

    expect(screenshot.byteLength).toBeGreaterThan(0);
  });

  it("creates the planned module ownership boundaries", () => {
    const requiredDirectories = [
      "src/components/workspace",
      "src/components/playback",
      "src/components/events",
      "src/components/timeline",
      "src/components/navigation",
      "src/components/common",
      "src/server/config",
      "src/server/manifest",
      "src/server/media",
      "src/server/annotations",
      "src/schemas",
      "src/types",
      "src/messages",
      "src/styles",
    ];

    for (const directory of requiredDirectories) {
      expect(statSync(resolve(repositoryRoot, directory)).isDirectory()).toBe(true);
    }
  });
});
