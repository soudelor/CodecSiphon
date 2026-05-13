/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  /** 链接解析公开页可选演示视频：mp4/webm 直链，或 YouTube 观看页/短链（构建时注入） */
  readonly VITE_URL_EXTRACT_DEMO_VIDEO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
