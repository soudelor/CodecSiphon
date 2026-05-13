import type { UrlExtractFullResult, UrlExtractPublicResult } from '@/types/models';
import axios from 'axios';
import { api } from './client';

function extractApiErrorKey(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  if (typeof o.key === 'string' && o.key) return o.key;
  const msg = o.message;
  if (
    msg &&
    typeof msg === 'object' &&
    !Array.isArray(msg) &&
    typeof (msg as Record<string, unknown>).key === 'string'
  ) {
    const k = (msg as Record<string, unknown>).key;
    return typeof k === 'string' ? k : null;
  }
  return null;
}

export async function previewPublicUrlExtract(
  url: string,
): Promise<UrlExtractPublicResult> {
  const { data } = await api.post<UrlExtractPublicResult>(
    '/url-extract/preview-public',
    { url },
  );
  return data;
}

export async function parseUrlExtract(
  url: string,
): Promise<UrlExtractFullResult> {
  const { data } = await api.post<UrlExtractFullResult>('/url-extract/parse', {
    url,
  });
  return data;
}

/**
 * 登录用户：节选短视频片（片长由服务端 URL_EXTRACT_SAMPLE_MAX_SEC 约束）。
 */
export async function downloadUrlExtractSampleClip(
  videoUrl: string,
): Promise<void> {
  try {
    const res = await api.post<Blob>(
      '/url-extract/sample',
      { videoUrl },
      { responseType: 'blob', timeout: 300_000 },
    );
    const blob = res.data;
    const cd = res.headers['content-disposition'];
    let name = 'codec-siphon-sample.mp4';
    if (cd && typeof cd === 'string') {
      const m = /filename\*=UTF-8''([^;]+)/i.exec(cd);
      if (m?.[1]) {
        try {
          name = decodeURIComponent(m[1].trim());
        } catch {
          /* keep default */
        }
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e: unknown) {
    if (axios.isAxiosError(e) && e.response?.data instanceof Blob) {
      const text = await e.response.data.text();
      try {
        const j = JSON.parse(text) as unknown;
        const key = extractApiErrorKey(j);
        if (key) {
          throw Object.assign(new Error(key), {
            response: { data: { key } },
          });
        }
      } catch (inner) {
        if (
          inner instanceof Error &&
          'response' in inner &&
          typeof (inner as { response?: unknown }).response === 'object'
        ) {
          throw inner;
        }
      }
    }
    throw e;
  }
}
