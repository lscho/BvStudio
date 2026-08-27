import { arch, platform } from "@tauri-apps/plugin-os";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";
import {
  clientUpdatePlatformFor,
  parseDesktopUpdateInfo,
  positiveInteger,
  type DesktopUpdateInfo,
  type DesktopUpdateProgress
} from "@/services/updaterModel";

export type { ClientUpdatePlatform, DesktopUpdateInfo, DesktopUpdateProgress } from "@/services/updaterModel";

export interface DesktopUpdateHandle {
  info: DesktopUpdateInfo;
  install: (onProgress: (progress: DesktopUpdateProgress) => void) => Promise<void>;
  restart: () => Promise<void>;
  close: () => Promise<void>;
}

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const updaterEnabled = import.meta.env.VITE_ENABLE_UPDATER === "true";

function installUpdate(
  update: Update,
  expectedSize: number | null,
  onProgress: (progress: DesktopUpdateProgress) => void
) {
  let downloadedBytes = 0;
  let totalBytes = expectedSize;

  return update.downloadAndInstall((event: DownloadEvent) => {
    if (event.event === "Started") {
      totalBytes = positiveInteger(event.data.contentLength) ?? totalBytes;
      onProgress({ phase: "downloading", downloadedBytes, totalBytes });
      return;
    }
    if (event.event === "Progress") {
      downloadedBytes += event.data.chunkLength;
      onProgress({ phase: "downloading", downloadedBytes, totalBytes });
      return;
    }
    if (totalBytes) downloadedBytes = totalBytes;
    onProgress({ phase: "installing", downloadedBytes, totalBytes });
  });
}

/**
 * 检查桌面更新。非 Tauri 运行时、VITE_ENABLE_UPDATER 未开启或平台不受支持时返回 null，
 * 且不会发起任何网络请求。
 */
export async function checkDesktopUpdate(): Promise<DesktopUpdateHandle | null> {
  if (!isTauri || !updaterEnabled) return null;

  const [os, architecture] = await Promise.all([platform(), arch()]);
  const target = clientUpdatePlatformFor(os, architecture);
  if (!target) return null;

  const update = await check({ target, timeout: 15_000 });
  if (!update) return null;

  const info = parseDesktopUpdateInfo(update, target);
  return {
    info,
    install: (onProgress) => installUpdate(update, info.fileSize, onProgress),
    restart: relaunch,
    close: () => update.close()
  };
}
