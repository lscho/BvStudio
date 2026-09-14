/**
 * BVideo 桌面更新服务的纯逻辑核心。
 *
 * 与 license-core.mjs 同样不依赖运行时全局 API，可同时运行在 ESA Edge Routine、
 * Node 22 与 Vitest 中，供边缘函数、发布导入脚本与单元测试共用。
 *
 * 契约依据 docs/15-桌面更新服务协议.md 与 tauri-plugin-updater 的 RemoteRelease 反序列化：
 * 本项目按单平台查询（端点模板只含 {{target}}），因此响应使用 Dynamic 形态
 * （顶层平铺 url 与 signature），而不是 Static 的 platforms 映射。
 * 其中 version / url / signature 缺失会让 Rust 侧整个响应反序列化失败，
 * pub_date 若不是带时区的 RFC3339 同样会失败，故三者之外也做严格校验。
 */

/**
 * 服务端只受理这两个平台的更新查询，与构建矩阵及下载页 `DOWNLOAD_PLATFORMS` 保持一致；
 * 其余平台（windows-arm / macos-x86 / linux-x86）不在发布范围，查询一律 400。
 */
export const CLIENT_UPDATE_PLATFORMS = ["windows-x86", "macos-arm"];

/** 与 scripts/build-desktop-release-manifest.mjs 保持一致的 SemVer 校验。 */
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

/**
 * 必须带时区偏移。客户端 Rust 侧用 Rfc3339 解析 pub_date，
 * 形如 2026-01-15T08:00:00 的无时区写法会让整个更新检查失败。
 */
const RFC3339_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function isValidUpdatePlatform(value) {
  return typeof value === "string" && CLIENT_UPDATE_PLATFORMS.includes(value);
}

/** 每个平台只保留一条「最新已发布」指针，读取即为下发内容。 */
export function releaseKeyFor(platform) {
  return `release:latest:${platform}`;
}

export function trimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** 去掉发布标签常见的 v 前缀；客户端 Rust 侧同样会 trim 前导 v。 */
export function normalizeVersion(value) {
  return trimmedString(value).replace(/^v/, "");
}

export function isSemver(value) {
  return SEMVER_RE.test(value);
}

export function isRfc3339(value) {
  return typeof value === "string" && RFC3339_RE.test(value) && !Number.isNaN(Date.parse(value));
}

/** 仅接受安全正整数；其它值（负数、0、非安全整数、非数字）返回 null。 */
export function positiveInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** 更新包地址必须是 https 绝对 URL，且不得内嵌账号密码。 */
export function isHttpsUrl(value) {
  if (typeof value !== "string" || !value) return false;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === "https:" && !parsed.username && !parsed.password;
}

/** 从合法更新 URL 的路径段推导文件名；无效时返回空串。 */
export function fileNameFromUrl(value) {
  if (!isHttpsUrl(value)) return "";
  const pathname = new URL(value).pathname;
  try {
    return decodeURIComponent(pathname.split("/").pop() ?? "");
  } catch {
    return pathname.split("/").pop() ?? "";
  }
}

/**
 * 记录 → 下发响应体（Dynamic 形态 + 客户端 UI 层附加字段）。
 * 仅在 decideUpdateResponse 判定可用后调用，因此这里只做归一化，不再返回错误。
 */
export function buildUpdatePayload(record, platform) {
  const url = trimmedString(record.url);
  return {
    platform,
    version: normalizeVersion(record.version),
    url,
    signature: trimmedString(record.signature),
    fileName: trimmedString(record.fileName) || fileNameFromUrl(url),
    fileSize: positiveInteger(record.fileSize),
    notes: trimmedString(record.notes),
    pub_date: trimmedString(record.pub_date),
    isForceUpdate: record.isForceUpdate === true
  };
}

/**
 * 决定响应状态：
 * - 无记录 → 204（正常的「无更新」结果，不是错误）
 * - 记录存在但更新包元数据不完整 → 503（不回退到更旧的记录）
 * - 完整 → 200
 */
export function decideUpdateResponse(record, platform) {
  if (!record || typeof record !== "object") return { status: 204, payload: null, reason: "empty" };

  const version = normalizeVersion(record.version);
  if (!isSemver(version)) return { status: 503, payload: null, reason: "version" };
  if (!isHttpsUrl(record.url)) return { status: 503, payload: null, reason: "url" };
  if (!trimmedString(record.signature)) return { status: 503, payload: null, reason: "signature" };
  if (positiveInteger(record.fileSize) === null) return { status: 503, payload: null, reason: "fileSize" };

  const pubDate = trimmedString(record.pub_date);
  if (pubDate && !isRfc3339(pubDate)) return { status: 503, payload: null, reason: "pub_date" };

  return { status: 200, payload: buildUpdatePayload(record, platform), reason: "ok" };
}
