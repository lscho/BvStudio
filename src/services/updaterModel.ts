export type ClientUpdatePlatform = "windows-x86" | "windows-arm" | "macos-x86" | "macos-arm" | "linux-x86";

export interface DesktopUpdateInfo {
  currentVersion: string;
  version: string;
  platform: ClientUpdatePlatform;
  fileName: string;
  fileSize: number | null;
  notes: string;
  publishTime: string | null;
  isForceUpdate: boolean;
}

export interface DesktopUpdateProgress {
  phase: "downloading" | "installing";
  downloadedBytes: number;
  totalBytes: number | null;
}

export interface UpdaterRawMetadata {
  fileName?: unknown;
  fileSize?: unknown;
  notes?: unknown;
  pub_date?: unknown;
  isForceUpdate?: unknown;
  url?: unknown;
}

export interface UpdaterRawUpdate {
  currentVersion: string;
  version: string;
  body?: string;
  date?: string;
  rawJson: unknown;
}

const FALLBACK_FILE_NAME = "更新包";

/** OS/架构 → 更新平台映射；其余组合返回 null（不支持更新）。 */
export function clientUpdatePlatformFor(os: string, architecture: string): ClientUpdatePlatform | null {
  if (os === "windows") {
    if (architecture === "x86_64") return "windows-x86";
    if (architecture === "aarch64") return "windows-arm";
    return null;
  }
  if (os === "macos") {
    if (architecture === "x86_64") return "macos-x86";
    if (architecture === "aarch64") return "macos-arm";
    return null;
  }
  if (os === "linux" && architecture === "x86_64") return "linux-x86";
  return null;
}

export function trimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** 仅接受安全正整数；其它值（负数、0、非安全整数、非数字）返回 null。 */
export function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** 从合法更新 URL 的路径段推导文件名；无效时回退到“更新包”。 */
export function fileNameFromUrl(value: unknown): string {
  const rawUrl = trimmedString(value);
  if (!rawUrl) return FALLBACK_FILE_NAME;
  try {
    const pathname = new URL(rawUrl).pathname;
    return decodeURIComponent(pathname.split("/").pop() || FALLBACK_FILE_NAME) || FALLBACK_FILE_NAME;
  } catch {
    return FALLBACK_FILE_NAME;
  }
}

/** 严格归一化 Tauri 返回的原始元数据：仅保留可信字段，损坏值回退为 null/空。 */
export function parseDesktopUpdateInfo(
  update: UpdaterRawUpdate,
  target: ClientUpdatePlatform
): DesktopUpdateInfo {
  const raw = (update.rawJson ?? {}) as UpdaterRawMetadata;
  const notes = trimmedString(update.body) || trimmedString(raw.notes);
  const rawFileName = trimmedString(raw.fileName);

  return {
    currentVersion: update.currentVersion,
    version: update.version,
    platform: target,
    fileName: rawFileName || fileNameFromUrl(raw.url),
    fileSize: positiveInteger(raw.fileSize),
    notes,
    publishTime: trimmedString(update.date) || trimmedString(raw.pub_date) || null,
    isForceUpdate: raw.isForceUpdate === true
  };
}
