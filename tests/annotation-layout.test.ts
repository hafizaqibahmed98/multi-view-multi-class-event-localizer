import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(path.join(process.cwd(), "src", "app", "globals.css"), "utf8");

describe("annotation workspace layout", () => {
  it("pins workspace children to their intended rows when status is empty", () => {
    expect(css).toMatch(/\.application-header\s*\{[^}]*grid-row:\s*1;/);
    expect(css).toMatch(/\.workspace-upper\s*\{[^}]*grid-row:\s*2;/);
    expect(css).toMatch(/\.playback-status\s*\{[^}]*grid-row:\s*3;/);
    expect(css).toMatch(/\.playback-controls\s*\{[^}]*grid-row:\s*4;/);
    expect(css).toMatch(/\.annotation-section\s*\{[^}]*grid-row:\s*5;/);
  });

  it("reserves visible lane height and scrolls large event sets vertically", () => {
    expect(css).toMatch(
      /grid-template-rows:\s*auto minmax\(18rem, 1fr\) auto auto minmax\(13rem, 0\.65fr\)/,
    );
    expect(css).toMatch(/\.annotation-lanes-scroll\s*\{[^}]*overflow-y:\s*auto;/);
    expect(css).toMatch(/\.lane-label,\s*\.annotation-track\s*\{[^}]*height:\s*4\.25rem;/);
  });
});
