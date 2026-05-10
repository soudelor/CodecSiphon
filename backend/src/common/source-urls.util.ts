import { Prisma } from '@prisma/client';

/** Normalizes `download_tasks.source_urls` stored as JSON array of strings. */
export function sourceUrlsFromJson(
  value: Prisma.JsonValue | null | undefined,
): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === 'string');
}
