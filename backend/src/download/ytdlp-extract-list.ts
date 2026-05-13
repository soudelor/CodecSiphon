import { PreviewMetadataError } from './preview-metadata.error';

export type UrlExtractItemDto = {
  index: number;
  title: string;
  durationSec: number | null;
  durationLabel: string | null;
  resolution: string | null;
  /** ISO 日期 yyyy-mm-dd 或 null */
  publishedAt: string | null;
  copyUrl: string;
};

function asString(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (v == null) return null;
  return String(v);
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatDurationLabel(sec: number | null): string | null {
  if (sec == null || !Number.isFinite(sec)) return null;
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }
  return `${m}:${String(r).padStart(2, '0')}`;
}

function pickCopyUrl(e: Record<string, unknown>): string {
  return (
    asString(e.webpage_url)?.trim() ||
    asString(e.original_url)?.trim() ||
    asString(e.url)?.trim() ||
    ''
  );
}

function pickResolution(e: Record<string, unknown>): string | null {
  const w = asNumber(e.width);
  const h = asNumber(e.height);
  if (w != null && h != null && w > 0 && h > 0) {
    return `${Math.round(w)}×${Math.round(h)}`;
  }
  const res = asString(e.resolution)?.trim();
  return res || null;
}

function pickPublishedAt(e: Record<string, unknown>): string | null {
  const ts = asNumber(e.release_timestamp);
  if (ts != null && ts > 0) {
    try {
      return new Date(ts * 1000).toISOString().slice(0, 10);
    } catch {
      /* ignore */
    }
  }
  const ud = asString(e.upload_date)?.trim();
  if (ud && /^\d{8}$/.test(ud)) {
    return `${ud.slice(0, 4)}-${ud.slice(4, 6)}-${ud.slice(6, 8)}`;
  }
  return null;
}

function mapEntry(e: Record<string, unknown>, fallbackIndex: number): UrlExtractItemDto {
  const idx =
    asNumber(e.playlist_index) ??
    asNumber(e.playlist_autonumber) ??
    fallbackIndex + 1;
  const durationSec = asNumber(e.duration);
  const title =
    asString(e.title)?.trim() ||
    asString(e.id)?.trim() ||
    `#${idx}`;
  const copyUrl = pickCopyUrl(e);
  return {
    index: Math.max(1, Math.floor(idx)),
    title,
    durationSec,
    durationLabel: formatDurationLabel(durationSec),
    resolution: pickResolution(e),
    publishedAt: pickPublishedAt(e),
    copyUrl,
  };
}

function normalizeRoot(data: unknown): Record<string, unknown> {
  let root: unknown = data;
  if (Array.isArray(root)) {
    const [only] = root;
    if (
      root.length === 1 &&
      only != null &&
      typeof only === 'object' &&
      !Array.isArray(only)
    ) {
      root = only;
    } else {
      throw new PreviewMetadataError(
        'errors.previewMetadataArray',
        `extract list: root JSON array length=${root.length}`,
      );
    }
  }
  if (root == null || typeof root !== 'object' || Array.isArray(root)) {
    const kind = root == null ? 'null' : typeof root;
    throw new PreviewMetadataError(
      'errors.previewMetadataInvalid',
      `extract list: root not object, kind=${kind}`,
    );
  }
  return root as Record<string, unknown>;
}

export type UrlExtractListResult = {
  items: UrlExtractItemDto[];
  total: number;
  listTruncated: boolean;
};

/**
 * 将 yt-dlp `-J` 输出（建议 flat-playlist 列表）转为统一条目列表。
 */
export function mapYtDlpJsonToExtractList(
  data: unknown,
  maxItems: number,
): UrlExtractListResult {
  const root = normalizeRoot(data);
  const entriesRaw = root.entries;

  if (Array.isArray(entriesRaw) && entriesRaw.length > 0) {
    const rawCount = asNumber(root.playlist_count);
    const total =
      rawCount != null && rawCount > 0 ? Math.floor(rawCount) : entriesRaw.length;
    const capped = entriesRaw.slice(
      0,
      Math.max(0, Math.min(maxItems, entriesRaw.length)),
    );
    const items = capped.map((e, i) =>
      mapEntry(
        e && typeof e === 'object' && !Array.isArray(e)
          ? (e as Record<string, unknown>)
          : {},
        i,
      ),
    );
    const listTruncated = total > items.length;
    return { items, total, listTruncated };
  }

  const looksVideo =
    root._type === 'video' ||
    (root.id != null && root.title != null) ||
    root.duration != null;

  if (looksVideo || root.webpage_url || root.url) {
    const item = mapEntry(root, 0);
    if (!item.copyUrl) {
      throw new PreviewMetadataError(
        'errors.previewMetadataInvalid',
        'extract list: single video missing url',
      );
    }
    return { items: [item], total: 1, listTruncated: false };
  }

  throw new PreviewMetadataError(
    'errors.previewMetadataInvalid',
    'extract list: unrecognized JSON shape',
  );
}
