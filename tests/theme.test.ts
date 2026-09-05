import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const tokens = readFileSync(
  path.join(process.cwd(), "src", "styles", "tokens.css"),
  "utf8",
);
const requiredTokens = [
  "background",
  "surface",
  "foreground",
  "muted",
  "border",
  "accent",
  "focus",
  "control-background",
  "control-foreground",
  "warning",
  "danger",
  "playhead",
];

function themeBlock(selector: string): string {
  const start = tokens.indexOf(selector);
  const open = tokens.indexOf("{", start);
  const close = tokens.indexOf("}", open);
  return tokens.slice(open + 1, close);
}

describe("startup-selected themes", () => {
  it.each([":root", '[data-theme="light"]'])(
    "defines the complete required palette for %s",
    (selector) => {
      const block = themeBlock(selector);
      for (const token of requiredTokens) {
        expect(block).toContain(`--${token}:`);
      }
    },
  );

  it("keeps theme selection configuration-driven without a runtime toggle", () => {
    const layout = readFileSync(path.join(process.cwd(), "src", "app", "layout.tsx"), "utf8");
    const workspace = readFileSync(
      path.join(process.cwd(), "src", "components", "workspace", "workspace-shell.tsx"),
      "utf8",
    );
    expect(layout).toContain("data-theme={theme}");
    expect(workspace).not.toMatch(/toggleTheme|setTheme|theme switch/i);
  });
});
