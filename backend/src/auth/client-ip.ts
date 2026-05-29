import type { Request } from 'express';

/** 与 AdminAuditService.clientIp 语义一致（用户站限流/IP 兜底）。 */
export function clientIpFromRequest(req: Request): string {
  const xfRaw = req.headers['x-forwarded-for'];
  if (typeof xfRaw === 'string' && xfRaw.trim()) {
    return xfRaw.split(',')[0]?.trim().slice(0, 128) || 'unknown';
  }
  const xfArr = req.headers['x-forwarded-for'];
  if (
    Array.isArray(xfArr) &&
    xfArr.length > 0 &&
    typeof xfArr[0] === 'string'
  ) {
    return xfArr[0].trim().slice(0, 128);
  }
  const ra = typeof req.socket?.remoteAddress === 'string'
    ? req.socket.remoteAddress.slice(0, 128)
    : null;
  return ra ?? 'unknown';
}
