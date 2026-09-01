import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, MonitorUp, X } from "lucide-react";
import { Select } from "@/components/Select";
import { normalizeOutputFps, OUTPUT_FPS_OPTIONS } from "@/domain/outputSettings";
import type { EditorProject, MediaAsset } from "@/domain/project";
import { useEditorStore } from "@/stores/editorStore";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canvas: EditorProject["canvas"];
  assets: MediaAsset[];
}

const PRESETS = [
  { id: "landscape", label: "横屏 16:9", width: 1920, height: 1080 },
  { id: "portrait", label: "竖屏 9:16", width: 1080, height: 1920 },
  { id: "square", label: "方形 1:1", width: 1080, height: 1080 },
  { id: "classic", label: "经典 4:3", width: 1440, height: 1080 }
] as const;

function evenDimension(value: number) {
  return Math.max(64, Math.min(7680, Math.round(value / 2) * 2));
}

export function CanvasSettingsDialog({ open, onOpenChange, canvas, assets }: Props) {
  const updateCanvas = useEditorStore((state) => state.updateCanvas);
  const [width, setWidth] = useState(canvas.width);
  const [height, setHeight] = useState(canvas.height);
  const [fps, setFps] = useState<number>(normalizeOutputFps(canvas.fpsNumerator / canvas.fpsDenominator));
  const sourceSizes = useMemo(() => {
    const seen = new Set<string>();
    return assets.filter((asset) => asset.kind === "video" && asset.width && asset.height).flatMap((asset) => {
      const key = `${asset.width}x${asset.height}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ id: asset.id, name: asset.name, width: asset.width!, height: asset.height!, fps: asset.fpsNumerator && asset.fpsDenominator ? asset.fpsNumerator / asset.fpsDenominator : undefined }];
    }).slice(0, 8);
  }, [assets]);

  useEffect(() => {
    if (!open) return;
    setWidth(canvas.width);
    setHeight(canvas.height);
    setFps(normalizeOutputFps(canvas.fpsNumerator / canvas.fpsDenominator));
  }, [canvas, open]);

  function choose(widthValue: number, heightValue: number, fpsValue?: number) {
    setWidth(widthValue);
    setHeight(heightValue);
    if (fpsValue) setFps(normalizeOutputFps(fpsValue));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    updateCanvas({ width: evenDimension(width), height: evenDimension(height), fpsNumerator: Math.round(fps * 1_000), fpsDenominator: 1_000 });
    onOpenChange(false);
  }

  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="dialog-overlay" />
      <Dialog.Content className="dialog-content canvas-dialog" aria-describedby="canvas-description">
        <Dialog.Close className="icon-button dialog-close" aria-label="关闭"><X size={18} /></Dialog.Close>
        <span className="dialog-icon"><MonitorUp size={20} /></span>
        <Dialog.Title>画布与输出规格</Dialog.Title>
        <Dialog.Description id="canvas-description">设置预览和 MP4 导出的宽高与帧率。</Dialog.Description>
        <form className="settings-form" onSubmit={submit}>
          <fieldset><legend>常用比例</legend><div className="canvas-presets">{PRESETS.map((preset) => <button key={preset.id} className={width === preset.width && height === preset.height ? "active" : ""} type="button" onClick={() => choose(preset.width, preset.height)}><span>{preset.width < preset.height ? "9:16" : preset.width === preset.height ? "1:1" : preset.id === "classic" ? "4:3" : "16:9"}</span><strong>{preset.label}</strong><small>{preset.width} × {preset.height}</small>{width === preset.width && height === preset.height && <Check size={13} />}</button>)}</div></fieldset>
          {sourceSizes.length > 0 && <label><span>跟随素材</span><Select label="跟随素材" value="" placeholder="选择已导入视频规格" onChange={(value) => { const source = sourceSizes.find((item) => item.id === value); if (source) choose(source.width, source.height, source.fps); }} options={sourceSizes.map((source) => ({ value: source.id, label: `${source.name} · ${source.width} × ${source.height}` }))} /></label>}
          <div className="form-grid"><label><span>宽度</span><input type="number" min={64} max={7680} step={2} value={width} onChange={(event) => setWidth(Number(event.target.value))} /></label><label><span>高度</span><input type="number" min={64} max={7680} step={2} value={height} onChange={(event) => setHeight(Number(event.target.value))} /></label></div>
          <label><span>帧率</span><Select label="帧率" value={String(fps)} onChange={(value) => setFps(Number(value))} options={OUTPUT_FPS_OPTIONS.map((value) => ({ value: String(value), label: `${value} fps` }))} /></label>
          <div className="dialog-actions"><Dialog.Close className="button secondary" type="button">取消</Dialog.Close><button className="button primary" type="submit">应用画布</button></div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
