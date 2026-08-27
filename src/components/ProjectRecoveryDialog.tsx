import * as Dialog from "@radix-ui/react-dialog";
import { RotateCcw, Trash2, X } from "lucide-react";
import type { RecoverySnapshot } from "@/services/projectSession";

interface Props {
  snapshot: RecoverySnapshot | null;
  onDiscard: () => void;
  onRestore: () => void;
}

export function ProjectRecoveryDialog({ snapshot, onDiscard, onRestore }: Props) {
  return (
    <Dialog.Root open={Boolean(snapshot)}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content recovery-dialog" aria-describedby="recovery-description">
          <Dialog.Title>恢复未保存的工程</Dialog.Title>
          <Dialog.Description id="recovery-description">检测到 {snapshot ? new Date(snapshot.savedAt).toLocaleString() : ""} 保存的自动恢复快照。</Dialog.Description>
          {snapshot?.projectPath && <p className="path-copy">{snapshot.projectPath}</p>}
          <div className="dialog-actions">
            <button className="button secondary danger-action" type="button" onClick={onDiscard}><Trash2 size={15} />放弃快照</button>
            <button className="button primary" type="button" onClick={onRestore}><RotateCcw size={15} />恢复工程</button>
          </div>
          <button className="icon-button dialog-close" type="button" aria-label="关闭" onClick={onDiscard}><X size={18} /></button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
