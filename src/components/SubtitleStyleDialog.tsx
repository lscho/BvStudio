import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Captions, X } from "lucide-react";
import { Select } from "@/components/Select";
import type { SubtitleClip, SubtitleStylePreset } from "@/domain/project";
import { DEFAULT_SUBTITLE_STYLE, subtitleStyle } from "@/domain/videoDecorations";
import { useEditorStore, type SubtitleAppearancePatch } from "@/stores/editorStore";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subtitles: SubtitleClip[];
}

interface SubtitleAppearance {
  stylePreset: SubtitleStylePreset;
  color: string;
  highlightColor: string;
  backgroundColor: string;
  outlineColor: string;
  fontSize: number;
  outlineWidth: number;
  backgroundOpacity: number;
  borderRadius: number;
  positionY: number;
}

const styleOptions = [
  { value: "classic", label: "经典字幕" },
  { value: "bold", label: "重点强调" },
  { value: "minimal", label: "简洁无底" }
];

const defaultAppearance: SubtitleAppearance = {
  stylePreset: DEFAULT_SUBTITLE_STYLE.stylePreset,
  color: "#ffffff",
  highlightColor: DEFAULT_SUBTITLE_STYLE.highlightColor,
  backgroundColor: "#000000",
  outlineColor: DEFAULT_SUBTITLE_STYLE.outlineColor,
  fontSize: 44,
  outlineWidth: DEFAULT_SUBTITLE_STYLE.outlineWidth,
  backgroundOpacity: DEFAULT_SUBTITLE_STYLE.backgroundOpacity,
  borderRadius: DEFAULT_SUBTITLE_STYLE.borderRadius,
  positionY: 88
};

function appearanceFor(subtitle: SubtitleClip | undefined): SubtitleAppearance {
  if (!subtitle) return defaultAppearance;
  const style = subtitleStyle(subtitle);
  return {
    stylePreset: style.stylePreset,
    color: subtitle.color,
    highlightColor: style.highlightColor,
    backgroundColor: subtitle.backgroundColor,
    outlineColor: style.outlineColor,
    fontSize: subtitle.fontSize,
    outlineWidth: style.outlineWidth,
    backgroundOpacity: style.backgroundOpacity,
    borderRadius: style.borderRadius,
    positionY: subtitle.positionY
  };
}

export function SubtitleStyleDialog({ open, onOpenChange, subtitles }: Props) {
  const updateSubtitleAppearance = useEditorStore((state) => state.updateSubtitleAppearance);
  const [appearance, setAppearance] = useState<SubtitleAppearance>(defaultAppearance);

  useEffect(() => {
    if (open) setAppearance(appearanceFor(subtitles[0]));
  }, [open, subtitles]);

  function patch(patchValue: Partial<SubtitleAppearance>) {
    setAppearance((current) => ({ ...current, ...patchValue }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    updateSubtitleAppearance(null, appearance satisfies SubtitleAppearancePatch);
    onOpenChange(false);
  }

  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="dialog-overlay" />
      <Dialog.Content className="dialog-content subtitle-style-dialog" aria-describedby="subtitle-style-description">
        <Dialog.Close className="icon-button dialog-close" aria-label="关闭"><X size={18} /></Dialog.Close>
        <div className="dialog-title-row"><Captions size={18} /><div><Dialog.Title>全局字幕样式</Dialog.Title><Dialog.Description id="subtitle-style-description">统一设置全部未锁定字幕的外观。</Dialog.Description></div></div>
        <form className="settings-form subtitle-global-form" noValidate onSubmit={submit}>
          <label><span>样式预设</span><Select label="全局字幕样式预设" value={appearance.stylePreset} onChange={(value) => patch({ stylePreset: value as SubtitleStylePreset })} options={styleOptions} /></label>
          <div className="subtitle-global-colors">
            <ColorField label="文字" value={appearance.color} onChange={(color) => patch({ color })} />
            <ColorField label="关键词" value={appearance.highlightColor} onChange={(highlightColor) => patch({ highlightColor })} />
            <ColorField label="背景" value={appearance.backgroundColor} onChange={(backgroundColor) => patch({ backgroundColor })} />
            <ColorField label="描边" value={appearance.outlineColor} onChange={(outlineColor) => patch({ outlineColor })} />
          </div>
          <RangeField label="字号" value={appearance.fontSize} min={18} max={100} suffix="px" onChange={(fontSize) => patch({ fontSize })} />
          <RangeField label="垂直位置" value={appearance.positionY} min={10} max={96} suffix="%" onChange={(positionY) => patch({ positionY })} />
          <RangeField label="描边宽度" value={appearance.outlineWidth} min={0} max={8} step={0.5} suffix="px" onChange={(outlineWidth) => patch({ outlineWidth })} />
          {appearance.stylePreset !== "minimal" && <div className="subtitle-global-pair">
            <RangeField label="背景透明度" value={appearance.backgroundOpacity} min={0} max={1} step={0.01} suffix="" onChange={(backgroundOpacity) => patch({ backgroundOpacity })} />
            <RangeField label="背景圆角" value={appearance.borderRadius} min={0} max={24} suffix="px" onChange={(borderRadius) => patch({ borderRadius })} />
          </div>}
          <div className="dialog-actions"><Dialog.Close className="button secondary" type="button">取消</Dialog.Close><button className="button primary" type="submit">应用到全部字幕</button></div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><span>{label}</span><input type="color" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function RangeField({ label, value, min, max, step = 1, suffix, onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix: string; onChange: (value: number) => void }) {
  return <label className="range-field"><span>{label}<output>{Number(value.toFixed(2))}{suffix}</output></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
