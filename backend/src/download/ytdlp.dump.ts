import { spawn } from 'node:child_process';

const MAX_STDOUT = 32 * 1024 * 1024;

export type TaskPreviewPlaylistEntryDto = {
  index: number;
  id: string | null;
  title: string;
  duration: number | null;
};

export type TaskPreviewVideoDto = {
  kind: 'video';
  title: string | null;
  duration: number | null;
  durationLabel: string | null;
  uploader: string | null;
  thumbnail: string | null;
  id: string | null;
  webpageUrl: string | null;
};

export type TaskPreviewPlaylistDto = {
  kind: 'playlist';
  title: string | null;
  playlistId: string | null;
  entryCount: number;
  entries: TaskPreviewPlaylistEntryDto[];
};

export type TaskPreviewResult = TaskPreviewVideoDto | TaskPreviewPlaylistDto;

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

export function mapYtDlpJsonToPreview(data: unknown): TaskPreviewResult {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('无效的 yt-dlp JSON');
  }
  const d = data as Record<string, unknown>;
  const entriesRaw = d.entries;

  const isPlaylist =
    d._type === 'playlist' ||
    (Array.isArray(entriesRaw) && (entriesRaw as unknown[]).length > 1);

  if (isPlaylist && Array.isArray(entriesRaw)) {
    const list = entriesRaw as Record<string, unknown>[];
    const mapped: TaskPreviewPlaylistEntryDto[] = list.slice(0, 100).map(
      (e, i) => ({
        index: i + 1,
        id: asString(e.id),
        title:
          typeof e.title === 'string'
            ? e.title
            : typeof e.url === 'string'
              ? e.url
              : `#${i + 1}`,
        duration: asNumber(e.duration),
      }),
    );
    const count =
      typeof d.playlist_count === 'number' && Number.isFinite(d.playlist_count)
        ? d.playlist_count
        : mapped.length;

    return {
      kind: 'playlist',
      title: asString(d.title),
      playlistId: asString(d.id),
      entryCount: count,
      entries: mapped,
    };
  }

  const dur = asNumber(d.duration);
  let thumbnail: string | null = null;
  if (typeof d.thumbnail === 'string') thumbnail = d.thumbnail;
  else if (Array.isArray(d.thumbnails)) {
    const arr = d.thumbnails as { url?: string }[];
    const last = arr[arr.length - 1];
    if (last?.url) thumbnail = last.url;
  }

  return {
    kind: 'video',
    title: asString(d.title),
    duration: dur,
    durationLabel: formatDurationLabel(dur),
    uploader: asString(d.uploader) ?? asString(d.channel),
    thumbnail,
    id: asString(d.id),
    webpageUrl:
      asString(d.webpage_url) ?? asString(d.original_url),
  };
}

/**
 * 仅拉取元数据：yt-dlp -J --skip-download（列表类链接默认加 --flat-playlist）。
 */
export async function ytDlpDumpJson(
  bin: string,
  url: string,
  opts: { flatPlaylist?: boolean; timeoutMs?: number } = {},
): Promise<unknown> {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const useFlat =
    opts.flatPlaylist ??
    (/[?&]list=[^&]+/.test(url) || /\/playlist\?/i.test(url));

  const args = ['-J', '--skip-download', '--no-warnings'];
  if (useFlat) {
    args.push('--flat-playlist');
  }
  args.push(url);

  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      windowsHide: true,
      env: { ...process.env },
    });

    const chunks: Buffer[] = [];
    let total = 0;
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      try {
        child.kill('SIGTERM');
      } catch {
        try {
          child.kill();
        } catch {
          /* ignore */
        }
      }
      reject(new Error(`yt-dlp 元数据请求超时（${timeoutMs / 1000}s）`));
    }, timeoutMs);

    const cleanup = () => clearTimeout(timer);

    child.stdout?.on('data', (b: Buffer) => {
      total += b.length;
      if (total > MAX_STDOUT) {
        if (!killed) {
          killed = true;
          try {
            child.kill();
          } catch {
            /* ignore */
          }
        }
        cleanup();
        reject(new Error('yt-dlp 输出过大，请缩小播放列表或改用分段范围'));
        return;
      }
      chunks.push(b);
    });

    child.stderr?.on('data', () => {});

    child.on('error', (err) => {
      cleanup();
      if (!killed) reject(err);
    });

    child.on('close', (code) => {
      cleanup();
      if (killed) return;
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        reject(
          new Error(
            `yt-dlp 无可用输出（exit ${code ?? 'unknown'}），请检查 URL、Cookie 或升级 yt-dlp`,
          ),
        );
        return;
      }
      try {
        resolve(JSON.parse(raw) as unknown);
      } catch {
        reject(
          new Error(
            `无法解析 yt-dlp JSON（exit ${code ?? 'unknown'}）：${raw.slice(0, 500)}`,
          ),
        );
      }
    });
  });
}
