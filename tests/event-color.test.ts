import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  readableEventForeground,
} from "@/components/timeline/event-color";

describe("event color readability", () => {
  it.each(["#24C6A1", "#6C7CFF", "#F4B74A", "#000000", "#FFFFFF"])(
    "selects readable text and handles for configured color %s",
    (color) => {
      const foreground = readableEventForeground(color);
      expect(["#111827", "#ffffff"]).toContain(foreground);
      expect(contrastRatio(color, foreground)).toBeGreaterThanOrEqual(4.5);
    },
  );
});
