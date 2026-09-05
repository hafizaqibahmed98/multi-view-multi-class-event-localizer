import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";

import { messages } from "@/messages";
import { parseEventConfig, type ParsedEventConfig } from "@/schemas/event-config";
import { FoundationError } from "@/server/errors";

export async function loadEventConfig(eventConfigFile: string): Promise<ParsedEventConfig> {
  let source: string;

  try {
    await access(eventConfigFile, constants.R_OK);
    source = await readFile(eventConfigFile, "utf8");
  } catch (error) {
    throw new FoundationError(
      "EVENT_CONFIG_UNAVAILABLE",
      messages.eventConfigUnavailable,
      { cause: error },
    );
  }

  let input: unknown;
  try {
    input = JSON.parse(source);
  } catch (error) {
    throw new FoundationError(
      "EVENT_CONFIG_INVALID",
      messages.malformedEventJson,
      { cause: error },
    );
  }

  return parseEventConfig(input);
}
