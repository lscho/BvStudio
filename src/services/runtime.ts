import { getCurrentWindow } from "@tauri-apps/api/window";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { platform } from "@tauri-apps/plugin-os";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** 是否运行在 Tauri 桌面运行时（区别于浏览器预览）。 */
export function isDesktopRuntime(): boolean {
  return isTauri;
}

export type DesktopPlatform = "browser" | "macos" | "windows" | "linux";

/** 返回当前界面需要使用的平台布局；浏览器预览不会预留系统标题栏空间。 */
export async function desktopPlatform(): Promise<DesktopPlatform> {
  if (!isTauri) return "browser";
  const current = await platform();
  return current === "macos" || current === "windows" || current === "linux" ? current : "linux";
}

/** 是否运行在 Windows 桌面客户端；仅 Windows 使用自绘窗口控制按钮。 */
export async function isWindowsRuntime(): Promise<boolean> {
  if (!isTauri) return false;
  return (await platform()) === "windows";
}

export async function minimizeWindow(): Promise<void> {
  if (!isTauri) return;
  await getCurrentWindow().minimize();
}

export async function toggleWindowMaximized(): Promise<boolean> {
  if (!isTauri) return false;
  const appWindow = getCurrentWindow();
  await appWindow.toggleMaximize();
  return appWindow.isMaximized();
}

export async function isWindowMaximized(): Promise<boolean> {
  if (!isTauri) return false;
  return getCurrentWindow().isMaximized();
}

export async function closeWindow(): Promise<void> {
  if (!isTauri) return;
  await getCurrentWindow().close();
}

export async function onWindowResized(listener: () => void): Promise<UnlistenFn> {
  if (!isTauri) return () => undefined;
  return getCurrentWindow().onResized(() => listener());
}

/** 切换 DevTools；Rust 端命令在 release 构建中为空操作。 */
export async function toggleDevTools(): Promise<void> {
  if (!isTauri) return;
  await invoke("toggle-devtools");
}
