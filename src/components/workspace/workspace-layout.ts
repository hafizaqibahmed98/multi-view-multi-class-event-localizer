import type { SafeViewAvailability } from "@/types";

export interface WorkspaceViewLayout {
  main?: SafeViewAvailability;
  supporting: SafeViewAvailability[];
}

export function createWorkspaceViewLayout(
  configuredViews: readonly SafeViewAvailability[],
): WorkspaceViewLayout {
  const [main, ...supporting] = configuredViews;
  return { main, supporting };
}
