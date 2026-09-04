import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, MonitorUp, X } from "lucide-react";
import { Select } from "@/components/Select";
import { MOTION_THEME_COLOR_PRESETS, motionThemeWithColorPreset } from "@/domain/motionTheme";
import { normalizeOutputFps, OUTPUT_FPS_OPTIONS } from "@/domain/outputSettings";
import type { EditorProject, MediaAsset, MotionFont, MotionSkin, MotionStyle, MotionTheme } from "@/domain/project";
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

const STYLE_OPTIONS = [{ value: "minimal", label: "极简" }, { value: "editorial", label: "编辑感" }];
const FONT_OPTIONS = [{ value: "sans", label: "现代无衬线" }, { value: "display", label: "展示粗体" }];
const THEME_PRESETS: readonly { skin: MotionSkin; label: string }[] = [{ skin: "dark", label: "深色主题" }, { skin: "light", label: "浅色主题" }];

function evenDimension(value: number) {
  return Math.max(64, Math.min(7680, Math.round(value / 2) * 2));
}

export function CanvasSettingsDialog({ open, onOpenChange, canvas, assets }: Props) {
  const updateCanvas = useEditorStore((state) => state.updateCanvas);
  const motionTheme = useEditorStore((state) => state.project.motionTheme);
  const updateMotionTheme = useEditorStore((state) => state.updateMotionTheme);
  const [width, setWidth] = useState(canvas.width);
  const [height, setHeight] = useState(canvas.height);
  const [fps, setFps] = useState<number>(normalizeOutputFps(canvas.fpsNumerator / canvas.fpsDenominator));
  const [theme, setTheme] = useState<MotionTheme>(() => structuredClone(motionTheme));
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
    setTheme(structuredClone(motionTheme));
  }, [canvas, motionTheme, open]);

  function choose(widthValue: number, heightValue: number, fpsValue?: number) {
    setWidth(widthValue);
    setHeight(heightValue);
    if (fpsValue) setFps(normalizeOutputFps(fpsValue));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    updateCanvas({ width: evenDimension(width), height: evenDimension(height), fpsNumerator: Math.round(fps * 1_000), fpsDenominator: 1_000 });
    updateMotionTheme(theme);
    onOpenChange(false);
  }

  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="dialog-overlay" />
      <Dialog.Content className="dialog-content canvas-dialog" aria-describedby="canvas-description">
        <Dialog.Close className="icon-button dialog-close" aria-label="关闭"><X size={18} /></Dialog.Close>
        <span className="dialog-icon"><MonitorUp size={20} /></span>
        <Dialog.Title>画布与动效主题</Dialog.Title>
        <Dialog.Description id="canvas-description">设置成片规格，以及所有语义动效共用的外观。</Dialog.Description>
        <form className="settings-form" onSubmit={submit}>
          <fieldset><legend>常用比例</legend><div className="canvas-presets">{PRESETS.map((preset) => <button key={preset.id} className={width === preset.width && height === preset.height ? "active" : ""} type="button" onClick={() => choose(preset.width, preset.height)}><span>{preset.width < preset.height ? "9:16" : preset.width === preset.height ? "1:1" : preset.id === "classic" ? "4:3" : "16:9"}</span><strong>{preset.label}</strong><small>{preset.width} × {preset.height}</small>{width === preset.width && height === preset.height && <Check size={13} />}</button>)}</div></fieldset>
          {sourceSizes.length > 0 && <label><span>跟随素材</span><Select label="跟随素材" value="" placeholder="选择已导入视频规格" onChange={(value) => { const source = sourceSizes.find((item) => item.id === value); if (source) choose(source.width, source.height, source.fps); }} options={sourceSizes.map((source) => ({ value: source.id, label: `${source.name} · ${source.width} × ${source.height}` }))} /></label>}
          <div className="form-grid"><label><span>宽度</span><input type="number" min={64} max={7680} step={2} value={width} onChange={(event) => setWidth(Number(event.target.value))} /></label><label><span>高度</span><input type="number" min={64} max={7680} step={2} value={height} onChange={(event) => setHeight(Number(event.target.value))} /></label></div>
          <label><span>帧率</span><Select label="帧率" value={String(fps)} onChange={(value) => setFps(Number(value))} options={OUTPUT_FPS_OPTIONS.map((value) => ({ value: String(value), label: `${value} fps` }))} /></label>
          <fieldset><legend>动效主题</legend>
            <div className="motion-theme-presets">{THEME_PRESETS.map((preset) => <button key={preset.skin} type="button" className={theme.skin === preset.skin ? "active" : ""} aria-pressed={theme.skin === preset.skin} onClick={() => setTheme(motionThemeWithColorPreset(theme, preset.skin))}><span className="motion-theme-preset-swatches" aria-hidden>{Object.entries(MOTION_THEME_COLOR_PRESETS[preset.skin]).slice(0, 5).map(([role, color]) => <i key={role} style={{ backgroundColor: color }} />)}</span><strong>{preset.label}</strong><small>应用默认配色</small></button>)}</div>
            <div className="form-grid"><label><span>视觉骨架</span><Select label="动效视觉骨架" value={theme.style} onChange={(value) => setTheme({ ...theme, style: value as MotionStyle })} options={STYLE_OPTIONS} /></label><label><span>字体</span><Select label="动效字体" value={theme.font} onChange={(value) => setTheme({ ...theme, font: value as MotionFont })} options={FONT_OPTIONS} /></label></div>
            <div className="motion-theme-colors">
              <ThemeColor label="文字" value={theme.colors.text} onChange={(text) => setTheme({ ...theme, colors: { ...theme.colors, text } })} />
              <ThemeColor label="卡片底色" value={theme.colors.surface} onChange={(surface) => setTheme({ ...theme, colors: { ...theme.colors, surface } })} />
              <ThemeColor label="数据" value={theme.colors.data} onChange={(data) => setTheme({ ...theme, colors: { ...theme.colors, data } })} />
              <ThemeColor label="观点" value={theme.colors.opinion} onChange={(opinion) => setTheme({ ...theme, colors: { ...theme.colors, opinion } })} />
              <ThemeColor label="警示" value={theme.colors.warning} onChange={(warning) => setTheme({ ...theme, colors: { ...theme.colors, warning } })} />
              <ThemeColor label="辅助" value={theme.colors.auxiliary} onChange={(auxiliary) => setTheme({ ...theme, colors: { ...theme.colors, auxiliary } })} />
            </div>
          </fieldset>
          <div className="dialog-actions"><Dialog.Close className="button secondary" type="button">取消</Dialog.Close><button className="button primary" type="submit">应用画布</button></div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

function ThemeColor({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><span>{label}</span><input aria-label={`动效${label}颜色`} type="color" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
