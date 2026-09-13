import type { ParsedEventConfig } from "@/schemas/event-config";
import { loadDeploymentConfig } from "@/server/config/load-deployment-config";
import { loadEventConfig } from "@/server/config/load-event-config";
import type { DeploymentConfig } from "@/server/config/types";
import { loadTakeManifest } from "@/server/manifest/load-manifest";
import { getSafeTakeMetadata } from "@/server/media/resolve-media";
import { LOGICAL_VIEW_LABELS } from "@/types";
import type { SafeClientConfig, SafeTakeMetadata, TakeManifestEntry } from "@/types";

export interface ServerFoundation {
  deployment: DeploymentConfig;
  eventConfiguration: ParsedEventConfig;
  manifest: TakeManifestEntry[];
}

export interface ConfigurationProvider {
  load(): Promise<ServerFoundation>;
}

interface FileSystemProviderOptions {
  environment?: Record<string, string | undefined>;
  baseDirectory?: string;
}

export function createFileSystemConfigurationProvider(
  options: FileSystemProviderOptions = {},
): ConfigurationProvider {
  return {
    async load() {
      const deployment = await loadDeploymentConfig(
        options.environment ?? process.env,
        options.baseDirectory ?? process.cwd(),
      );
      const [eventConfiguration, manifest] = await Promise.all([
        loadEventConfig(deployment.eventConfigFile),
        loadTakeManifest(deployment.manifestPath, deployment.manifestSheet),
      ]);

      return { deployment, eventConfiguration, manifest };
    },
  };
}

const defaultProvider = createFileSystemConfigurationProvider();

export function createCachedFoundationLoader(
  provider: ConfigurationProvider,
): () => Promise<ServerFoundation> {
  let cachedPromise: Promise<ServerFoundation> | undefined;
  return () => {
    cachedPromise ??= provider.load();
    return cachedPromise;
  };
}

const loadDefaultFoundation = createCachedFoundationLoader(defaultProvider);

export function getServerFoundation(): Promise<ServerFoundation> {
  return loadDefaultFoundation();
}

export function toSafeClientConfig(foundation: ServerFoundation): SafeClientConfig {
  return {
    theme: foundation.deployment.theme,
    views: foundation.deployment.viewOrder.map((id, index) => ({
      id,
      label: LOGICAL_VIEW_LABELS[id],
      isMain: index === 0,
    })),
    eventConfigVersion: foundation.eventConfiguration.config.version,
    events: foundation.eventConfiguration.enabledEvents.map(
      ({ id, label, shortcut, color, order }) => ({
        id,
        label,
        shortcut,
        color,
        order,
      }),
    ),
  };
}

export function toSafeTakeList(foundation: ServerFoundation): TakeManifestEntry[] {
  return foundation.manifest.map((entry) => ({ ...entry }));
}

export async function loadSafeTakeMetadata(
  foundation: ServerFoundation,
  takeName: string,
): Promise<SafeTakeMetadata> {
  return getSafeTakeMetadata(foundation.deployment, foundation.manifest, takeName);
}
