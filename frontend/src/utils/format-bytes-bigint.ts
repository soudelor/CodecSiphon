/** 将非负整数（十进制字符串）格式化为 1024 进位；避免超大整数用 Number 失真 */
export function formatBytesBigIntString(raw: string): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  try {
    let n = BigInt(raw.trim());
    if (n < 0n) {
      n = 0n;
    }
    let i = 0;
    let v = n;
    while (v >= 1024n && i < units.length - 1) {
      v = v / 1024n;
      i += 1;
    }
    return `${v.toString()} ${units[i]}`;
  } catch {
    return raw;
  }
}

/** 已用量占配额的百分比 0–100；配额为 0 时返回 0 */
export function storageUsePercentString(
  usedStr: string,
  quotaStr: string,
): number {
  try {
    const u = BigInt(usedStr.trim());
    const q = BigInt(quotaStr.trim());
    if (q <= 0n) {
      return 0;
    }
    const p = Number((u * 100n) / q);
    return Math.min(100, Math.max(0, Math.round(p)));
  } catch {
    return 0;
  }
}
