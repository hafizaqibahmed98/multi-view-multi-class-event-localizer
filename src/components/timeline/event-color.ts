const DARK_EVENT_TEXT = "#111827";
const LIGHT_EVENT_TEXT = "#ffffff";

function channelLuminance(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: string): number {
  const match = /^#([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/.exec(color);
  if (!match) return 0;
  const [, red, green, blue] = match;
  return (
    0.2126 * channelLuminance(Number.parseInt(red, 16)) +
    0.7152 * channelLuminance(Number.parseInt(green, 16)) +
    0.0722 * channelLuminance(Number.parseInt(blue, 16))
  );
}

export function contrastRatio(left: string, right: string): number {
  const lighter = Math.max(relativeLuminance(left), relativeLuminance(right));
  const darker = Math.min(relativeLuminance(left), relativeLuminance(right));
  return (lighter + 0.05) / (darker + 0.05);
}

export function readableEventForeground(color: string): string {
  return contrastRatio(color, DARK_EVENT_TEXT) >= contrastRatio(color, LIGHT_EVENT_TEXT)
    ? DARK_EVENT_TEXT
    : LIGHT_EVENT_TEXT;
}
