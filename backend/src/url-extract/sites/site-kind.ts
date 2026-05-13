/** 链接解析前的站点分类，用于派发预检与（将来）按站点的 yt-dlp 策略。 */
export enum UrlExtractSiteKind {
  DOUYIN = 'douyin',
  BILIBILI = 'bilibili',
  YOUTUBE = 'youtube',
  /** 未划入以上站类或其他任意域名：统一走 yt-dlp 通用路径。 */
  GENERIC = 'generic',
}
