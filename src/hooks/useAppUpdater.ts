import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  checkDesktopUpdate,
  type DesktopUpdateHandle,
  type DesktopUpdateInfo,
  type DesktopUpdateProgress
} from "@/services/updater";

export type AppUpdateStatus = "idle" | "checking" | "available" | "downloading" | "installing" | "restarting" | "error";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export function useAppUpdater() {
  const [status, setStatus] = useState<AppUpdateStatus>("idle");
  const [update, setUpdate] = useState<DesktopUpdateHandle | null>(null);
  const [visible, setVisible] = useState(false);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [installed, setInstalled] = useState(false);
  const checked = useRef(false);
  const updateRef = useRef<DesktopUpdateHandle | null>(null);

  useEffect(() => {
    updateRef.current = update;
  }, [update]);

  useEffect(() => () => {
    void updateRef.current?.close().catch(() => undefined);
  }, []);

  const checkForUpdates = useCallback(async () => {
    if (checked.current) return;
    checked.current = true;
    setStatus("checking");
    try {
      const handle = await checkDesktopUpdate();
      setUpdate(handle);
      setStatus(handle ? "available" : "idle");
      setVisible(handle?.info.isForceUpdate === true);
    } catch {
      setStatus("idle");
    }
  }, []);

  const busy = ["downloading", "installing", "restarting"].includes(status);
  const canDismiss = Boolean(update && !update.info.isForceUpdate && !busy && !installed);
  const progressPercent = totalBytes ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : null;

  const installAndRestart = useCallback(async () => {
    if (!update || busy || installed) return;
    setMessage("");
    setDownloadedBytes(0);
    setTotalBytes(update.info.fileSize);
    setStatus("downloading");
    try {
      await update.install((progress: DesktopUpdateProgress) => {
        setStatus(progress.phase);
        setDownloadedBytes(progress.downloadedBytes);
        setTotalBytes(progress.totalBytes);
      });
      setInstalled(true);
      setStatus("restarting");
      await update.restart();
    } catch (error) {
      setStatus("error");
      setMessage(errorMessage(error, "更新失败，请稍后重试。"));
    }
  }, [busy, installed, update]);

  const retryRestart = useCallback(async () => {
    if (!update || !installed) return;
    setStatus("restarting");
    try {
      await update.restart();
    } catch (error) {
      setStatus("error");
      setMessage(errorMessage(error, "客户端未能自动重启。"));
    }
  }, [installed, update]);

  return useMemo(() => ({
    status,
    info: update?.info as DesktopUpdateInfo | undefined,
    visible,
    setVisible,
    canDismiss,
    downloadedBytes,
    totalBytes,
    progressPercent,
    errorMessage: message,
    installed,
    checkForUpdates,
    installAndRestart,
    retryRestart
  }), [canDismiss, checkForUpdates, downloadedBytes, installAndRestart, installed, message, progressPercent, retryRestart, status, totalBytes, update, visible]);
}
