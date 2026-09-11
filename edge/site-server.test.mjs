import { describe, expect, it } from "vitest";
import rootPackage from "../package.json";
import { releaseKeyFor } from "./release-core.mjs";
import {
  formatBytes,
  getLatestReleases,
  handleSiteRequest,
  isSiteRoute,
  normalizePath,
  FALLBACK_RELEASES,
  SITE_FAVICON_SVG,
  SITE_ROBOTS_TXT
} from "./site-server.mjs";

function createFakeKv(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    async get(key) {
      return store.has(key) ? structuredClone(store.get(key)) : null;
    }
  };
}

describe("isSiteRoute and normalizePath", () => {
  it("识别并匹配官网页面及公共静态资产路径", () => {
    expect(isSiteRoute("/")).toBe(true);
    expect(isSiteRoute("//")).toBe(true);
    expect(isSiteRoute("/index.html")).toBe(true);
    expect(isSiteRoute("/download")).toBe(true);
    expect(isSiteRoute("/download/")).toBe(true);
    expect(isSiteRoute("/downloads")).toBe(true);
    expect(isSiteRoute("/favicon.ico")).toBe(true);
    expect(isSiteRoute("/robots.txt")).toBe(true);
    expect(isSiteRoute("/api/site/releases")).toBe(false);
  });

  it("不干扰更新服务与会员授权接口", () => {
    expect(isSiteRoute("/api/desktop-updates/latest")).toBe(false);
    expect(isSiteRoute("/api/license/verify")).toBe(false);
    expect(isSiteRoute("/api/license/redeem")).toBe(false);
    expect(isSiteRoute("/api/unknown")).toBe(false);
    expect(isSiteRoute("/some-other-path")).toBe(false);
  });

  it("normalizePath 正确去除多余尾部斜杠并保底为 /", () => {
    expect(normalizePath("/download/")).toBe("/download");
    expect(normalizePath("///")).toBe("/");
    expect(normalizePath("")).toBe("/");
    expect(normalizePath(null)).toBe("/");
  });
});

describe("formatBytes", () => {
  it("准确格式化字节数为人类可读的单位", () => {
    expect(formatBytes(500)).toBe("500.0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(45 * 1024 * 1024)).toBe("45.0 MB");
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe("1.5 GB");
  });

  it("非法输入或非正数返回空字符串", () => {
    expect(formatBytes(0)).toBe("");
    expect(formatBytes(-100)).toBe("");
    expect(formatBytes(null)).toBe("");
    expect(formatBytes(undefined)).toBe("");
    expect(formatBytes(Number.NaN)).toBe("");
  });
});

describe("getLatestReleases", () => {
  it("KV 为空时安全回退至内置默认发版元数据", async () => {
    const releases = await getLatestReleases(null);
    expect(releases).toEqual(FALLBACK_RELEASES);

    const emptyKvReleases = await getLatestReleases(createFakeKv());
    expect(emptyKvReleases["macos-arm"].version).toBe(FALLBACK_RELEASES["macos-arm"].version);
    expect(emptyKvReleases["windows-x86"].url).toBe(FALLBACK_RELEASES["windows-x86"].url);
  });

  it("KV 存在有效记录时动态覆盖并合并对应平台", async () => {
    const customRecord = {
      platform: "macos-arm",
      version: "0.5.0",
      url: "https://example.com/custom_bframe.dmg",
      fileName: "custom_bframe.dmg",
      fileSize: 46137344,
      notes: "新版发布特性说明",
      pub_date: "2026-03-01T12:00:00Z"
    };

    const kv = createFakeKv({
      [releaseKeyFor("macos-arm")]: customRecord
    });

    const releases = await getLatestReleases(kv);
    expect(releases["macos-arm"].version).toBe("0.5.0");
    expect(releases["macos-arm"].url).toBe(customRecord.url);
    expect(releases["macos-arm"].fileName).toBe(customRecord.fileName);
    expect(releases["macos-arm"].fileSize).toBe(customRecord.fileSize);
    // 其它未发布的平台继续保持默认回退
    expect(releases["windows-x86"].version).toBe(FALLBACK_RELEASES["windows-x86"].version);
  });

  it("KV 抛出异常时容错并保留回退数据，不崩溃", async () => {
    const errorKv = {
      async get() {
        throw new Error("KV read error");
      }
    };
    const releases = await getLatestReleases(errorKv);
    expect(releases["macos-arm"].name).toBe("macOS (Apple Silicon)");
  });

  it("下载页展示安装包地址，更新包地址单独保留", async () => {
    // macOS 上两者是不同文件：安装包是 .dmg，更新包是 .app.tar.gz。
    const record = {
      platform: "macos-arm",
      version: "0.5.0",
      url: "https://dl.example.com/releases/v0.5.0/BFrame%20Studio_0.5.0_aarch64_arm64.app.tar.gz",
      fileName: "BFrame Studio_0.5.0_aarch64_arm64.app.tar.gz",
      fileSize: 70254592,
      installerUrl: "https://dl.example.com/releases/v0.5.0/BFrame%20Studio_0.5.0_aarch64.dmg",
      installerFileName: "BFrame Studio_0.5.0_aarch64.dmg",
      installerFileSize: 48234496
    };
    const releases = await getLatestReleases(createFakeKv({ [releaseKeyFor("macos-arm")]: record }));

    expect(releases["macos-arm"].url).toBe(record.installerUrl);
    expect(releases["macos-arm"].updaterUrl).toBe(record.url);
    expect(releases["macos-arm"].fileName).toBe(record.installerFileName);
    expect(releases["macos-arm"].fileSize).toBe(record.installerFileSize);
  });

  it("旧记录没有 installerUrl 时退回更新包地址，保持向后兼容", async () => {
    const record = {
      platform: "linux-x86",
      version: "0.4.0",
      url: "https://dl.example.com/releases/v0.4.0/BFrame%20Studio_0.4.0_amd64.AppImage.tar.gz",
      fileName: "BFrame Studio_0.4.0_amd64.AppImage.tar.gz",
      fileSize: 72351744
    };
    const releases = await getLatestReleases(createFakeKv({ [releaseKeyFor("linux-x86")]: record }));

    expect(releases["linux-x86"].url).toBe(record.url);
    expect(releases["linux-x86"].updaterUrl).toBe(record.url);
    expect(releases["linux-x86"].fileName).toBe(record.fileName);
  });

  it("内置回退数据带应用名子目录，且应用名与 package.json 一致", () => {
    // 下载域名可同时托管多个应用，路径里的应用名子目录必须与 CI 拼接时用的一致。
    // CI 取自 package.json 的 name，这里反向核对，避免两处各自漂移。
    const appSlug = rootPackage.name;

    for (const release of Object.values(FALLBACK_RELEASES)) {
      expect(release.url.startsWith("https://")).toBe(true);
      expect(release.url).not.toContain("github.com");
      expect(release.updaterUrl).not.toContain("github.com");
      expect(release.url).toContain(`/${appSlug}/releases/v`);
      expect(release.updaterUrl).toContain(`/${appSlug}/releases/v`);
    }
  });
});

describe("handleSiteRequest", () => {
  it("访问根路径 / 返回 200 及包含关键技术要素的 HTML", async () => {
    const request = new Request("https://bframe.studio/");
    const response = await handleSiteRequest(request, { kv: createFakeKv() });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toContain("public");

    const html = await response.text();
    expect(html).toContain("BFrame Studio");
    expect(html).toContain("AI 视频动效编排客户端");
    expect(html).toContain("AI 智能文案与台本");
    expect(html).toContain("AI 字幕与精准 ASR");
    expect(html).toContain("场景与电影级运镜");
    expect(html).toContain("多轨动作音效与配音");
    expect(html).toContain("原生 FFmpeg 极速导出");
    expect(html).toContain("下载 BFrame Studio 桌面版");
    expect(html).toContain("macOS Apple Silicon");
    expect(html).toContain("Windows 64 位");
    expect(html).not.toContain("工作室预览");
    expect(html.toLowerCase()).not.toContain("mimo");
    expect(html.toLowerCase()).not.toContain("shotcraft");
    expect(html.toLowerCase()).not.toContain("tauri");
  });

  it("访问 /download 同样返回官网下载页", async () => {
    const request = new Request("https://bframe.studio/download");
    const response = await handleSiteRequest(request, { kv: createFakeKv() });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
  });

  it("访问 /favicon.ico 返回 SVG 图标", async () => {
    const request = new Request("https://bframe.studio/favicon.ico");
    const response = await handleSiteRequest(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml; charset=utf-8");
    const svg = await response.text();
    expect(svg).toBe(SITE_FAVICON_SVG);
  });

  it("访问 /robots.txt 返回抓取配置", async () => {
    const request = new Request("https://bframe.studio/robots.txt");
    const response = await handleSiteRequest(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    const text = await response.text();
    expect(text).toBe(SITE_ROBOTS_TXT);
  });

  it("页面不暴露 GitHub 仓库链接与版本 API 链接", async () => {
    const request = new Request("https://bframe.studio/");
    const response = await handleSiteRequest(request, { kv: createFakeKv() });
    const html = await response.text();
    expect(html).not.toContain("GitHub 仓库");
    expect(html).not.toContain("版本 JSON API");
    expect(html).not.toContain("更新检测端点");
    expect(html).not.toContain("https://github.com/lscho/BvStudio\"");
    expect(html).not.toContain('class="btn-ghost"');
  });

  it("OPTIONS 预检请求返回 204 及 CORS 头", async () => {
    const request = new Request("https://bframe.studio/", { method: "OPTIONS" });
    const response = await handleSiteRequest(request);
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
  });

  it("不支持的请求方法返回 405 Method Not Allowed", async () => {
    const request = new Request("https://bframe.studio/", { method: "POST" });
    const response = await handleSiteRequest(request);
    expect(response.status).toBe(405);
  });
});
