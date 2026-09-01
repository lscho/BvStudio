import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { BadgeCheck, Download, LoaderCircle, PackageOpen, ShieldAlert, Trash2, X } from "lucide-react";
import { inspectEffectPackage, selectEffectPackage, type EffectPackageInfo } from "@/services/effectPackages";
import { useEffectLibraryStore } from "@/stores/effectLibraryStore";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EffectLibraryDialog({ open, onOpenChange }: Props) {
  const packages = useEffectLibraryStore((state) => state.packages);
  const install = useEffectLibraryStore((state) => state.install);
  const uninstall = useEffectLibraryStore((state) => state.uninstall);
  const [pending, setPending] = useState<EffectPackageInfo | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<EffectPackageInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function choosePackage() {
    const path = await selectEffectPackage();
    if (!path) return;
    setBusy(true);
    setError("");
    try {
      const info = await inspectEffectPackage(path);
      const installed = packages.some((item) => item.manifest.id === info.manifest.id);
      if (info.verified && !installed) {
        await install(path, false);
      } else {
        setPending(info);
      }
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : String(exception || "动效包读取失败"));
    } finally {
      setBusy(false);
    }
  }

  async function installPending() {
    if (!pending) return;
    setBusy(true);
    try {
      await install(pending.path, !pending.verified);
      setPending(null);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : String(exception || "动效包安装失败"));
    } finally {
      setBusy(false);
    }
  }

  async function removePackage(packageId: string) {
    setBusy(true);
    try {
      await uninstall(packageId);
      setPendingRemoval(null);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : String(exception || "动效包卸载失败"));
    } finally {
      setBusy(false);
    }
  }

  const pendingInstalled = pending ? packages.find((item) => item.manifest.id === pending.manifest.id) : undefined;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content effect-library-dialog" aria-describedby="effect-library-description">
          <Dialog.Close className="icon-button dialog-close" aria-label="关闭"><X size={18} /></Dialog.Close>
          <Dialog.Title>动效库</Dialog.Title>
          <Dialog.Description id="effect-library-description">管理本机安装的声明式动效与音效包。</Dialog.Description>
          <button className="button primary install-effect" type="button" disabled={busy} onClick={() => void choosePackage()}>{busy ? <LoaderCircle className="spin" size={15} /> : <Download size={15} />}安装 .bveffect</button>
          {pending && <div className="unsigned-warning"><ShieldAlert size={18} /><span><strong>{pending.manifest.name} {pending.manifest.version}</strong><small>{!pending.verified ? "此包没有有效的 Ed25519 完整性签名。" : pendingInstalled?.manifest.version === pending.manifest.version ? "将重新安装当前版本。" : `将 ${pendingInstalled?.manifest.version ?? "未安装"} 更新为 ${pending.manifest.version}；低版本会被拒绝。`}</small></span><div className="confirm-actions"><button type="button" disabled={busy} onClick={() => setPending(null)}>取消</button><button className="button secondary" type="button" disabled={busy} onClick={() => void installPending()}>{pending.verified ? "确认安装" : "仍然安装"}</button></div></div>}
          {pendingRemoval && <div className="remove-warning"><Trash2 size={18} /><span><strong>卸载 {pendingRemoval.manifest.name}？</strong><small>它会从动效库移除；现有工程仍使用已经保存的动效与音效快照。</small></span><div className="confirm-actions"><button type="button" disabled={busy} onClick={() => setPendingRemoval(null)}>取消</button><button className="button secondary danger-action" type="button" disabled={busy} onClick={() => void removePackage(pendingRemoval.manifest.id)}>确认卸载</button></div></div>}
          <div className="package-list">{packages.length ? packages.map((item) => <div key={item.manifest.id}><PackageOpen size={18} /><span><strong>{item.manifest.name}</strong><small>{item.manifest.author} · {item.manifest.version} · {item.effects.length} 个动效{item.soundCount ? ` · ${item.soundCount} 个音效` : ""}</small></span>{item.verified && <BadgeCheck className="verified" size={16} />}<button type="button" aria-label={`卸载 ${item.manifest.name}`} title="卸载动效包" disabled={busy} onClick={() => setPendingRemoval(item)}><Trash2 size={14} /></button></div>) : <p className="empty-copy">尚未安装扩展动效包</p>}</div>
          {error && <p className="error-text" role="alert">{error}</p>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
