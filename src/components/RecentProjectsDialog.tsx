import * as Dialog from "@radix-ui/react-dialog";
import { FileClock, FolderOpen, X } from "lucide-react";
import type { RecentProject } from "@/services/projectSession";

interface Props {
  open: boolean;
  projects: RecentProject[];
  onOpenChange: (open: boolean) => void;
  onOpenProject: (path: string) => void;
  onBrowse: () => void;
}

export function RecentProjectsDialog({ open, projects, onOpenChange, onOpenProject, onBrowse }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content recent-dialog" aria-describedby="recent-description">
          <Dialog.Close className="icon-button dialog-close" aria-label="关闭"><X size={18} /></Dialog.Close>
          <Dialog.Title>最近工程</Dialog.Title>
          <Dialog.Description id="recent-description">从最近保存或打开的工程继续创作。</Dialog.Description>
          <div className="recent-list">
            {projects.length ? projects.map((project) => (
              <button type="button" key={project.path} onClick={() => onOpenProject(project.path)}>
                <FileClock size={18} />
                <span><strong>{project.name}</strong><small>{project.path}</small></span>
                <time>{new Date(project.lastOpenedAt).toLocaleDateString()}</time>
              </button>
            )) : <p className="empty-copy">还没有最近工程</p>}
          </div>
          <div className="dialog-actions"><button className="button secondary" type="button" onClick={onBrowse}><FolderOpen size={15} />选择其他工程</button></div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
