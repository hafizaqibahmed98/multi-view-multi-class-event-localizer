import path from "node:path";

const unsafeSegmentPattern = /[\\/:*?"<>|\u0000-\u001f]/;

export function isSafePathSegment(value: string): boolean {
  const trimmed = value.trim();

  return (
    trimmed.length > 0 &&
    trimmed === value &&
    trimmed !== "." &&
    trimmed !== ".." &&
    !trimmed.endsWith(".") &&
    !trimmed.endsWith(" ") &&
    !unsafeSegmentPattern.test(trimmed) &&
    !path.posix.isAbsolute(trimmed) &&
    !path.win32.isAbsolute(trimmed)
  );
}

export function isSafeRelativeDirectory(value: string): boolean {
  if (!value || path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) {
    return false;
  }

  const segments = value.split(/[\\/]/);
  return segments.length > 0 && segments.every(isSafePathSegment);
}

export function isPathWithin(rootPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(rootPath, candidatePath);
  return (
    relativePath === "" ||
    (!relativePath.startsWith(`..${path.sep}`) &&
      relativePath !== ".." &&
      !path.isAbsolute(relativePath))
  );
}
