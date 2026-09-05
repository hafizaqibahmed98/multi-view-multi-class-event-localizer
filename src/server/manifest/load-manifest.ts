import { constants } from "node:fs";
import { access } from "node:fs/promises";

import ExcelJS from "exceljs";

import { messages } from "@/messages";
import { FoundationError } from "@/server/errors";
import { isSafePathSegment } from "@/server/path-safety";
import type { TakeManifestEntry } from "@/types";

function findTakeNameColumn(worksheet: ExcelJS.Worksheet): number | undefined {
  let takeNameColumn: number | undefined;

  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    if (takeNameColumn === undefined && cell.text.trim() === "take_name") {
      takeNameColumn = columnNumber;
    }
  });

  return takeNameColumn;
}

export async function loadTakeManifest(
  manifestPath: string,
  worksheetName: string,
): Promise<TakeManifestEntry[]> {
  try {
    await access(manifestPath, constants.R_OK);
  } catch (error) {
    throw new FoundationError("MANIFEST_UNAVAILABLE", messages.manifestUnavailable, {
      cause: error,
    });
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(manifestPath);
  } catch (error) {
    throw new FoundationError("MANIFEST_INVALID", messages.malformedManifest, {
      cause: error,
    });
  }

  const worksheet = workbook.getWorksheet(worksheetName);
  if (!worksheet) {
    throw new FoundationError("MANIFEST_INVALID", messages.worksheetMissing);
  }

  const takeNameColumn = findTakeNameColumn(worksheet);
  if (takeNameColumn === undefined) {
    throw new FoundationError("MANIFEST_INVALID", messages.takeNameColumnMissing);
  }

  const entries: TakeManifestEntry[] = [];
  const takeNames = new Set<string>();

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const takeName = worksheet.getRow(rowNumber).getCell(takeNameColumn).text.trim();
    if (!takeName) {
      continue;
    }

    if (!isSafePathSegment(takeName)) {
      throw new FoundationError("MANIFEST_INVALID", messages.invalidTakeName);
    }

    if (takeNames.has(takeName)) {
      throw new FoundationError("MANIFEST_INVALID", messages.duplicateTakeName);
    }

    takeNames.add(takeName);
    entries.push({ takeName, index: entries.length });
  }

  return entries;
}
