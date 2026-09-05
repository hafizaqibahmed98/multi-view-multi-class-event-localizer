import { writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadTakeManifest } from "@/server/manifest/load-manifest";
import { createTemporaryDirectory, writeWorkbook } from "./helpers/fixtures";

describe("XLSX manifest discovery", () => {
  let directory: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ directory, cleanup } = await createTemporaryDirectory());
  });

  afterEach(async () => {
    await cleanup();
  });

  it("reads non-empty take names in physical row order and ignores other columns", async () => {
    const manifestPath = path.join(directory, "takes.xlsx");
    await writeWorkbook(manifestPath, {
      headers: ["take_name", "ignored"],
      rows: [
        ["take_002", "value"],
        [null, "blank take"],
        ["take_001", "value"],
      ],
    });

    await expect(loadTakeManifest(manifestPath, "Takes")).resolves.toEqual([
      { takeName: "take_002", index: 0 },
      { takeName: "take_001", index: 1 },
    ]);
  });

  it("rejects duplicate take names", async () => {
    const manifestPath = path.join(directory, "takes.xlsx");
    await writeWorkbook(manifestPath, { rows: [["take_001"], ["take_001"]] });

    await expect(loadTakeManifest(manifestPath, "Takes")).rejects.toThrowError(
      /duplicate take_name/,
    );
  });

  it("rejects a missing workbook", async () => {
    await expect(
      loadTakeManifest(path.join(directory, "missing.xlsx"), "Takes"),
    ).rejects.toThrowError(/readable XLSX workbook/);
  });

  it("rejects a corrupted XLSX workbook", async () => {
    const manifestPath = path.join(directory, "takes.xlsx");
    await writeFile(manifestPath, "not an XLSX archive", "utf8");

    await expect(loadTakeManifest(manifestPath, "Takes")).rejects.toThrowError(
      /could not be read/,
    );
  });

  it("rejects a missing worksheet", async () => {
    const manifestPath = path.join(directory, "takes.xlsx");
    await writeWorkbook(manifestPath, { sheetName: "Other" });

    await expect(loadTakeManifest(manifestPath, "Takes")).rejects.toThrowError(
      /worksheet was not found/,
    );
  });

  it("rejects a missing take_name column", async () => {
    const manifestPath = path.join(directory, "takes.xlsx");
    await writeWorkbook(manifestPath, { headers: ["take", "notes"] });

    await expect(loadTakeManifest(manifestPath, "Takes")).rejects.toThrowError(
      /take_name column/,
    );
  });

  it.each(["../escape", "..\\escape", "/absolute", "C:\\absolute"])(
    "rejects unsafe take name %j",
    async (takeName) => {
      const manifestPath = path.join(directory, "takes.xlsx");
      await writeWorkbook(manifestPath, { rows: [[takeName]] });

      await expect(loadTakeManifest(manifestPath, "Takes")).rejects.toThrowError(
        /safe folder name/,
      );
    },
  );
});
