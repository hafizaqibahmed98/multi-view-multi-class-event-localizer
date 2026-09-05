import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { TakeNavigation } from "@/components/navigation/take-navigation";
import { protectBeforeUnload } from "@/components/navigation/use-dirty-before-unload";

describe("take navigation controls", () => {
  it("disables Previous on the first take without adding a searchable selector", () => {
    const markup = renderToStaticMarkup(
      <TakeNavigation
        hasNext
        hasPrevious={false}
        isSaving={false}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
        onSaveNext={vi.fn()}
        saveBlocked={false}
      />,
    );
    expect(markup).toContain('<button disabled="" type="button">Previous</button>');
    expect(markup).not.toContain("<input");
    expect(markup).not.toContain("<select");
  });

  it("disables Next on the final take and all navigation during saving", () => {
    const finalMarkup = renderToStaticMarkup(
      <TakeNavigation
        hasNext={false}
        hasPrevious
        isSaving={false}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
        onSaveNext={vi.fn()}
        saveBlocked={false}
      />,
    );
    expect(finalMarkup).toContain('<button disabled="" type="button">Next</button>');

    const savingMarkup = renderToStaticMarkup(
      <TakeNavigation
        hasNext
        hasPrevious
        isSaving
        onNext={vi.fn()}
        onPrevious={vi.fn()}
        onSaveNext={vi.fn()}
        saveBlocked={false}
      />,
    );
    expect(savingMarkup.match(/disabled=""/g)).toHaveLength(3);
    expect(savingMarkup).toContain("Saving…");
  });

  it("blocks Save & Next independently of sequential navigation", () => {
    const markup = renderToStaticMarkup(
      <TakeNavigation
        hasNext
        hasPrevious
        isSaving={false}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
        onSaveNext={vi.fn()}
        saveBlocked
      />,
    );
    expect(markup.match(/disabled=""/g)).toHaveLength(1);
  });
});

describe("dirty browser navigation protection", () => {
  it("prevents unload and requests the browser confirmation contract", () => {
    const event = { preventDefault: vi.fn(), returnValue: undefined } as unknown as BeforeUnloadEvent;
    protectBeforeUnload(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.returnValue).toBe("");
  });
});
