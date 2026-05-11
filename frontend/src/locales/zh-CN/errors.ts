export default {
  operationFailed: '操作失败',
  operationFailedRetry: '操作失败，请稍后重试',
  networkError: '网络异常，请稍后再试',
  loadSettingsFailed:
    '无法加载设置，请确认已登录；若仍失败，请检查网络或稍后再试',

  previewUrlRequired: '请输入链接地址',
  previewMetadataArray: '无法解析该页面的视频信息，返回数据格式异常',
  previewMetadataInvalid: '无法识别该链接的媒体信息',
  previewMetadataCookieFileMissing:
    '服务器未找到已配置的站点登录凭证文件，请联系管理员检查配置',
  previewMetadataTimeout: '检测超时，请稍后再试',
  previewMetadataTooLarge: '返回数据过大，请尝试其他链接或稍后再试',
  previewMetadataToolFailed: '检测服务暂时不可用，请稍后再试',
  previewMetadataEmpty: '该链接未返回有效内容，请检查链接是否可播放',
  previewMetadataNull:
    '暂无法获取该链接的视频信息。部分站点需在服务器侧配置登录状态后才能检测与下载，请联系管理员处理',
  previewMetadataParseFailed: '解析视频信息失败，请稍后再试',
  previewMetadataFailed: '链接检测失败，请稍后重试',
} as const;
