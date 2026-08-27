import * as Dialog from "@radix-ui/react-dialog";
import { Download, RefreshCw, RotateCw, ShieldAlert, X } from "lucide-react";
import type { AppUpdateStatus } from "@/hooks/useAppUpdater";
import type { DesktopUpdateInfo } from "@/services/updater";

interface Props {
  info: DesktopUpdateInfo;
  status: AppUpdateStatus;
  canDismiss: boolean;
  downloadedBytes: number;
  totalBytes: number | null;
  progressPercent: number | null;
  errorMessage: string;
  installed: boolean;
  onDismiss: () => void;
  onInstall: () => void;
  onRestart: () => void;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UpdateModal(props: Props) {
  const busy = ["downloading", "installing", "restarting"].includes(props.status);
  const statusText = props.status === "downloading"
    ? `正在下载更新包${props.progressPercent === null ? "" : ` ${props.progressPercent}%`}`
    : props.status === "installing" ? "正在安装更新"
      : props.status === "restarting" ? "正在重新启动"
        : props.status === "error" ? props.errorMessage
          : props.info.isForceUpdate ? "此版本需要更新后才能继续使用" : "新版本已发布";
  return (
    <Dialog.Root open onOpenChange={(open) => !open && props.canDismiss && props.onDismiss()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content update-dialog" aria-describedby="update-status">
          {props.canDismiss && <Dialog.Close className="icon-button dialog-close" aria-label="稍后更新"><X size={18} /></Dialog.Close>}
          <div className="dialog-heading-row">
            <span className="dialog-icon">{props.info.isForceUpdate ? <ShieldAlert size={22} /> : <Download size={22} />}</span>
            <div>
              <span className="eyebrow">SOFTWARE UPDATE</span>
              <Dialog.Title>{props.info.isForceUpdate ? "需要更新客户端" : "发现新版本"}</Dialog.Title>
              <Dialog.Description>当前 {props.info.currentVersion} · 最新 {props.info.version}</Dialog.Description>
            </div>
          </div>
          <p id="update-status" className={props.status === "error" ? "error-text" : "muted-text"}>{statusText}</p>
          {props.info.notes && <div className="release-notes"><span>更新内容</span><p>{props.info.notes}</p></div>}
          {busy && <div className="progress-block"><div className="progress-track"><span style={{ width: `${props.progressPercent ?? 20}%` }} /></div><small>{props.totalBytes ? `${formatBytes(props.downloadedBytes)} / ${formatBytes(props.totalBytes)}` : statusText}</small></div>}
          <div className="dialog-actions">
            {props.canDismiss && <Dialog.Close className="button secondary">稍后</Dialog.Close>}
            <button className="button primary" type="button" disabled={busy} onClick={props.installed ? props.onRestart : props.onInstall}>
              {props.installed ? <RotateCw size={16} /> : props.status === "error" ? <RefreshCw size={16} /> : <Download size={16} />}
              {props.installed ? "重新启动" : props.status === "error" ? "重试更新" : "更新并重启"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
