/**
 * 链接检测阶段：对用户仅返回 {@link i18nKey}，详细说明放在 {@link message} 供日志使用。
 */
export class PreviewMetadataError extends Error {
  readonly name = 'PreviewMetadataError';

  constructor(
    readonly i18nKey: string,
    detail: string,
  ) {
    super(detail);
  }
}
