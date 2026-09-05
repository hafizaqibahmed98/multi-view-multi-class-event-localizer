import { describe, expect, it } from "vitest";

import { createWorkspaceViewLayout } from "@/components/workspace/workspace-layout";
import type { SafeViewAvailability } from "@/types";

function view(id: SafeViewAvailability["id"], available = true): SafeViewAvailability {
  return { id, label: id, available, ...(available ? { mediaUrl: `/media/${id}` } : {}) };
}

describe("fixed configured workspace layout", () => {
  it("uses one configured view as main and reserves no supporting space", () => {
    const layout = createWorkspaceViewLayout([view("ego")]);
    expect(layout.main?.id).toBe("ego");
    expect(layout.supporting).toEqual([]);
  });

  it("preserves five-view order with a fixed main and four supporting cards", () => {
    const configured = [view("view3"), view("ego"), view("view1"), view("view2"), view("view4")];
    const layout = createWorkspaceViewLayout(configured);
    expect(layout.main?.id).toBe("view3");
    expect(layout.supporting.map(({ id }) => id)).toEqual(["ego", "view1", "view2", "view4"]);
  });

  it("retains unavailable main and supporting views in their configured positions", () => {
    const configured = [view("view3", false), view("ego"), view("view1", false)];
    const layout = createWorkspaceViewLayout(configured);
    expect(layout.main).toEqual(configured[0]);
    expect(layout.supporting).toEqual(configured.slice(1));
  });

  it("cannot promote a supporting view because layout is derived only from config order", () => {
    const configured = [view("view3"), view("ego")];
    const before = createWorkspaceViewLayout(configured);
    const after = createWorkspaceViewLayout(configured);
    expect(after).toEqual(before);
    expect(after.main?.id).toBe("view3");
  });
});
