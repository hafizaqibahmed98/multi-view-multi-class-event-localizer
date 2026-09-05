import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import ExcelJS from "exceljs";

export async function createTemporaryDirectory(): Promise<{
  directory: string;
  cleanup: () => Promise<void>;
}> {
  const directory = await mkdtemp(path.join(tmpdir(), "event-localizer-test-"));
  return {
    directory,
    cleanup: () => rm(directory, { force: true, recursive: true }),
  };
}

export async function writeWorkbook(
  filePath: string,
  options: {
    sheetName?: string;
    headers?: string[];
    rows?: Array<Array<string | null>>;
  } = {},
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(options.sheetName ?? "Takes");
  worksheet.addRow(options.headers ?? ["take_name"]);
  for (const row of options.rows ?? [["take_001"], ["take_002"]]) {
    worksheet.addRow(row);
  }
  await workbook.xlsx.writeFile(filePath);
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function validEnvironment(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    DATASET_ROOT: "./dataset",
    TAKE_VIDEO_SUBDIR: "frame_aligned_videos",
    TAKE_MANIFEST_XLSX: "./dataset/takes.xlsx",
    TAKE_MANIFEST_SHEET: "Takes",
    ANNOTATION_FILE: "./annotations/annotations.json",
    EVENT_CONFIG_FILE: "./config/events.json",
    APP_THEME: "dark",
    VIDEO_NUMBER_OF_VIEWS: "2",
    VIDEO_VIEW_ORDER: "view3,ego",
    VIDEO_FILENAME_EGO: "egoView.mp4",
    VIDEO_FILENAME_VIEW1: "cam01.mp4",
    VIDEO_FILENAME_VIEW2: "cam02.mp4",
    VIDEO_FILENAME_VIEW3: "cam03.mp4",
    VIDEO_FILENAME_VIEW4: "cam04.mp4",
    ...overrides,
  };
}

export const validEventConfiguration = {
  version: "1.0",
  events: [
    {
      id: "run",
      label: "Run",
      shortcut: "R",
      color: "#6C7CFF",
      order: 2,
      enabled: true,
    },
    {
      id: "walk",
      label: "Walk",
      shortcut: "W",
      color: "#24C6A1",
      order: 1,
      enabled: true,
    },
    {
      id: "archived",
      label: "Archived",
      shortcut: "A",
      color: "#888888",
      order: 3,
      enabled: false,
    },
  ],
};
