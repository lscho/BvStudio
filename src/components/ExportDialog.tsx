import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Download, X } from "lucide-react";
import { Select } from "@/components/Select";
import { normalizeOutputFps, OUTPUT_FPS_OPTIONS } from "@/domain/outputSettings";
import type { EditorProject } from "@/domain/project";
import type { ExportVideoFormat, VideoEncoder } from "@/services/media";

export interface VideoExportOptions {
  format: ExportVideoFormat;
  width: number;
  height: number;
  fps: number;
  encoder: "auto" | VideoEncoder;
}

interface Props {
  open: boolean;
  canvas: EditorProject["canvas"];
  defaultEncoder: "auto" | VideoEncoder;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (options: VideoExportOptions) => void;
}

const resolutionOptions = [
  { value: "project", label: "项目预设" },
  { value: "720", label: "720p" },
  { value: "1080", label: "1080p" },
  { value: "2160", label: "4K" }
] as const;

function even(value: number) {
  return Math.max(64, Math.round(value / 2) * 2);
}

export function exportDimensions(canvas: EditorProject["canvas"], resolution: string) {
  if (resolution === "project") return { width: canvas.width, height: canvas.height };
  const shortEdge = Number(resolution);
  const scale = shortEdge / Math.min(canvas.width, canvas.height);
  return { width: even(canvas.width * scale), height: even(canvas.height * scale) };
}

export function ExportDialog({ open, canvas, defaultEncoder, busy, onOpenChange, onExport }: Props) {
  const projectFps = normalizeOutputFps(canvas.fpsNumerator / canvas.fpsDenominator);
  const [format, setFormat] = useState<ExportVideoFormat>("mp4");
  const [resolution, setResolution] = useState("project");
  const [fps, setFps] = useState<number>(projectFps);
  const [encoder, setEncoder] = useState<"auto" | VideoEncoder>(defaultEncoder);
  const dimensions = useMemo(() => exportDimensions(canvas, resolution), [canvas, resolution]);
  const encoderOptions = useMemo(() => {
    const values = new Set<"auto" | VideoEncoder>(["auto", "software", defaultEncoder]);
    return [...values].map((value) => ({
      value,
      label: value === "auto" ? "自动选择" : value === "software" ? "软件编码（兼容）" : value === "videotoolbox" ? "Apple VideoToolbox" : value === "nvenc" ? "NVIDIA NVENC" : "Intel Quick Sync"
    }));
  }, [defaultEncoder]);

  useEffect(() => {
    if (!open) return;
    setFormat("mp4");
    setResolution("project");
    setFps(projectFps);
    setEncoder(defaultEncoder);
  }, [defaultEncoder, open, projectFps]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    onExport({ format, ...dimensions, fps, encoder });
  }

  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="dialog-overlay" />
      <Dialog.Content className="dialog-content export-dialog" aria-describedby="export-description">
        <Dialog.Close className="icon-button dialog-close" aria-label="关闭"><X size={18} /></Dialog.Close>
        <span className="dialog-icon"><Download size={20} /></span>
        <Dialog.Title>导出</Dialog.Title>
        <Dialog.Description id="export-description">本次导出参数独立于项目画布预设。</Dialog.Description>
        <form className="settings-form" onSubmit={submit}>
          <div className="form-grid">
            <label><span>格式</span><Select label="导出格式" value={format} onChange={(value) => setFormat(value as ExportVideoFormat)} options={[{ value: "mp4", label: "MP4" }, { value: "mov", label: "MOV" }]} /></label>
            <label><span>分辨率</span><Select label="导出分辨率" value={resolution} onChange={setResolution} options={resolutionOptions} /></label>
          </div>
          <div className="form-grid">
            <label><span>帧率</span><Select label="导出帧率" value={String(fps)} onChange={(value) => setFps(Number(value))} options={OUTPUT_FPS_OPTIONS.map((value) => ({ value: String(value), label: `${value} fps` }))} /></label>
            <label><span>编码器</span><Select label="导出编码器" value={encoder} onChange={(value) => setEncoder(value as "auto" | VideoEncoder)} options={encoderOptions} /></label>
          </div>
          <div className="export-summary"><span>{dimensions.width} × {dimensions.height}</span><span>{fps} fps</span><span>{format.toUpperCase()}</span></div>
          <div className="dialog-actions"><Dialog.Close className="button secondary" type="button">取消</Dialog.Close><button className="button primary" type="submit" disabled={busy}><Download size={15} />开始导出</button></div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
