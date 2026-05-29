/**
 * 管理端统一用「M」展示：1 M = 1 MiB = 1024² 字节（与后端 BigInt 字节一致）。
 */

const MIB_BYTES = 1024n ** 2n;

/**
 * 将字节整数串格式化为 `… M`，非整 MiB 时保留一位小数（截断，不向上取整）。
 */
export function formatBytesStringAsMegabytesM(raw: string): string {
  try {
    let n = BigInt(String(raw ?? '0').trim());
    if (n < 0n) n = 0n;
    const q = n / MIB_BYTES;
    const r = n % MIB_BYTES;
    if (r === 0n) {
      return `${q.toString()} M`;
    }
    const tenth = Number((r * 10n) / MIB_BYTES);
    return `${q.toString()}.${String(tenth)} M`;
  } catch {
    return String(raw);
  }
}

/** 字节向下取整的 MiB 整数字符串（用于仅以整数 MiB 编辑配额时的输入初始化） */
export function bytesStringFlooredMegabytesInteger(raw: string): string {
  try {
    let n = BigInt(String(raw ?? '0').trim());
    if (n < 0n) n = 0n;
    return (n / MIB_BYTES).toString();
  } catch {
    return '';
  }
}

/** 非负整数字符串形式的 MiB → 字节整数字符串；非法则为 undefined */
export function nonnegativeIntegerMbToByteString(mbText: string): string | undefined {
  const t = mbText.trim();
  if (!/^\d+$/.test(t)) {
    return undefined;
  }
  try {
    return (BigInt(t) * MIB_BYTES).toString();
  } catch {
    return undefined;
  }
}
