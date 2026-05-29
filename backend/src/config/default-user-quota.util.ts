import { ConfigService } from '@nestjs/config';

/** 注册时缺省：1 GiB（与 `.env.example` 一致时可改 env） */
export const FALLBACK_USER_STORAGE_QUOTA_BYTES = 1073741824n;
/** 注册时缺省：自然月出站下载配额 5 GiB（计量与限流见后续迭代） */
export const FALLBACK_USER_MONTHLY_DOWNLOAD_QUOTA_BYTES = 5368709120n;

function parseNonNegativeBigInt(raw: string | undefined, fb: bigint): bigint {
  if (raw === undefined || String(raw).trim() === '') {
    return fb;
  }
  try {
    const n = BigInt(String(raw).trim());
    if (n < 0n) {
      return fb;
    }
    return n;
  } catch {
    return fb;
  }
}

/**
 * 新用户注册时分配套额来源：环境变量 `DEFAULT_USER_STORAGE_QUOTA_BYTES`、
 * `DEFAULT_USER_MONTHLY_DOWNLOAD_QUOTA_BYTES`（字节，非负整数串）。
 */
export function defaultUserQuotasFromEnv(config: ConfigService): {
  storageQuotaBytes: bigint;
  monthlyDownloadQuotaBytes: bigint;
} {
  return {
    storageQuotaBytes: parseNonNegativeBigInt(
      config.get<string>('DEFAULT_USER_STORAGE_QUOTA_BYTES'),
      FALLBACK_USER_STORAGE_QUOTA_BYTES,
    ),
    monthlyDownloadQuotaBytes: parseNonNegativeBigInt(
      config.get<string>('DEFAULT_USER_MONTHLY_DOWNLOAD_QUOTA_BYTES'),
      FALLBACK_USER_MONTHLY_DOWNLOAD_QUOTA_BYTES,
    ),
  };
}
