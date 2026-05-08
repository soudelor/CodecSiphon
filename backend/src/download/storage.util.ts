import { readdirSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

const VIDEO_EXT = new Set([
  '.mp4',
  '.mkv',
  '.webm',
  '.m4a',
  '.mov',
  '.avi',
  '.flv',
  '.opus',
  '.aac',
  '.mp3',
  '.m4v',
]);

export type FoundMediaFile = {
  absPath: string;
  size: bigint;
};

function walkFiles(dir: string, acc: string[]) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      walkFiles(full, acc);
    } else if (e.isFile()) {
      const ext = extname(e.name).toLowerCase();
      if (e.name.endsWith('.part') || e.name.endsWith('.ytdl')) continue;
      if (VIDEO_EXT.has(ext)) {
        acc.push(full);
      }
    }
  }
}

export function collectMediaFiles(taskDir: string): FoundMediaFile[] {
  const paths: string[] = [];
  walkFiles(taskDir, paths);
  const out: FoundMediaFile[] = [];
  for (const absPath of paths) {
    const st = statSync(absPath);
    if (st.isFile()) {
      out.push({ absPath, size: BigInt(st.size) });
    }
  }
  return out;
}

export function guessMime(filePath: string): string | null {
  const ext = extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.m4a': 'audio/mp4',
    '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg',
    '.opus': 'audio/opus',
    '.aac': 'audio/aac',
    '.m4v': 'video/x-m4v',
  };
  return map[ext] ?? null;
}

export { basename };
