/**
 * BFrame Studio 官方网站与下载页面服务（ESA Edge Routine）。
 *
 * 纯逻辑与单文件极速响应，不引入外部 CDN 依赖；
 * 支持动态读取 EdgeKV 发版元数据，自动展示当前全平台最新版本、安装包体积与下载地址；
 * 若 KV 暂无发版记录，平滑回退至官方 GitHub Releases。
 */
import { CLIENT_UPDATE_PLATFORMS, releaseKeyFor } from "./release-core.mjs";

export const SITE_PATHS = new Set(["/", "/index.html", "/download", "/downloads"]);
export const FAVICON_PATH = "/favicon.ico";
export const ROBOTS_PATH = "/robots.txt";

const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "public, max-age=60, s-maxage=300",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin"
};

const SVG_HEADERS = {
  "Content-Type": "image/svg+xml; charset=utf-8",
  "Cache-Control": "public, max-age=86400, s-maxage=604800"
};

const TEXT_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "public, max-age=86400, s-maxage=604800"
};

/** 规范化路径 */
export function normalizePath(pathname) {
  if (typeof pathname !== "string") return "/";
  const trimmed = pathname.trim().replace(/\/+$/, "");
  return trimmed || "/";
}

/** 判定是否属于官网站点路由 */
export function isSiteRoute(pathname) {
  const normalized = normalizePath(pathname);
  return (
    SITE_PATHS.has(normalized) ||
    normalized === FAVICON_PATH ||
    normalized === ROBOTS_PATH
  );
}

/** 格式化文件字节大小 */
export function formatBytes(bytes) {
  if (typeof bytes !== "number" || bytes <= 0 || !Number.isFinite(bytes)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

const DEFAULT_REPO = "lscho/BvStudio";
const FALLBACK_VERSION = "0.3.0";

/**
 * 与仓库根 `package.json` 的 `name` 保持一致：CI 用它作为产物路径里的应用名子目录，
 * 下载域名可同时托管多个应用，靠这一层隔离。
 */
const APP_SLUG = "bframe-studio";

/**
 * 回退下载基址，须与 CI 的 `RELEASE_ASSET_BASE_URL` 保持一致（自建对象存储 + CDN）。
 * 路径层级为 `{域名}/{应用名}/releases/v{版本}`。
 * 只在 EdgeKV 尚无发版记录时用于展示，正常路径一律读 KV 里的真实地址。
 */
const FALLBACK_ASSET_BASE_URL = `https://download.atmomo.cn/${APP_SLUG}/releases/v${FALLBACK_VERSION}`;

/** 默认下载元数据（KV 无记录时的平滑回退） */
export const FALLBACK_RELEASES = {
  "macos-arm": {
    platform: "macos-arm",
    name: "macOS (Apple Silicon)",
    arch: "arm64",
    os: "macOS",
    version: FALLBACK_VERSION,
    fileName: `BFrame_Studio_${FALLBACK_VERSION}_aarch64.dmg`,
    fileSize: 45 * 1024 * 1024,
    url: `${FALLBACK_ASSET_BASE_URL}/BFrame%20Studio_${FALLBACK_VERSION}_aarch64.dmg`,
    updaterUrl: `${FALLBACK_ASSET_BASE_URL}/BFrame%20Studio_${FALLBACK_VERSION}_aarch64_arm64.app.tar.gz`,
    pub_date: "2026-02-01T00:00:00Z",
    notes: "AI 视频动效编排全新发布，支持两阶段智能选型与电影级运镜库"
  },
  "macos-x86": {
    platform: "macos-x86",
    name: "macOS (Intel)",
    arch: "x86_64",
    os: "macOS",
    version: FALLBACK_VERSION,
    fileName: `BFrame_Studio_${FALLBACK_VERSION}_x64.dmg`,
    fileSize: 48 * 1024 * 1024,
    url: `${FALLBACK_ASSET_BASE_URL}/BFrame%20Studio_${FALLBACK_VERSION}_x64.dmg`,
    updaterUrl: `${FALLBACK_ASSET_BASE_URL}/BFrame%20Studio_${FALLBACK_VERSION}_x64_x64.app.tar.gz`,
    pub_date: "2026-02-01T00:00:00Z",
    notes: "适配 macOS Intel 架构"
  },
  "windows-x86": {
    platform: "windows-x86",
    name: "Windows 64 位",
    arch: "x86_64",
    os: "Windows",
    version: FALLBACK_VERSION,
    fileName: `BFrame_Studio_${FALLBACK_VERSION}_x64-setup.exe`,
    fileSize: 52 * 1024 * 1024,
    url: `${FALLBACK_ASSET_BASE_URL}/BFrame%20Studio_${FALLBACK_VERSION}_x64-setup.exe`,
    updaterUrl: `${FALLBACK_ASSET_BASE_URL}/BFrame%20Studio_${FALLBACK_VERSION}_x64-setup.exe`,
    pub_date: "2026-02-01T00:00:00Z",
    notes: "Windows 10/11 64 位安装程序"
  },
  "windows-arm": {
    platform: "windows-arm",
    name: "Windows ARM64",
    arch: "arm64",
    os: "Windows",
    version: FALLBACK_VERSION,
    fileName: `BFrame_Studio_${FALLBACK_VERSION}_arm64-setup.exe`,
    fileSize: 49 * 1024 * 1024,
    url: `${FALLBACK_ASSET_BASE_URL}/BFrame%20Studio_${FALLBACK_VERSION}_arm64-setup.exe`,
    updaterUrl: `${FALLBACK_ASSET_BASE_URL}/BFrame%20Studio_${FALLBACK_VERSION}_arm64-setup.exe`,
    pub_date: "2026-02-01T00:00:00Z",
    notes: "Windows ARM64 原生架构（Surface Pro / 骁龙 X 系列）"
  },
  "linux-x86": {
    platform: "linux-x86",
    name: "Linux (x64)",
    arch: "x86_64",
    os: "Linux",
    version: FALLBACK_VERSION,
    fileName: `BFrame_Studio_${FALLBACK_VERSION}_amd64.AppImage`,
    fileSize: 68 * 1024 * 1024,
    url: `${FALLBACK_ASSET_BASE_URL}/BFrame%20Studio_${FALLBACK_VERSION}_amd64.AppImage`,
    updaterUrl: `${FALLBACK_ASSET_BASE_URL}/BFrame%20Studio_${FALLBACK_VERSION}_amd64.AppImage.tar.gz`,
    pub_date: "2026-02-01T00:00:00Z",
    notes: "Linux AppImage 即开即用包"
  }
};

/** 从 EdgeKV 批量加载最新发版元数据 */
export async function getLatestReleases(kv) {
  const result = structuredClone(FALLBACK_RELEASES);
  if (!kv || typeof kv.get !== "function") return result;

  for (const platform of CLIENT_UPDATE_PLATFORMS) {
    try {
      const record = await kv.get(releaseKeyFor(platform));
      if (record && typeof record === "object" && record.version && record.url) {
        const fallback = result[platform] || {};
        // 下载页展示的是安装包；更新包地址单独保留给「下载 .app.tar.gz」次链接。
        // 旧记录没有 installerUrl，此时退回更新包地址以保持兼容。
        const installerUrl =
          typeof record.installerUrl === "string" && record.installerUrl ? record.installerUrl : record.url;
        const installerFileSize =
          typeof record.installerFileSize === "number" ? record.installerFileSize : record.fileSize;
        result[platform] = {
          ...fallback,
          platform,
          version: String(record.version).replace(/^v/, ""),
          url: installerUrl,
          updaterUrl: record.url,
          fileName: record.installerFileName || record.fileName || fallback.fileName,
          fileSize: typeof installerFileSize === "number" ? installerFileSize : fallback.fileSize,
          pub_date: record.pub_date || fallback.pub_date,
          notes: record.notes || fallback.notes,
          repository: record.repository || DEFAULT_REPO
        };
      }
    } catch {
      // 容错：单个平台读取失败不影响其它平台及整体页面呈现
    }
  }

  return result;
}

/** 站点 Favicon SVG */
export const SITE_FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <defs>
    <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="50%" stop-color="#8b5cf6" />
      <stop offset="100%" stop-color="#06b6d4" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <rect width="64" height="64" rx="16" fill="#0c0e14" />
  <rect x="1" y="1" width="62" height="62" rx="15" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />
  <path d="M18 16 H36 C42.6 16 48 21.4 48 28 C48 32.2 45.8 35.8 42.5 37.8 C46.8 40.2 49.5 44.8 49.5 50 C49.5 57.2 43.7 63 36.5 63 H18 Z" fill="url(#g1)" filter="url(#glow)" transform="scale(0.7) translate(14, 10)" />
  <path d="M26 23 H35 C38.3 23 41 25.7 41 29 C41 32.3 38.3 35 35 35 H26 Z M26 41 H36 C39.3 41 42 43.7 42 47 C42 50.3 39.3 53 36 53 H26 Z" fill="#0c0e14" transform="scale(0.7) translate(14, 10)" />
</svg>`;

/** Robots.txt */
export const SITE_ROBOTS_TXT = `User-agent: *
Allow: /
Disallow: /api/
Sitemap: https://bframe.studio/sitemap.xml
`;

/** 生成官网 HTML 页面 */
export function renderLandingPageHtml({ releases = FALLBACK_RELEASES } = {}) {
  const macArm = releases["macos-arm"] || FALLBACK_RELEASES["macos-arm"];
  const winX86 = releases["windows-x86"] || FALLBACK_RELEASES["windows-x86"];
  const latestVersion = macArm.version || winX86.version || FALLBACK_VERSION;
  const releasesJson = JSON.stringify(releases).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BFrame Studio - AI 视频动效编排客户端 | 让想法精准落到时间线</title>
  <meta name="description" content="BFrame Studio 是一款面向创作者的现代化桌面 AI 视频动效客户端。集成 AI 智能文案、AI 语音字幕识别、语义匹配动效、电影级场景运镜与多轨音效卡点，全流程统一在专业时间线上，支持无损 4K 60fps 极速渲染与本地隐私保护。">
  <meta name="keywords" content="BFrame Studio, AI视频制作, 动效编排, 视频动效, 智能字幕, 场景运镜, 音效编排, FFmpeg 渲染, 桌面客户端">
  <link rel="icon" type="image/svg+xml" href="/favicon.ico">
  <style>
    :root {
      --bg-black: #08090d;
      --bg-darker: #0d0f15;
      --bg-card: #131720;
      --bg-card-hover: #1a1f2c;
      --border-subtle: rgba(255, 255, 255, 0.08);
      --border-bright: rgba(255, 255, 255, 0.18);
      --border-accent: rgba(59, 130, 246, 0.4);
      --text-white: #f3f4f6;
      --text-dim: #9ca3af;
      --text-muted: #6b7280;
      --blue: #3b82f6;
      --cyan: #06b6d4;
      --purple: #a855f7;
      --green: #10b981;
      --amber: #f59e0b;
      --glow-blue: rgba(59, 130, 246, 0.25);
      --glow-purple: rgba(168, 85, 247, 0.22);
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      background-color: var(--bg-black);
      color: var(--text-white);
      font-family: var(--font-sans);
      line-height: 1.6;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
    }

    /* 顶部导航 */
    .nav {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 32px;
      background: rgba(8, 9, 13, 0.85);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border-subtle);
      z-index: 1000;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: var(--text-white);
    }
    .brand-logo {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--blue), var(--purple));
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 16px var(--glow-blue);
    }
    .brand-logo svg { width: 20px; height: 20px; }
    .brand-name { font-weight: 700; font-size: 18px; letter-spacing: -0.5px; }
    .badge-tag {
      font-size: 11px;
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.35);
      padding: 2px 8px;
      border-radius: 9999px;
      font-weight: 600;
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 28px;
      list-style: none;
    }
    .nav-link {
      color: var(--text-dim);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: color 0.15s;
    }
    .nav-link:hover { color: var(--text-white); }
    .nav-actions {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .btn-ghost {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: transparent;
      border: 1px solid var(--border-subtle);
      color: var(--text-dim);
      padding: 7px 14px;
      border-radius: 6px;
      font-size: 13px;
      text-decoration: none;
      transition: all 0.15s;
    }
    .btn-ghost:hover {
      color: var(--text-white);
      border-color: var(--border-bright);
      background: rgba(255,255,255,0.04);
    }
    .btn-nav-download {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, #2563eb, #3b82f6);
      color: #fff;
      padding: 7px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      box-shadow: 0 0 12px var(--glow-blue);
      transition: all 0.15s;
      border: 1px solid rgba(255,255,255,0.2);
    }
    .btn-nav-download:hover {
      background: linear-gradient(135deg, #1d4ed8, #2563eb);
      transform: translateY(-1px);
    }

    /* 背景网格与光晕 */
    .bg-glow-container {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 900px;
      overflow: hidden;
      pointer-events: none;
      z-index: 0;
    }
    .glow-orb-1 {
      position: absolute;
      top: -100px;
      left: 50%;
      transform: translateX(-50%);
      width: 800px;
      height: 500px;
      background: radial-gradient(ellipse at center, rgba(59, 130, 246, 0.22) 0%, rgba(168, 85, 247, 0.12) 45%, transparent 70%);
      filter: blur(60px);
    }
    .glow-orb-2 {
      position: absolute;
      top: 250px;
      left: 20%;
      width: 400px;
      height: 300px;
      background: radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, transparent 60%);
      filter: blur(50px);
    }
    .grid-lines {
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 40px 40px;
      mask-image: radial-gradient(ellipse 70% 70% at 50% 30%, #000 20%, transparent 85%);
      -webkit-mask-image: radial-gradient(ellipse 70% 70% at 50% 30%, #000 20%, transparent 85%);
    }

    /* 主视觉 Hero */
    .hero {
      position: relative;
      padding: 140px 24px 80px;
      text-align: center;
      max-width: 1200px;
      margin: 0 auto;
      z-index: 1;
    }
    .hero-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(168, 85, 247, 0.1);
      border: 1px solid rgba(168, 85, 247, 0.3);
      padding: 4px 14px;
      border-radius: 9999px;
      font-size: 12px;
      color: #c084fc;
      font-weight: 500;
      margin-bottom: 24px;
      box-shadow: 0 0 16px rgba(168, 85, 247, 0.15);
    }
    .hero-title {
      font-size: clamp(38px, 6vw, 64px);
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -1.2px;
      margin-bottom: 20px;
      background: linear-gradient(180deg, #ffffff 40%, #cbd5e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero-title-highlight {
      background: linear-gradient(135deg, #60a5fa 10%, #a855f7 70%, #38bdf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero-desc {
      font-size: clamp(16px, 2vw, 19px);
      color: var(--text-dim);
      max-width: 780px;
      margin: 0 auto 36px;
      line-height: 1.7;
    }

    /* 下载主 CTA 交互组 */
    .hero-cta-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      margin-bottom: 48px;
    }
    .cta-actions {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .btn-main-download {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 12px;
      background: linear-gradient(135deg, #2563eb, #3b82f6);
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      padding: 14px 28px;
      border-radius: 8px;
      text-decoration: none;
      box-shadow: 0 4px 24px var(--glow-blue), inset 0 1px 0 rgba(255,255,255,0.25);
      border: 1px solid rgba(255,255,255,0.2);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .btn-main-download:hover {
      background: linear-gradient(135deg, #1d4ed8, #2563eb);
      transform: translateY(-2px);
      box-shadow: 0 6px 30px rgba(59, 130, 246, 0.45);
    }
    .btn-main-download svg { width: 20px; height: 20px; }
    .btn-all-platforms {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--border-subtle);
      color: var(--text-white);
      font-size: 15px;
      font-weight: 500;
      padding: 14px 22px;
      border-radius: 8px;
      text-decoration: none;
      transition: all 0.15s;
    }
    .btn-all-platforms:hover {
      background: rgba(255,255,255,0.08);
      border-color: var(--border-bright);
    }
    .platform-tip {
      font-size: 13px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .platform-tip-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--green);
      box-shadow: 0 0 8px var(--green);
      display: inline-block;
    }

    /* 仿真实客户端 Studio 科技工作台 */
    .studio-preview-box {
      margin: 20px auto 100px;
      max-width: 1120px;
      background: var(--bg-darker);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(59, 130, 246, 0.1);
      position: relative;
    }
    .studio-topbar {
      height: 38px;
      background: #11141c;
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
    }
    .traffic-lights {
      display: flex;
      align-items: center;
      gap: 7px;
    }
    .light { width: 10px; height: 10px; border-radius: 50%; }
    .light-red { background: #ef4444; }
    .light-yellow { background: #f59e0b; }
    .light-green { background: #10b981; }
    .studio-title {
      font-size: 12px;
      color: var(--text-dim);
      font-family: var(--font-mono);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .studio-tag {
      background: rgba(59, 130, 246, 0.2);
      color: #60a5fa;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 10px;
    }
    .studio-body {
      display: grid;
      grid-template-columns: 240px 1fr 220px;
      height: 340px;
      background: #090a0f;
    }
    .studio-left-panel {
      border-right: 1px solid var(--border-subtle);
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #0d0f17;
      text-align: left;
    }
    .panel-heading {
      font-size: 11px;
      text-transform: uppercase;
      color: var(--text-muted);
      letter-spacing: 0.5px;
      font-weight: 700;
    }
    .effect-item {
      background: rgba(255,255,255,0.03);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      padding: 8px 10px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .effect-item.active, .effect-item:hover {
      background: rgba(59,130,246,0.12);
      border-color: rgba(59,130,246,0.4);
      color: #93c5fd;
    }
    .effect-icon {
      width: 18px;
      height: 18px;
      border-radius: 4px;
      background: rgba(168, 85, 247, 0.2);
      color: #c084fc;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
    }
    .studio-center-canvas {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      position: relative;
      background: #07080b;
    }
    .canvas-viewport {
      width: 90%;
      height: 85%;
      border: 1px dashed rgba(255,255,255,0.15);
      border-radius: 8px;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle, rgba(26,32,46,0.6) 0%, rgba(10,12,18,0.9) 100%);
      overflow: hidden;
    }
    .canvas-scanline {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, #38bdf8, transparent);
      animation: scanAnimation 3.5s infinite linear;
      box-shadow: 0 0 10px #38bdf8;
    }
    @keyframes scanAnimation {
      0% { top: 0; opacity: 0; }
      10% { opacity: 1; }
      90% { opacity: 1; }
      100% { top: 100%; opacity: 0; }
    }
    .motion-hero-card {
      background: rgba(19, 23, 34, 0.9);
      border: 1px solid rgba(59, 130, 246, 0.4);
      border-radius: 8px;
      padding: 16px 24px;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(59,130,246,0.2);
      transform: translateY(0);
      transition: transform 0.3s ease;
    }
    .motion-title {
      font-size: 18px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 4px;
    }
    .motion-pill-tag {
      display: inline-block;
      background: rgba(168, 85, 247, 0.25);
      color: #d8b4fe;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 600;
    }
    .studio-right-panel {
      border-left: 1px solid var(--border-subtle);
      padding: 14px;
      background: #0d0f17;
      text-align: left;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .inspector-prop {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: var(--text-dim);
      padding: 4px 0;
      border-bottom: 1px solid rgba(255,255,255,0.04);
    }
    .inspector-val { color: #60a5fa; font-family: var(--font-mono); }

    /* 仿多轨时间线 */
    .studio-timeline {
      border-top: 1px solid var(--border-subtle);
      background: #0a0c12;
      padding: 10px 16px;
      text-align: left;
    }
    .timeline-ruler {
      height: 20px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10px;
      color: var(--text-muted);
      font-family: var(--font-mono);
      margin-bottom: 8px;
      padding: 0 70px;
    }
    .timeline-track-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
    }
    .track-label {
      width: 60px;
      font-size: 10px;
      color: var(--text-muted);
      font-weight: 600;
      text-align: right;
    }
    .track-content {
      flex: 1;
      height: 20px;
      background: rgba(255,255,255,0.03);
      border-radius: 4px;
      position: relative;
      overflow: hidden;
    }
    .track-clip {
      position: absolute;
      top: 2px;
      bottom: 2px;
      border-radius: 3px;
      font-size: 9px;
      display: flex;
      align-items: center;
      padding: 0 8px;
      font-weight: 600;
      color: #fff;
    }
    .clip-video { left: 5%; width: 65%; background: rgba(59, 130, 246, 0.45); border: 1px solid rgba(59,130,246,0.6); }
    .clip-motion { left: 20%; width: 35%; background: rgba(168, 85, 247, 0.5); border: 1px solid rgba(168,85,247,0.7); }
    .clip-subtitle { left: 10%; width: 50%; background: rgba(16, 185, 129, 0.4); border: 1px solid rgba(16,185,129,0.6); }
    .clip-audio { left: 15%; width: 45%; background: rgba(245, 158, 11, 0.4); border: 1px solid rgba(245,158,11,0.6); }

    /* 工作流交互 Tab */
    .timeline-tabs {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    .tab-btn {
      background: rgba(255,255,255,0.04);
      border: 1px solid var(--border-subtle);
      color: var(--text-dim);
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .tab-btn.active, .tab-btn:hover {
      background: rgba(59,130,246,0.2);
      border-color: rgba(59,130,246,0.4);
      color: #93c5fd;
    }

    /* 核心功能特性矩阵 */
    .section {
      padding: 100px 24px;
      max-width: 1200px;
      margin: 0 auto;
      text-align: center;
    }
    .section-header {
      margin-bottom: 60px;
    }
    .section-badge {
      font-size: 12px;
      text-transform: uppercase;
      color: var(--cyan);
      font-weight: 700;
      letter-spacing: 1px;
      margin-bottom: 12px;
      display: inline-block;
    }
    .section-title {
      font-size: clamp(28px, 4vw, 44px);
      font-weight: 800;
      letter-spacing: -0.8px;
      margin-bottom: 16px;
      color: var(--text-white);
    }
    .section-desc {
      font-size: 17px;
      color: var(--text-dim);
      max-width: 680px;
      margin: 0 auto;
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 24px;
      text-align: left;
    }
    .feature-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      padding: 32px;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
      overflow: hidden;
    }
    .feature-card::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: transparent;
      transition: background 0.2s;
    }
    .feature-card:hover {
      background: var(--bg-card-hover);
      border-color: var(--border-accent);
      transform: translateY(-3px);
      box-shadow: 0 12px 36px rgba(0,0,0,0.4), 0 0 24px rgba(59,130,246,0.12);
    }
    .feature-card:hover::before {
      background: linear-gradient(90deg, var(--blue), var(--purple));
    }
    .feature-icon-box {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: rgba(59, 130, 246, 0.12);
      border: 1px solid rgba(59, 130, 246, 0.25);
      color: #60a5fa;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
    }
    .icon-purple { background: rgba(168, 85, 247, 0.12); border-color: rgba(168, 85, 247, 0.25); color: #c084fc; }
    .icon-cyan { background: rgba(6, 182, 212, 0.12); border-color: rgba(6, 182, 212, 0.25); color: #22d3ee; }
    .icon-green { background: rgba(16, 185, 129, 0.12); border-color: rgba(16, 185, 129, 0.25); color: #34d399; }
    .icon-amber { background: rgba(245, 158, 11, 0.12); border-color: rgba(245, 158, 11, 0.25); color: #fbbf24; }

    .feature-title {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 12px;
      color: var(--text-white);
    }
    .feature-desc {
      font-size: 14px;
      color: var(--text-dim);
      line-height: 1.7;
      margin-bottom: 18px;
    }
    .feature-points {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 13px;
      color: var(--text-dim);
    }
    .feature-point {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .feature-point svg { width: 14px; height: 14px; color: var(--green); flex-shrink: 0; }

    /* 工作流 Pipeline 架构展示 */
    .pipeline-container {
      background: var(--bg-darker);
      border: 1px solid var(--border-subtle);
      border-radius: 16px;
      padding: 48px 32px;
      margin-top: 40px;
    }
    .pipeline-steps {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px;
      position: relative;
    }
    .step-card {
      background: rgba(255,255,255,0.02);
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      padding: 24px;
      text-align: left;
    }
    .step-number {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--cyan);
      font-weight: 700;
      margin-bottom: 8px;
    }
    .step-title {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 8px;
      color: var(--text-white);
    }
    .step-desc {
      font-size: 13px;
      color: var(--text-dim);
      line-height: 1.6;
    }

    /* 全平台下载中心 */
    #download {
      scroll-margin-top: 80px;
    }
    .download-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      text-align: left;
      margin-top: 40px;
    }
    .download-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: all 0.2s;
      position: relative;
    }
    .download-card.highlight {
      border-color: var(--blue);
      box-shadow: 0 0 28px rgba(59, 130, 246, 0.25);
      background: linear-gradient(180deg, rgba(59,130,246,0.08) 0%, var(--bg-card) 60%);
    }
    .download-card.highlight::after {
      content: "推荐此设备";
      position: absolute;
      top: -10px;
      right: 18px;
      background: var(--blue);
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 9999px;
      letter-spacing: 0.5px;
    }
    .dl-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .dl-os-icon {
      width: 38px;
      height: 38px;
      border-radius: 8px;
      background: rgba(255,255,255,0.06);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-white);
    }
    .dl-os-title { font-size: 17px; font-weight: 700; }
    .dl-arch-badge {
      font-size: 11px;
      background: rgba(255,255,255,0.08);
      color: var(--text-dim);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: var(--font-mono);
    }
    .dl-meta {
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 20px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .dl-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: rgba(255,255,255,0.08);
      color: var(--text-white);
      border: 1px solid var(--border-bright);
      padding: 10px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.15s;
    }
    .download-card.highlight .dl-btn {
      background: linear-gradient(135deg, #2563eb, #3b82f6);
      border-color: rgba(255,255,255,0.2);
      box-shadow: 0 0 16px var(--glow-blue);
    }
    .dl-btn:hover {
      background: var(--blue);
      border-color: transparent;
      color: #fff;
    }
    .dl-secondary-link {
      font-size: 11px;
      color: var(--text-muted);
      text-align: center;
      margin-top: 8px;
      text-decoration: none;
    }
    .dl-secondary-link:hover { color: var(--text-dim); text-decoration: underline; }

    /* 隐私与安全横幅 */
    .security-banner {
      background: rgba(16, 185, 129, 0.05);
      border: 1px solid rgba(16, 185, 129, 0.2);
      border-radius: 12px;
      padding: 24px 32px;
      margin: 48px auto 0;
      max-width: 960px;
      display: flex;
      align-items: center;
      gap: 20px;
      text-align: left;
    }
    .sec-icon {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: rgba(16, 185, 129, 0.15);
      color: var(--green);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .sec-title { font-size: 15px; font-weight: 700; color: #6ee7b7; margin-bottom: 4px; }
    .sec-desc { font-size: 13px; color: var(--text-dim); line-height: 1.6; }

    /* 常见问题 FAQ */
    .faq-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 20px;
      text-align: left;
      margin-top: 40px;
    }
    .faq-item {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      padding: 24px;
    }
    .faq-q {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 8px;
      color: var(--text-white);
    }
    .faq-a {
      font-size: 13px;
      color: var(--text-dim);
      line-height: 1.7;
    }

    /* 页脚 */
    .footer {
      border-top: 1px solid var(--border-subtle);
      padding: 48px 24px;
      text-align: center;
      background: #050608;
      font-size: 13px;
      color: var(--text-muted);
    }
    .footer-links {
      display: flex;
      justify-content: center;
      gap: 24px;
      margin-bottom: 16px;
      list-style: none;
    }
    .footer-link { color: var(--text-dim); text-decoration: none; }
    .footer-link:hover { color: var(--text-white); }

    /* 响应式调整 */
    @media (max-width: 860px) {
      .nav-links { display: none; }
      .studio-body { grid-template-columns: 1fr; height: auto; }
      .studio-left-panel, .studio-right-panel { display: none; }
      .studio-center-canvas { height: 260px; }
      .timeline-track-row { font-size: 9px; }
      .security-banner { flex-direction: column; text-align: center; }
    }
  </style>
</head>
<body>
  <!-- 背景科技光晕 -->
  <div class="bg-glow-container">
    <div class="glow-orb-1"></div>
    <div class="glow-orb-2"></div>
    <div class="grid-lines"></div>
  </div>

  <!-- 顶部导航 -->
  <header class="nav">
    <a href="/" class="brand">
      <div class="brand-logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      </div>
      <span class="brand-name">BFrame Studio</span>
      <span class="badge-tag">v${latestVersion}</span>
    </a>

    <ul class="nav-links">
      <li><a href="#features" class="nav-link">功能特性</a></li>
      <li><a href="#pipeline" class="nav-link">AI 编排流</a></li>
      <li><a href="#download" class="nav-link">下载客户端</a></li>
      <li><a href="#faq" class="nav-link">常见问题</a></li>
    </ul>

    <div class="nav-actions">
      <a href="#download" class="btn-nav-download">
        立即下载
      </a>
    </div>
  </header>

  <!-- 主视觉 Hero -->
  <main>
    <section class="hero">
      <div class="hero-pill">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
        </svg>
        全新发布 · 专业级 AI 视频动效编排客户端
      </div>

      <h1 class="hero-title">
        每个想法，都精确落到<span class="hero-title-highlight">时间线</span>
      </h1>

      <p class="hero-desc">
        告别割裂的 AI 玩具与繁重的剪辑工程。从 <strong>AI 智能文案生成</strong>、<strong>语音识别字幕</strong>，到 <strong>语义匹配动效</strong>、<strong>分镜镜头编排</strong> 与 <strong>多轨动作音效</strong>，在同一条专业可控的时间线上实现端到端工业级生产。
      </p>

      <div class="hero-cta-group">
        <div class="cta-actions">
          <a id="hero-smart-download-btn" href="#download" class="btn-main-download">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span id="hero-smart-download-text">下载 macOS 版 (Apple Silicon)</span>
          </a>
          <a href="#features" class="btn-all-platforms">
            探索核心特性
          </a>
        </div>
        <div class="platform-tip">
          <span class="platform-tip-dot"></span>
          <span>原生支持 macOS (Apple Silicon & Intel) · Windows 10/11 · Linux</span>
        </div>
      </div>

      <!-- 仿真客户端 Studio 预览 -->
      <div id="showcase" class="studio-preview-box">
        <div class="studio-topbar">
          <div class="traffic-lights">
            <div class="light light-red"></div>
            <div class="light light-yellow"></div>
            <div class="light light-green"></div>
          </div>
          <div class="studio-title">
            <span>demo_ai_showcase.bve</span>
            <span class="studio-tag">4K · 60FPS</span>
            <span class="studio-tag" style="background: rgba(168, 85, 247, 0.2); color: #c084fc;">AI 编排已同步</span>
          </div>
          <div style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">00:12.450 / 00:30.000</div>
        </div>

        <div class="studio-body">
          <!-- 左侧动效库 -->
          <div class="studio-left-panel">
            <div class="panel-heading">Overlay 动效库 (102+)</div>
            <div class="effect-item active">
              <div class="effect-icon">✦</div>
              <div>人物聚焦发光卡</div>
            </div>
            <div class="effect-item">
              <div class="effect-icon">↗</div>
              <div>折线对比动效</div>
            </div>
            <div class="effect-item">
              <div class="effect-icon">⚡</div>
              <div>快节奏粒子转场</div>
            </div>
            <div class="panel-heading" style="margin-top: 8px;">场景运镜库 (157+)</div>
            <div class="effect-item">
              <div class="effect-icon">🎥</div>
              <div>推近慢摇特写</div>
            </div>
          </div>

          <!-- 中央画布 -->
          <div class="studio-center-canvas">
            <div class="canvas-viewport">
              <div class="canvas-scanline"></div>
              <div class="motion-hero-card">
                <div class="motion-pill-tag">AI 语义匹配 · 重点强调</div>
                <div class="motion-title">让想法落到时间线</div>
                <div style="font-size: 12px; color: var(--text-dim); margin-top: 4px;">音效: Impact_Slam_02.wav (已卡点)</div>
              </div>
            </div>
          </div>

          <!-- 右侧检查器 -->
          <div class="studio-right-panel">
            <div class="panel-heading">属性检查器 (Inspector)</div>
            <div class="inspector-prop"><span>动效类型</span><span class="inspector-val">FocusGlow</span></div>
            <div class="inspector-prop"><span>对齐模式</span><span class="inspector-val">Center</span></div>
            <div class="inspector-prop"><span>进场缓动</span><span class="inspector-val">cubic-bezier(0.16,1,0.3,1)</span></div>
            <div class="inspector-prop"><span>音画同步</span><span class="inspector-val">0.000s 绝对零漂移</span></div>
            <div class="inspector-prop"><span>硬件加速</span><span class="inspector-val">Apple Silicon GPU</span></div>
          </div>
        </div>

        <!-- 底部多轨时间线 -->
        <div class="studio-timeline">
          <div class="timeline-ruler">
            <span>00:00</span><span>00:05</span><span>00:10</span><span>00:15</span><span>00:20</span><span>00:25</span><span>00:30</span>
          </div>

          <div class="timeline-track-row">
            <span class="track-label">视频轨</span>
            <div class="track-content">
              <div class="track-clip clip-video">原视频切片_01.mp4</div>
            </div>
          </div>
          <div class="timeline-track-row">
            <span class="track-label">动效轨</span>
            <div class="track-content">
              <div class="track-clip clip-motion">Overlay: 人物聚焦卡 (AI选型)</div>
            </div>
          </div>
          <div class="timeline-track-row">
            <span class="track-label">字幕轨</span>
            <div class="track-content">
              <div class="track-clip clip-subtitle">ASR 毫秒字幕: "每个想法，都落到时间线"</div>
            </div>
          </div>
          <div class="timeline-track-row">
            <span class="track-label">配音/音效</span>
            <div class="track-content">
              <div class="track-clip clip-audio">AI 智能配音 + 动作音效 (自动对齐)</div>
            </div>
          </div>

          <div class="timeline-tabs">
            <button class="tab-btn active" onclick="switchTimelineTab(0, this)">AI 智能文案</button>
            <button class="tab-btn" onclick="switchTimelineTab(1, this)">AI 字幕识别</button>
            <button class="tab-btn" onclick="switchTimelineTab(2, this)">语义匹配动效</button>
            <button class="tab-btn" onclick="switchTimelineTab(3, this)">场景运镜编排</button>
            <button class="tab-btn" onclick="switchTimelineTab(4, this)">动作音效卡点</button>
          </div>
        </div>
      </div>
    </section>

    <!-- 核心功能矩阵 -->
    <section id="features" class="section">
      <div class="section-header">
        <span class="section-badge">Core Capabilities</span>
        <h2 class="section-title">五大 AI 引擎，重塑视频生产全链路</h2>
        <p class="section-desc">从输入灵感到成片导出，打破传统创作工具割裂流程，让 AI 真正服务于精确可控的专业视频交付。</p>
      </div>

      <div class="features-grid">
        <!-- 1. AI 智能文案与台本 -->
        <div class="feature-card">
          <div class="feature-icon-box">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <line x1="10" y1="9" x2="8" y2="9"></line>
            </svg>
          </div>
          <h3 class="feature-title">AI 智能文案与台本</h3>
          <p class="feature-desc">深度大语言模型加持，输入一句话主题或大纲，即可一键生成具备专业起承转合的分镜脚本、爆款口播台本与重点词标注。</p>
          <ul class="feature-points">
            <li class="feature-point">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              一键分段结构化，智能推导视觉节奏
            </li>
            <li class="feature-point">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              支持多提示词模板与创作者自定模型
            </li>
          </ul>
        </div>

        <!-- 2. AI 字幕与精准 ASR -->
        <div class="feature-card">
          <div class="feature-icon-box icon-purple">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"></rect>
              <path d="M7 15h4M13 15h4M7 9h2M11 9h6"></path>
            </svg>
          </div>
          <h3 class="feature-title">AI 字幕与精准 ASR</h3>
          <p class="feature-desc">音视频秒级无损提取，云端高精度 ASR 语音识别。毫秒级时间戳严格锚定，将时间字幕作为整条时间线的核心语义驱动源。</p>
          <ul class="feature-points">
            <li class="feature-point">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              时间字幕唯一真实源，文字画面分秒不差
            </li>
            <li class="feature-point">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              多样式花字、智能分词与断句语义自愈
            </li>
          </ul>
        </div>

        <!-- 3. AI 语义匹配动效 -->
        <div class="feature-card">
          <div class="feature-icon-box icon-cyan">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
          </div>
          <h3 class="feature-title">AI 语义匹配动效</h3>
          <p class="feature-desc">首创两阶段选型：AI 理解口播文意与情绪重音，自动从 102+ Overlay Studio 动效体系中选出最优动效卡片并智能落位。</p>
          <ul class="feature-points">
            <li class="feature-point">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              102 个专业动效 + 6 大展示卡 + 4 个独立背景
            </li>
            <li class="feature-point">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              支持一次性一键撤销与精细逐帧参数复写
            </li>
          </ul>
        </div>

        <!-- 4. 智能场景与镜头编排 -->
        <div class="feature-card">
          <div class="feature-icon-box icon-green">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M23 7l-7 5 7 5V7z"></path>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
          </div>
          <h3 class="feature-title">场景与电影级运镜</h3>
          <p class="feature-desc">内建 157 张镜头配方卡与 216 个镜头实现，推拉摇移、景深拉近、画中画布局随内容情绪自适应转换，无需繁复的手动关键帧打点。</p>
          <ul class="feature-points">
            <li class="feature-point">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              168 个镜头支持 AI 自动编排，48 个深度定制
            </li>
            <li class="feature-point">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              原生运镜节点系统，自由扩展自定义镜头
            </li>
          </ul>
        </div>

        <!-- 5. 多轨音效与自然配音 -->
        <div class="feature-card">
          <div class="feature-icon-box icon-amber">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 18V5l12-2v13"></path>
              <circle cx="6" cy="18" r="3"></circle>
              <circle cx="18" cy="16" r="3"></circle>
            </svg>
          </div>
          <h3 class="feature-title">多轨动作音效与配音</h3>
          <p class="feature-desc">云端高拟真 AI 配音，以真实 WAV 时长反向回写动效节奏。动作音效自动识别动效入场冲击点与转场 Whoosh，实现毫秒级自动卡点。</p>
          <ul class="feature-points">
            <li class="feature-point">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              8 大音效分类随心调配，自动规避音量冲突
            </li>
            <li class="feature-point">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              支持单独导出多轨 Stem 音频文件
            </li>
          </ul>
        </div>

        <!-- 6. 原生极速 4K 本地导出 -->
        <div class="feature-card">
          <div class="feature-icon-box">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <h3 class="feature-title">原生 FFmpeg 极速导出</h3>
          <p class="feature-desc">拒绝录屏式伪导出！画布预览与导出共用同一套领域数据渲染树，内置优化的 FFmpeg/FFprobe 原生二进制，硬件加速无损 4K/60fps 直出。</p>
          <ul class="feature-points">
            <li class="feature-point">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              所见即所得，预览与最终成片 100% 像素一致
            </li>
            <li class="feature-point">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              全流程本地离线运算，个人素材零泄露
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- 工作流展示 -->
    <section id="pipeline" class="section" style="padding-top: 20px;">
      <div class="section-header">
        <span class="section-badge">Production Pipeline</span>
        <h2 class="section-title">全链路标准工业化编排流水线</h2>
        <p class="section-desc">无论是已有实拍口播，还是纯 AI 文生视频，都能在统一规范的管线中极速生产。</p>
      </div>

      <div class="pipeline-container">
        <div class="pipeline-steps">
          <div class="step-card">
            <div class="step-number">STEP 01</div>
            <div class="step-title">素材导入 / 文案输入</div>
            <div class="step-desc">导入口播视频或输入 AI 创意主题，模型自动生成剧本分段或提取原始音频。</div>
          </div>
          <div class="step-card">
            <div class="step-number">STEP 02</div>
            <div class="step-title">ASR 字幕与时间锚定</div>
            <div class="step-desc">毫秒级生成时间轴字幕，构建整条成片的内容基准与视觉节拍点。</div>
          </div>
          <div class="step-card">
            <div class="step-number">STEP 03</div>
            <div class="step-title">AI 语义动效与镜头选型</div>
            <div class="step-desc">两阶段算法分析语义重音，自动匹配 100+ 专属动效与电影级运镜配方。</div>
          </div>
          <div class="step-card">
            <div class="step-number">STEP 04</div>
            <div class="step-title">微调预览与 4K 极速交付</div>
            <div class="step-desc">在专业多轨时间线上任意微调，本地 FFmpeg 硬件加速无损输出 4K/60fps。</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 下载中心 -->
    <section id="download" class="section">
      <div class="section-header">
        <span class="section-badge">Cross-Platform Downloads</span>
        <h2 class="section-title">下载 BFrame Studio 桌面版</h2>
        <p class="section-desc">当前最新版本：<strong>v${latestVersion}</strong> · 原生适配主流操作系统与芯片架构，点击即可极速安装。</p>
      </div>

      <div class="download-grid">
        <!-- 1. macOS ARM -->
        <div id="card-macos-arm" class="download-card highlight">
          <div>
            <div class="dl-header">
              <div class="dl-os-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.38c.62-.76 1.04-1.81.93-2.88-.9.04-1.99.6-2.63 1.36-.57.66-.99 1.74-.86 2.78.99.08 2-.51 2.56-1.26z"/></svg>
              </div>
              <div>
                <div class="dl-os-title">macOS Apple Silicon</div>
                <span class="dl-arch-badge">ARM64 · M1/M2/M3/M4</span>
              </div>
            </div>
            <div class="dl-meta">
              <span>文件: ${macArm.fileName || "BFrame_Studio_aarch64.dmg"}</span>
              <span>体积: ${formatBytes(macArm.fileSize) || "约 45 MB"} · 格式: DMG 安装盘</span>
              <span>版本: v${macArm.version || latestVersion}</span>
            </div>
          </div>
          <div>
            <a href="${macArm.url}" class="dl-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              下载 DMG 安装包
            </a>
            ${macArm.updaterUrl ? `<div style="text-align: center;"><a href="${macArm.updaterUrl}" class="dl-secondary-link">下载 .app.tar.gz 压缩包</a></div>` : ""}
          </div>
        </div>

        <!-- 2. macOS Intel -->
        <div id="card-macos-x86" class="download-card">
          <div>
            <div class="dl-header">
              <div class="dl-os-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.38c.62-.76 1.04-1.81.93-2.88-.9.04-1.99.6-2.63 1.36-.57.66-.99 1.74-.86 2.78.99.08 2-.51 2.56-1.26z"/></svg>
              </div>
              <div>
                <div class="dl-os-title">macOS Intel</div>
                <span class="dl-arch-badge">x86_64 处理器</span>
              </div>
            </div>
            <div class="dl-meta">
              <span>文件: ${releases["macos-x86"]?.fileName || "BFrame_Studio_x64.dmg"}</span>
              <span>体积: ${formatBytes(releases["macos-x86"]?.fileSize) || "约 48 MB"} · 格式: DMG 安装盘</span>
              <span>版本: v${releases["macos-x86"]?.version || latestVersion}</span>
            </div>
          </div>
          <div>
            <a href="${releases["macos-x86"]?.url}" class="dl-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              下载 DMG 安装包
            </a>
          </div>
        </div>

        <!-- 3. Windows x64 -->
        <div id="card-windows-x86" class="download-card">
          <div>
            <div class="dl-header">
              <div class="dl-os-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>
              </div>
              <div>
                <div class="dl-os-title">Windows 64 位</div>
                <span class="dl-arch-badge">x64 · Win 10/11</span>
              </div>
            </div>
            <div class="dl-meta">
              <span>文件: ${winX86.fileName || "BFrame_Studio_x64-setup.exe"}</span>
              <span>体积: ${formatBytes(winX86.fileSize) || "约 52 MB"} · 格式: EXE 安装向导</span>
              <span>版本: v${winX86.version || latestVersion}</span>
            </div>
          </div>
          <div>
            <a href="${winX86.url}" class="dl-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              下载 Windows 版
            </a>
          </div>
        </div>

        <!-- 4. Windows ARM64 -->
        <div id="card-windows-arm" class="download-card">
          <div>
            <div class="dl-header">
              <div class="dl-os-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>
              </div>
              <div>
                <div class="dl-os-title">Windows ARM64</div>
                <span class="dl-arch-badge">ARM64 · 骁龙 X / Surface</span>
              </div>
            </div>
            <div class="dl-meta">
              <span>文件: ${releases["windows-arm"]?.fileName || "BFrame_Studio_arm64-setup.exe"}</span>
              <span>体积: ${formatBytes(releases["windows-arm"]?.fileSize) || "约 49 MB"} · 格式: 原生 ARM</span>
              <span>版本: v${releases["windows-arm"]?.version || latestVersion}</span>
            </div>
          </div>
          <div>
            <a href="${releases["windows-arm"]?.url}" class="dl-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              下载 Windows ARM 版
            </a>
          </div>
        </div>

        <!-- 5. Linux x64 -->
        <div id="card-linux-x86" class="download-card">
          <div>
            <div class="dl-header">
              <div class="dl-os-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-2.3 0-4.3 1.2-5.3 3.1-.3.6-.5 1.3-.5 2 0 .4.1.8.2 1.2-1.3.8-2.2 2.2-2.4 3.8-.1.7 0 1.5.2 2.2-.5 1-.8 2.1-.8 3.2 0 3.3 2.7 6 6 6h5.2c3.3 0 6-2.7 6-6 0-1.1-.3-2.2-.8-3.2.2-.7.3-1.5.2-2.2-.2-1.6-1.1-3-2.4-3.8.1-.4.2-.8.2-1.2 0-.7-.2-1.4-.5-2-1-1.9-3-3.1-5.3-3.1z"/></svg>
              </div>
              <div>
                <div class="dl-os-title">Linux (x64)</div>
                <span class="dl-arch-badge">Ubuntu / Debian / Arch</span>
              </div>
            </div>
            <div class="dl-meta">
              <span>文件: ${releases["linux-x86"]?.fileName || "BFrame_Studio_amd64.AppImage"}</span>
              <span>体积: ${formatBytes(releases["linux-x86"]?.fileSize) || "约 68 MB"} · 格式: AppImage</span>
              <span>版本: v${releases["linux-x86"]?.version || latestVersion}</span>
            </div>
          </div>
          <div>
            <a href="${releases["linux-x86"]?.url}" class="dl-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              下载 Linux AppImage
            </a>
          </div>
        </div>
      </div>

      <!-- 隐私与完整性说明 -->
      <div class="security-banner">
        <div class="sec-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
        </div>
        <div>
          <div class="sec-title">100% 隐私安全与完整性校验</div>
          <div class="sec-desc">BFrame Studio 所有工程文件、导入视频素材均保留在您的本地磁盘；发布包附带 SHA-256 校验哈希与数字签名，客户端内置更新自检，保障生产环境安全无虞。</div>
        </div>
      </div>
    </section>

    <!-- 常见问题 FAQ -->
    <section id="faq" class="section">
      <div class="section-header">
        <span class="section-badge">FAQ</span>
        <h2 class="section-title">常见问题解答</h2>
      </div>

      <div class="faq-grid">
        <div class="faq-item">
          <div class="faq-q">1. BFrame Studio 是网页版还是客户端？</div>
          <div class="faq-a">BFrame Studio 是面向专业视频创作者的原生桌面客户端。它充分调用您本地设备的 GPU 硬件加速能力与内置 FFmpeg 处理引擎，保证长视频渲染不卡顿，且素材文件无需上传至公有云。</div>
        </div>
        <div class="faq-item">
          <div class="faq-q">2. 客户端中的 AI 能力是如何工作的？</div>
          <div class="faq-a">客户端提供 AI 智能文案台本生成、云端高拟真配音与 ASR 字幕识别；AI 语义选型算法在毫秒内理解您的脚本重心，自动匹配 Overlay 动效卡片与专业运镜。您可以在本地设置中安全配置个人 API 凭证。</div>
        </div>
        <div class="faq-item">
          <div class="faq-q">3. 自动匹配的动效支持手动修改吗？</div>
          <div class="faq-a">完全支持！AI 匹配的所有内容都会直接生成到多轨时间线上（支持一次性撤销）。您可以自由拖拽时长、替换素材、调整关键帧曲线与文字内容，做到“AI 负责繁琐初稿，人类掌控最终质感”。</div>
        </div>
        <div class="faq-item">
          <div class="faq-q">4. 支持导出哪些格式与分辨率？</div>
          <div class="faq-a">支持导出 4K、2K、1080P 等任意分辨率，帧率可达 60FPS；支持 H.264 / AAC 编码的 MP4 与 MOV 格式，并可选择导出全透明通道图层与多轨独立音频。</div>
        </div>
      </div>
    </section>
  </main>

  <!-- 页脚 -->
  <footer class="footer">
    <ul class="footer-links">
      <li><a href="#features" class="footer-link">功能特性</a></li>
      <li><a href="#pipeline" class="footer-link">AI 编排流</a></li>
      <li><a href="#download" class="footer-link">全平台下载</a></li>
      <li><a href="#faq" class="footer-link">常见问题</a></li>
    </ul>
    <p>© 2026 BFrame Studio. 现代 AI 驱动的高性能视频动效客户端。保留所有权利。</p>
  </footer>

  <!-- 访客设备智能检测与动效卡片交互脚本 -->
  <script>
    const RELEASES = ${releasesJson};

    function detectUserPlatform() {
      const ua = navigator.userAgent.toLowerCase();
      const platform = navigator.platform ? navigator.platform.toLowerCase() : "";

      if (ua.includes("mac") || platform.includes("mac")) {
        // 尝试检测 Apple Silicon
        return "macos-arm";
      } else if (ua.includes("win") || platform.includes("win")) {
        if (ua.includes("arm")) return "windows-arm";
        return "windows-x86";
      } else if (ua.includes("linux") || platform.includes("linux")) {
        return "linux-x86";
      }
      return "macos-arm";
    }

    function applySmartDownloadHighlight() {
      const targetPlatform = detectUserPlatform();
      const target = RELEASES[targetPlatform] || RELEASES["macos-arm"];
      
      const smartBtn = document.getElementById("hero-smart-download-btn");
      const smartText = document.getElementById("hero-smart-download-text");
      
      if (smartBtn && smartText && target) {
        smartBtn.href = target.url || "#download";
        smartText.textContent = "下载 " + target.name + " (v" + target.version + ")";
      }

      // 高亮对应卡片
      document.querySelectorAll(".download-card").forEach(function(card) {
        card.classList.remove("highlight");
      });
      const cardId = "card-" + targetPlatform;
      const targetCard = document.getElementById(cardId);
      if (targetCard) {
        targetCard.classList.add("highlight");
      }
    }

    function switchTimelineTab(index, btn) {
      document.querySelectorAll(".tab-btn").forEach(function(b) { b.classList.remove("active"); });
      btn.classList.add("active");
      
      const titleEl = document.querySelector(".motion-title");
      const tagEl = document.querySelector(".motion-pill-tag");
      const sfxEl = document.querySelector(".motion-hero-card div:last-child");
      
      const tabData = [
        { tag: "AI 智能文案 · 台本生成", title: "灵感直达分镜脚本", sfx: "语义分段已自动生成" },
        { tag: "ASR 识别 · 毫秒基准", title: "文字画面分秒对齐", sfx: "时间字幕作为全局基准" },
        { tag: "AI 语义匹配 · 102+ 动效", title: "让想法落到时间线", sfx: "音效: Impact_Slam_02.wav (已卡点)" },
        { tag: "电影级运镜 · 场景编排", title: "电影级推拉摇移", sfx: "运镜节点: 慢速推近特写" },
        { tag: "动作音效 · 毫秒卡点", title: "澎湃声音冲击力", sfx: "音效: Whoosh_Fast_04.wav" }
      ];
      
      const data = tabData[index] || tabData[0];
      if (titleEl) titleEl.textContent = data.title;
      if (tagEl) tagEl.textContent = data.tag;
      if (sfxEl) sfxEl.textContent = data.sfx;
    }

    window.addEventListener("DOMContentLoaded", applySmartDownloadHighlight);
  </script>
</body>
</html>`;
}

/** 官网请求主入口 */
export async function handleSiteRequest(request, { kv } = {}) {
  const url = new URL(request.url);
  const normalized = normalizePath(url.pathname);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Max-Age": "86400"
      }
    });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405, headers: TEXT_HEADERS });
  }

  // Favicon
  if (normalized === FAVICON_PATH) {
    return new Response(SITE_FAVICON_SVG, { status: 200, headers: SVG_HEADERS });
  }

  // Robots.txt
  if (normalized === ROBOTS_PATH) {
    return new Response(SITE_ROBOTS_TXT, { status: 200, headers: TEXT_HEADERS });
  }

  // 获取最新全平台发版数据
  const releases = await getLatestReleases(kv);

  // 默认渲染官网 HTML
  const html = renderLandingPageHtml({ releases });
  return new Response(html, { status: 200, headers: HTML_HEADERS });
}
