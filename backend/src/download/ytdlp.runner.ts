import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

/** 与常见桌面 Chrome 接近；B 站等对缺 UA 的请求易返回 412 */
export const DEFAULT_BILIBILI_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export type RunYtdlpParams = {
  bin: string;
  url: string;
  outputTemplate: string;
  noPlaylist: boolean;
  format?: string;
  proxy?: string;
  /** 覆盖默认；B 站未设置时使用 DEFAULT_BILIBILI_UA */
  userAgent?: string;
  /** 每条为 "Name:Value"（冒号后有无空格均可），对应多次 --add-header */
  addHeaders?: string[];
  /** yt-dlp --cookies 文件路径（须存在） */
  cookiesFile?: string;
  /** yt-dlp --cookies-from-browser 参数值，如 chrome、edge */
  cookiesFromBrowser?: string;
  /** 为 true 时对 bilibili 域名自动补 Referer + UA（可被 addHeaders / userAgent 覆盖） */
  siteHints?: boolean;
  /**
   * 诊断：子进程启动、长任务心跳（默认每 60s）、退出。
   * 用于区分「yt-dlp 仍在下载/合并」与异常无输出。
   */
  onDiagnostic?: (
    event: 'spawn' | 'heartbeat' | 'close',
    detail?: string,
  ) => void;
  /**
   * 从 yt-dlp 输出中解析到的当前 URL 内进度 0–100（整数）。
   * 多 URL 任务由调用方映射为整体进度。
   */
  onProgress?: (percentWithinCurrentUrl: number) => void;
  /** yt-dlp --playlist-items，如 1-10、1,3,5-7 */
  playlistItems?: string;
  /** --merge-output-format */
  mergeOutputFormat?: string;
  writeSubtitles?: boolean;
  embedSubtitles?: boolean;
  subLangs?: string;
  embedMetadata?: boolean;
  embedThumbnail?: boolean;
};

export function isBilibiliUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === 'b23.tv' ||
      host.includes('bilibili.com') ||
      host.endsWith('.bilibili.com')
    );
  } catch {
    return false;
  }
}

function normalizeHeaderLine(line: string): string | null {
  const t = line.trim();
  const idx = t.indexOf(':');
  if (idx <= 0) return null;
  const name = t.slice(0, idx).trim();
  const value = t.slice(idx + 1).trim();
  if (!name) return null;
  return `${name}:${value}`;
}

function buildArgs(p: RunYtdlpParams): string[] {
  const args: string[] = [
    '--no-overwrites',
    '--restrict-filenames',
    '--newline',
  ];

  const headerSet = new Map<string, string>();
  for (const raw of p.addHeaders ?? []) {
    const n = normalizeHeaderLine(raw);
    if (!n) continue;
    const key = n.slice(0, n.indexOf(':')).toLowerCase();
    headerSet.set(key, n);
  }

  const hints = p.siteHints !== false;
  if (hints && isBilibiliUrl(p.url)) {
    if (!headerSet.has('referer')) {
      headerSet.set('referer', 'Referer:https://www.bilibili.com/');
    }
  }

  const ua =
    (p.userAgent?.trim() ||
      (hints && isBilibiliUrl(p.url) ? DEFAULT_BILIBILI_UA : '')) ||
    undefined;
  if (ua) {
    args.push('--user-agent', ua);
  }

  for (const h of headerSet.values()) {
    args.push('--add-header', h);
  }

  if (p.cookiesFile?.trim()) {
    const fp = p.cookiesFile.trim();
    if (!existsSync(fp)) {
      throw new Error(`Cookie 文件不存在: ${fp}`);
    }
    args.push('--cookies', fp);
  }

  if (p.cookiesFromBrowser?.trim()) {
    args.push('--cookies-from-browser', p.cookiesFromBrowser.trim());
  }

  if (p.embedMetadata) {
    args.push('--embed-metadata');
  }
  if (p.embedThumbnail) {
    args.push('--embed-thumbnail');
  }
  if (p.writeSubtitles) {
    args.push('--write-subs');
    const langs = p.subLangs?.trim() || 'zh-Hans,zh,en';
    args.push('--sub-langs', langs);
  }
  if (p.embedSubtitles) {
    args.push('--embed-subs');
  }

  args.push('-o', p.outputTemplate);
  if (p.noPlaylist) {
    args.push('--no-playlist');
  }
  const fmt = p.format?.trim() || 'bv*+ba/b';
  args.push('-f', fmt);
  if (p.proxy?.trim()) {
    args.push('--proxy', p.proxy.trim());
  }
  if (p.playlistItems?.trim()) {
    args.push('--playlist-items', p.playlistItems.trim());
  }
  if (p.mergeOutputFormat?.trim()) {
    args.push('--merge-output-format', p.mergeOutputFormat.trim());
  }
  args.push(p.url);
  return args;
}

/**
 * 解析 yt-dlp 带 --newline 时的典型进度行，例如：
 * [download]  45.2% of ~100.00MiB at ...
 */
export function parseYtDlpProgressPercent(line: string): number | null {
  const t = line.trim();
  if (!/\[download\]/i.test(t)) return null;
  const m = t.match(/\[download\]\s+(\d+\.?\d*)%/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  if (!Number.isFinite(v)) return null;
  return Math.min(100, Math.max(0, Math.round(v)));
}

function createLineSplitter(
  onLine: (line: string) => void,
): (chunk: string) => void {
  let buf = '';
  return (chunk: string) => {
    buf += chunk;
    const parts = buf.split(/\r?\n/);
    buf = parts.pop() ?? '';
    for (const line of parts) {
      if (line.length > 0) onLine(line);
    }
  };
}

/**
 * Runs yt-dlp as a subprocess (no shell). Rejects with stderr tail on non-zero exit.
 */
export function runYtdlp(p: RunYtdlpParams): Promise<void> {
  const args = buildArgs(p);
  const stderrChunks: string[] = [];
  const started = Date.now();
  const HEARTBEAT_MS = 60_000;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const feedProgressLine = (line: string) => {
    if (!p.onProgress) return;
    const pct = parseYtDlpProgressPercent(line);
    if (pct !== null) p.onProgress(pct);
  };
  const onStdoutLine = createLineSplitter(feedProgressLine);
  const onStderrLine = createLineSplitter((line) => {
    feedProgressLine(line);
  });

  return new Promise((resolve, reject) => {
    const child = spawn(p.bin, args, {
      windowsHide: true,
      env: { ...process.env },
    });

    const urlShort =
      p.url.length > 160 ? `${p.url.slice(0, 160)}…` : p.url;
    p.onDiagnostic?.(
      'spawn',
      `pid=${child.pid ?? '?'} bin=${p.bin} url=${urlShort} args=${args.length}`,
    );

    heartbeat = setInterval(() => {
      const sec = Math.round((Date.now() - started) / 1000);
      p.onDiagnostic?.(
        'heartbeat',
        `yt-dlp 仍在运行，已 ${sec}s（进度来自 [download] x% 输出，未见输出则可能卡在解析/合并等阶段）`,
      );
    }, HEARTBEAT_MS);

    child.stderr?.on('data', (chunk: Buffer) => {
      const s = chunk.toString('utf8');
      stderrChunks.push(s);
      onStderrLine(s);
    });
    child.stdout?.on('data', (chunk: Buffer) => {
      onStdoutLine(chunk.toString('utf8'));
    });

    child.on('error', (err) => {
      if (heartbeat) clearInterval(heartbeat);
      reject(err);
    });

    child.on('close', (code) => {
      if (heartbeat) clearInterval(heartbeat);
      const ms = Date.now() - started;
      /* 刷新残余行上的进度 */
      onStdoutLine('\n');
      onStderrLine('\n');
      if (code === 0) {
        p.onDiagnostic?.('close', `exit=0 耗时 ${ms}ms`);
        resolve();
        return;
      }
      const errText = stderrChunks.join('').trim();
      const tail = errText ? errText.slice(-8000) : '';
      p.onDiagnostic?.(
        'close',
        `exit=${code ?? 'unknown'} 耗时 ${ms}ms stderrBytes=${errText.length}`,
      );
      reject(
        new Error(
          tail || `yt-dlp exited with code ${code ?? 'unknown'}`,
        ),
      );
    });
  });
}
