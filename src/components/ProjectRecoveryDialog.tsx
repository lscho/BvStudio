import * as Dialog from "@radix-ui/react-dialog";
import { LoaderCircle, RotateCcw, Trash2, X } from "lucide-react";
import type { RecoverySnapshot } from "@/services/projectSession";

interface Props {
  snapshot: RecoverySnapshot | null;
  restoring: boolean;
  error: string;
  onDiscard: () => void;
  onRestore: () => void;
}

export function ProjectRecoveryDialog({ snapshot, restoring, error, onDiscard, onRestore }: Props) {
  return (
    <Dialog.Root open={Boolean(snapshot)}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content recovery-dialog" aria-describedby="recovery-description">
          <Dialog.Title>恢复未保存的工程</Dialog.Title>
          <Dialog.Description id="recovery-description">检测到 {snapshot ? new Date(snapshot.savedAt).toLocaleString() : ""} 保存的自动恢复快照。</Dialog.Description>
          {snapshot?.projectPath && <p className="path-copy">{snapshot.projectPath}</p>}
          {error && <p className="recovery-error" role="alert">恢复失败：{error}</p>}
          <div className="dialog-actions">
            <button className="button secondary danger-action" type="button" disabled={restoring} onClick={onDiscard}><Trash2 size={15} />放弃快照</button>
            <button className="button primary" type="button" disabled={restoring} onClick={onRestore}>{restoring ? <LoaderCircle className="spin" size={15} /> : <RotateCcw size={15} />}{restoring ? "正在恢复" : "恢复工程"}</button>
          </div>
          <button className="icon-button dialog-close" type="button" aria-label="关闭" disabled={restoring} onClick={onDiscard}><X size={18} /></button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
