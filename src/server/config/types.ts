import type { AppTheme, LogicalViewId } from "@/types";

export interface DeploymentConfig {
  datasetRoot: string;
  takeVideoSubdirectory: string;
  manifestPath: string;
  manifestSheet: string;
  annotationFile: string;
  eventConfigFile: string;
  theme: AppTheme;
  viewOrder: LogicalViewId[];
  viewFilenames: Partial<Record<LogicalViewId, string>>;
}
