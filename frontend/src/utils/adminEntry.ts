/**
 * Admin UI entry URLs use a path segment `/admin/<yyyymmdd>/...`
 * where `yyyymmdd` is the **local calendar date** (user's browser).
 * The segment must match "today" or navigation is rejected (redirect `/`).
 */

export function todayYyyymmdd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export function adminBasePath(): string {
  return `/admin/${todayYyyymmdd()}`;
}

export function adminLoginPath(): string {
  return `${adminBasePath()}/login`;
}

/** `/admin/<8 digits>/...` → date segment, else `null` (e.g. `/admin/login` legacy). */
export function parseAdminDateFromPath(path: string): string | null {
  const m = path.match(/^\/admin\/(\d{8})(?:\/|$)/);
  return m?.[1] ?? null;
}

export function isValidAdminDateSegment(segment: string): boolean {
  if (!/^\d{8}$/.test(segment)) return false;
  return segment === todayYyyymmdd();
}
