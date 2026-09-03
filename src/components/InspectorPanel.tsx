import { CircleUserRound, Clock3, Columns2, DiamondPlus, Expand, Focus, PictureInPicture2, ScanSearch, Search, SlidersHorizontal, SunMedium, Trash2, ZoomIn } from "lucide-react";
import { Select } from "@/components/Select";
import { EASING_LABELS, EASING_NAMES } from "@/domain/easing";
import type { ChartSpec } from "@/domain/effects";
import type { AudioClip, EffectClip, GeneratedBlock, ImageClip, SceneClip, SubtitleClip, TransformProps, VideoClip, VisualTransformKeyframe } from "@/domain/project";
import { selectedClip, useEditorStore } from "@/stores/editorStore";
import { upsertVisualKeyframe, visualTransformAt } from "@/domain/transforms";
import { activeVideoPresentationCue, DEFAULT_EFFECT_BACKDROP, VIDEO_MOTION_PRESETS, videoMotionPresetUsesFocusPoint, videoPresentationAt, type VideoMotionPresetId } from "@/domain/videoPresentation";
import { subtitleStyle } from "@/domain/videoDecorations";
import { effectControlsFor } from "@/effects/registry";

const EASING_OPTIONS = EASING_NAMES.map((name) => ({ value: name, label: EASING_LABELS[name] }));

const ENTRANCE_OPTIONS = [
  { value: "pop", label: "弹出" },
  { value: "slide-left", label: "左侧滑入" },
  { value: "fade-up", label: "向上淡入" },
  { value: "none", label: "无" }
];

const AUDIO_ROLE_OPTIONS = [
  { value: "voice", label: "人声/配音" },
  { value: "music", label: "背景音乐（自动闪避人声）" },
  { value: "sound", label: "音效" }
];

const SUBTITLE_STYLE_OPTIONS = [
  { value: "classic", label: "经典字幕" },
  { value: "bold", label: "重点强调" },
  { value: "minimal", label: "简洁无底" }
];

const MOTION_COLOR_ROLE_OPTIONS = [
  { value: "data", label: "数据色" },
  { value: "opinion", label: "观点色" },
  { value: "warning", label: "警示色" },
  { value: "auxiliary", label: "辅助色" },
  { value: "custom", label: "自定义颜色" }
];

const VIDEO_MOTION_ICONS = {
  "full-screen": Expand,
  "zoom-to-full": ZoomIn,
  "presenter-circle-bottom-right": CircleUserRound,
  "picture-in-picture-top-right": PictureInPicture2,
  "split-left": Columns2,
  "split-right": Columns2,
  "slow-push-in": ScanSearch,
  "screen-magnify": Search,
  "screen-spotlight": SunMedium,
  "screen-focus": Focus
} satisfies Record<VideoMotionPresetId, typeof Expand>;

export function InspectorPanel() {
  const project = useEditorStore((state) => state.project);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const updateEffect = useEditorStore((state) => state.updateEffect);
  const updateScene = useEditorStore((state) => state.updateScene);
  const updateImage = useEditorStore((state) => state.updateImage);
  const updateAudio = useEditorStore((state) => state.updateAudio);
  const updateGenerated = useEditorStore((state) => state.updateGenerated);
  const updateSubtitle = useEditorStore((state) => state.updateSubtitle);
  const clip = selectedClip(project, selectedClipId);

  function patchEffect(patch: Partial<EffectClip>) {
    if (clip?.kind === "effect") updateEffect(clip.id, patch);
  }
  function patchScene(patch: Partial<SceneClip>) {
    if (clip?.kind === "scene") updateScene(clip.id, patch);
  }
  function patchImage(patch: Partial<ImageClip>) {
    if (clip?.kind === "image") updateImage(clip.id, patch);
  }
  function patchAudio(patch: Partial<AudioClip>) {
    if (clip?.kind === "audio") updateAudio(clip.id, patch);
  }
  function patchGenerated(patch: Partial<GeneratedBlock>) {
    if (clip?.kind === "generated") updateGenerated(clip.id, patch);
  }
  function patchSubtitle(patch: Partial<SubtitleClip>) {
    if (clip?.kind === "subtitle") updateSubtitle(clip.id, patch);
  }

  return (
    <aside className="inspector-panel panel-border">
      <header><SlidersHorizontal size={16} /><strong>属性</strong></header>
      {!clip && <div className="inspector-empty"><SlidersHorizontal size={22} /><p>选择时间线或画布中的内容</p></div>}
      {clip?.kind === "scene" && <SceneInspector clip={clip} onPatch={patchScene} />}
      {clip?.kind === "effect" && <EffectInspectorAtPlayhead clip={clip} onPatch={patchEffect} />}
      {clip?.kind === "generated" && <GeneratedInspector clip={clip} onPatch={patchGenerated} />}
      {clip?.kind === "video" && <VideoInspectorAtPlayhead clip={clip} />}
      {clip?.kind === "image" && <div className="inspector-content"><div className="selection-heading"><span className="type-dot image" /><div><strong>{clip.label}</strong><small>图片贴图</small></div></div><div className="two-column"><NumberField label="开始时间" value={clip.startUs / 1_000_000} min={0} step={0.05} suffix="s" onChange={(value) => patchImage({ startUs: Math.round(value * 1_000_000) })} /><NumberField label="持续时间" value={clip.durationUs / 1_000_000} min={0.1} step={0.05} suffix="s" onChange={(value) => patchImage({ durationUs: Math.round(value * 1_000_000) })} /></div><label><span>入场动效</span><Select label="入场动效" value={clip.entrance} onChange={(value) => patchImage({ entrance: value as ImageClip["entrance"] })} options={ENTRANCE_OPTIONS} /></label><RangeField label="动效速度" value={clip.speed} min={0.25} max={3} step={0.05} suffix="×" onChange={(speed) => patchImage({ speed })} /><RangeField label="水平位置" value={clip.transform.x} min={0} max={100} suffix="%" onChange={(x) => patchImage({ transform: { ...clip.transform, x } })} /><RangeField label="垂直位置" value={clip.transform.y} min={0} max={100} suffix="%" onChange={(y) => patchImage({ transform: { ...clip.transform, y } })} /><RangeField label="大小" value={clip.transform.scale} min={0.1} max={3} step={0.05} suffix="×" onChange={(scale) => patchImage({ transform: { ...clip.transform, scale } })} /><RangeField label="旋转" value={clip.transform.rotation} min={-180} max={180} step={1} suffix="°" onChange={(rotation) => patchImage({ transform: { ...clip.transform, rotation } })} /><RangeField label="透明度" value={clip.transform.opacity} min={0} max={1} step={0.05} suffix="" onChange={(opacity) => patchImage({ transform: { ...clip.transform, opacity } })} /></div>}
      {clip?.kind === "audio" && <div className="inspector-content"><div className="selection-heading"><span className="type-dot audio" /><div><strong>{clip.label}</strong><small>音频片段</small></div></div><div className="two-column"><NumberField label="开始时间" value={clip.startUs / 1_000_000} min={0} step={0.05} suffix="s" onChange={(value) => patchAudio({ startUs: Math.round(value * 1_000_000) })} /><NumberField label="片段时长" value={clip.durationUs / 1_000_000} min={0.1} step={0.05} suffix="s" onChange={(value) => patchAudio({ durationUs: Math.round(value * 1_000_000) })} /></div><NumberField label="源入点" value={clip.sourceInUs / 1_000_000} min={0} step={0.05} suffix="s" onChange={(value) => patchAudio({ sourceInUs: Math.round(value * 1_000_000) })} /><RangeField label="播放速度" value={clip.playbackRate} min={0.25} max={4} step={0.05} suffix="×" onChange={(playbackRate) => patchAudio({ playbackRate })} /><RangeField label="音量" value={clip.volume} min={0} max={2} step={0.05} suffix="×" onChange={(volume) => patchAudio({ volume })} /><div className="two-column"><NumberField label="淡入" value={clip.fadeInUs / 1_000_000} min={0} max={clip.durationUs / 1_000_000} step={0.1} suffix="s" onChange={(value) => patchAudio({ fadeInUs: Math.round(value * 1_000_000) })} /><NumberField label="淡出" value={clip.fadeOutUs / 1_000_000} min={0} max={clip.durationUs / 1_000_000} step={0.1} suffix="s" onChange={(value) => patchAudio({ fadeOutUs: Math.round(value * 1_000_000) })} /></div><label><span>混音角色</span><Select label="混音角色" value={clip.role} onChange={(value) => patchAudio({ role: value as AudioClip["role"] })} options={AUDIO_ROLE_OPTIONS} /></label></div>}
      {clip?.kind === "subtitle" && <SubtitleInspector clip={clip} onPatch={patchSubtitle} />}
    </aside>
  );
}

function SubtitleInspector({ clip, onPatch }: { clip: SubtitleClip; onPatch: (patch: Partial<SubtitleClip>) => void }) {
  const style = subtitleStyle(clip);
  return <div className="inspector-content subtitle-inspector">
    <div className="selection-heading"><span className="type-dot subtitle" /><div><strong>{clip.label}</strong><small>字幕片段</small></div></div>
    <div className="two-column"><NumberField label="开始时间" value={clip.startUs / 1_000_000} min={0} step={0.05} suffix="s" onChange={(value) => onPatch({ startUs: Math.round(value * 1_000_000) })} /><NumberField label="持续时间" value={clip.durationUs / 1_000_000} min={0.1} step={0.05} suffix="s" onChange={(value) => onPatch({ durationUs: Math.round(value * 1_000_000) })} /></div>
    <label><span>字幕文字</span><textarea rows={4} value={clip.text} onChange={(event) => onPatch({ text: event.target.value, label: event.target.value })} /></label>
    <label><span>样式预设</span><Select label="字幕样式预设" value={style.stylePreset} onChange={(value) => onPatch({ stylePreset: value as SubtitleClip["stylePreset"] })} options={SUBTITLE_STYLE_OPTIONS} /></label>
    <label><span>高亮关键词</span><input aria-label="高亮关键词" value={style.highlightWords.join("，")} placeholder="多个关键词用逗号分隔" onChange={(event) => onPatch({ highlightWords: event.target.value.split(/[，,]/u).map((word) => word.trim()).filter(Boolean).slice(0, 8) })} /></label>
    <div className="two-column"><label><span>文字颜色</span><input type="color" value={clip.color} onChange={(event) => onPatch({ color: event.target.value })} /></label><label><span>关键词颜色</span><input type="color" value={style.highlightColor} onChange={(event) => onPatch({ highlightColor: event.target.value })} /></label></div>
    <div className="two-column"><label><span>背景颜色</span><input type="color" value={clip.backgroundColor} onChange={(event) => onPatch({ backgroundColor: event.target.value })} /></label><label><span>描边颜色</span><input type="color" value={style.outlineColor} onChange={(event) => onPatch({ outlineColor: event.target.value })} /></label></div>
    <RangeField label="字号" value={clip.fontSize} min={18} max={100} suffix="px" onChange={(fontSize) => onPatch({ fontSize })} />
    <RangeField label="描边宽度" value={style.outlineWidth} min={0} max={8} step={0.5} suffix="px" onChange={(outlineWidth) => onPatch({ outlineWidth })} />
    {style.stylePreset !== "minimal" && <><RangeField label="背景透明度" value={style.backgroundOpacity} min={0} max={1} step={0.05} suffix="" onChange={(backgroundOpacity) => onPatch({ backgroundOpacity })} /><RangeField label="背景圆角" value={style.borderRadius} min={0} max={24} step={1} suffix="px" onChange={(borderRadius) => onPatch({ borderRadius })} /></>}
    <RangeField label="垂直位置" value={clip.positionY} min={10} max={96} suffix="%" onChange={(positionY) => onPatch({ positionY })} />
  </div>;
}

function EffectInspectorAtPlayhead({ clip, onPatch }: { clip: EffectClip; onPatch: (patch: Partial<EffectClip>) => void }) {
  const playheadUs = useEditorStore((state) => state.playheadUs);
  const setPlayhead = useEditorStore((state) => state.setPlayhead);
  return <EffectInspector clip={clip} playheadUs={playheadUs} onSeek={setPlayhead} onPatch={onPatch} />;
}

function SceneInspector({ clip, onPatch }: { clip: SceneClip; onPatch: (patch: Partial<SceneClip>) => void }) {
  const patchBackground = (patch: Partial<SceneClip["background"]>) => onPatch({ background: { ...clip.background, ...patch } });
  return <div className="inspector-content">
    <div className="selection-heading"><span className="type-dot scene" /><div><strong>{clip.label}</strong><small>整画布场景背景 · 视频下层</small></div></div>
    <div className="two-column"><NumberField label="开始时间" value={clip.startUs / 1_000_000} min={0} step={0.1} suffix="s" onChange={(value) => onPatch({ startUs: Math.round(value * 1_000_000) })} /><NumberField label="持续时间" value={clip.durationUs / 1_000_000} min={0.1} step={0.1} suffix="s" onChange={(value) => onPatch({ durationUs: Math.round(value * 1_000_000) })} /></div>
    <div className="two-column"><label><span>主背景色</span><input type="color" value={clip.background.primaryColor} onChange={(event) => patchBackground({ primaryColor: event.target.value })} /></label><label><span>纹理颜色</span><input type="color" value={clip.background.secondaryColor} onChange={(event) => patchBackground({ secondaryColor: event.target.value })} /></label></div>
    <label><span>边框 / 强调色</span><input type="color" value={clip.background.borderColor} onChange={(event) => patchBackground({ borderColor: event.target.value })} /></label>
    <RangeField label="纹理强度" value={clip.background.intensity} min={0.1} max={1} step={0.05} suffix="" onChange={(intensity) => patchBackground({ intensity })} />
    <RangeField label="透明度" value={clip.opacity} min={0} max={1} step={0.05} suffix="" onChange={(opacity) => onPatch({ opacity })} />
    <NumberField label="弱化时间" value={(clip.dimAtUs ?? clip.durationUs) / 1_000_000} min={0} max={clip.durationUs / 1_000_000} step={0.1} suffix="s" onChange={(value) => onPatch({ dimAtUs: Math.round(value * 1_000_000) })} />
    <label><span>忽略检查规则</span><input value={(clip.lintOff ?? []).join(", ")} placeholder="例如 group-gap" onChange={(event) => onPatch({ lintOff: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></label>
  </div>;
}

function VideoInspectorAtPlayhead({ clip }: { clip: VideoClip }) {
  const playheadUs = useEditorStore((state) => state.playheadUs);
  const setPlayhead = useEditorStore((state) => state.setPlayhead);
  return <VideoInspector clip={clip} playheadUs={playheadUs} onSeek={setPlayhead} />;
}

function keyframeTransformPatch(base: TransformProps, keyframes: readonly VisualTransformKeyframe[] | undefined, localUs: number, patch: Partial<TransformProps>) {
  const current = visualTransformAt(base, keyframes, localUs);
  const transform = { ...current, ...patch };
  return keyframes?.length
    ? { transform: base, transformKeyframes: upsertVisualKeyframe(keyframes, localUs, transform) }
    : { transform, transformKeyframes: [...(keyframes ?? [])] };
}

function EffectInspector({ clip, playheadUs, onSeek, onPatch }: { clip: EffectClip; playheadUs: number; onSeek: (timeUs: number) => void; onPatch: (patch: Partial<EffectClip>) => void }) {
  const localUs = Math.max(0, Math.min(clip.durationUs, playheadUs - clip.startUs));
  const current = visualTransformAt(clip.transform, clip.transformKeyframes, localUs);
  const patchTransform = (patch: Partial<TransformProps>) => onPatch(keyframeTransformPatch(clip.transform, clip.transformKeyframes, localUs, patch));
  const recipe = clip.recipe;
  const backdrop = { ...DEFAULT_EFFECT_BACKDROP, ...clip.backdrop };
  return <div className="inspector-content">
    <div className="selection-heading"><span className="type-dot effect" /><div><strong>{clip.label}</strong><small>动效片段 · 视频上层</small></div></div>
    <div className="two-column"><NumberField label="开始时间" value={clip.startUs / 1_000_000} min={0} step={0.1} suffix="s" onChange={(value) => onPatch({ startUs: Math.round(value * 1_000_000) })} /><NumberField label="持续时间" value={clip.durationUs / 1_000_000} min={0.1} step={0.1} suffix="s" onChange={(value) => onPatch({ durationUs: Math.round(value * 1_000_000) })} /></div>
    <NumberField label="动效层级" value={clip.zIndex ?? 20} min={0} max={200} step={1} suffix="" onChange={(zIndex) => onPatch({ zIndex })} />
    <label><span>语义配色</span><Select label="动效语义配色" value={clip.colorRole ?? "custom"} onChange={(value) => onPatch({ colorRole: value as EffectClip["colorRole"] })} options={MOTION_COLOR_ROLE_OPTIONS} /></label>
    <EffectRegistryControls clip={clip} onPatch={onPatch} />
    {recipe?.chart && <ChartFields spec={recipe.chart} onChange={(chart) => { if (recipe) onPatch({ recipe: { ...structuredClone(recipe), chart } }); }} />}
    <section className="camera-fields"><span>整体背景</span><label className="check-row"><input type="checkbox" checked={backdrop.enabled} onChange={(event) => onPatch({ backdrop: { ...backdrop, enabled: event.target.checked } })} /><span>启用动效背景</span></label>{backdrop.enabled && <><div className="two-column"><label><span>背景颜色</span><input type="color" value={backdrop.color} onChange={(event) => onPatch({ backdrop: { ...backdrop, color: event.target.value } })} /></label><NumberField label="背景模糊" value={backdrop.blur} min={0} max={30} step={1} suffix="px" onChange={(blur) => onPatch({ backdrop: { ...backdrop, blur } })} /></div><RangeField label="背景透明度" value={backdrop.opacity} min={0} max={1} step={0.05} suffix="" onChange={(opacity) => onPatch({ backdrop: { ...backdrop, opacity } })} /><div className="two-column"><NumberField label="横向留白" value={backdrop.paddingX} min={0} max={100} step={1} suffix="px" onChange={(paddingX) => onPatch({ backdrop: { ...backdrop, paddingX } })} /><NumberField label="纵向留白" value={backdrop.paddingY} min={0} max={60} step={1} suffix="px" onChange={(paddingY) => onPatch({ backdrop: { ...backdrop, paddingY } })} /></div><RangeField label="背景圆角" value={backdrop.radius} min={0} max={40} step={1} suffix="px" onChange={(radius) => onPatch({ backdrop: { ...backdrop, radius } })} /></>}</section>
    <NumberField label="弱化时间" value={(clip.dimAtUs ?? clip.durationUs) / 1_000_000} min={0} max={clip.durationUs / 1_000_000} step={0.1} suffix="s" onChange={(value) => onPatch({ dimAtUs: Math.round(value * 1_000_000) })} />
    <label><span>忽略检查规则</span><input value={(clip.lintOff ?? []).join(", ")} placeholder="例如 unsafe-bounds" onChange={(event) => onPatch({ lintOff: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></label>
    <RangeField label="大小" value={current.scale} min={0.3} max={3} step={0.05} suffix="×" onChange={(scale) => patchTransform({ scale })} />
    <RangeField label="旋转" value={current.rotation} min={-180} max={180} step={1} suffix="°" onChange={(rotation) => patchTransform({ rotation })} />
    <RangeField label="透明度" value={current.opacity} min={0} max={1} step={0.05} suffix="" onChange={(opacity) => patchTransform({ opacity })} />
    <VisualKeyframeEditor clipStartUs={clip.startUs} localUs={localUs} transform={current} keyframes={clip.transformKeyframes ?? []} onSeek={onSeek} onChange={(transformKeyframes) => onPatch({ transformKeyframes })} />
  </div>;
}

function EffectRegistryControls({ clip, onPatch }: { clip: EffectClip; onPatch: (patch: Partial<EffectClip>) => void }) {
  return <>{effectControlsFor(clip).map((control) => {
    if (control.kind === "text") return <label key={control.field}><span>{control.label}</span><textarea rows={control.rows} value={clip.text} onChange={(event) => onPatch({ text: event.target.value })} /></label>;
    if (control.kind === "color") {
      if ((clip.colorRole ?? "custom") !== "custom") return null;
      return <label key={control.field}><span>{control.label}</span><input type="color" value={clip[control.field]} onChange={(event) => onPatch(control.field === "color" ? { color: event.target.value } : { accentColor: event.target.value })} /></label>;
    }
    const value = clip[control.field];
    return <RangeField key={control.field} label={control.label} value={value} min={control.min} max={control.max} step={control.step} suffix={control.suffix === "x" ? "×" : control.suffix} onChange={(next) => onPatch(control.field === "fontSize" ? { fontSize: next } : { speed: next })} />;
  })}</>;
}

const CHART_KIND_OPTIONS: { value: ChartSpec["kind"]; label: string }[] = [
  { value: "counter", label: "数字滚动" },
  { value: "bar", label: "柱状图" },
  { value: "donut", label: "环形图" },
  { value: "line", label: "折线图" }
];

function ChartFields({ spec, onChange }: { spec: ChartSpec; onChange: (next: ChartSpec) => void }) {
  const patch = (next: Partial<ChartSpec>) => onChange({ ...spec, ...next });
  const parseNumbers = (raw: string) => raw.split(/[\n,，、]+/).map((part) => Number(part.trim())).filter((value) => Number.isFinite(value)).slice(0, 24);
  return <section className="visual-keyframes">
    <div><span>图表数据</span>
      <Select label="图表类型" value={spec.kind} onChange={(value) => {
        const kind = value as ChartSpec["kind"];
        const next: ChartSpec = { kind };
        if (kind === "counter") Object.assign(next, { startValue: spec.startValue ?? 0, endValue: spec.endValue ?? 100, suffix: spec.suffix ?? "%" });
        if (kind === "bar") Object.assign(next, { series: spec.series ?? [32, 48, 41, 76], categories: spec.categories, gridLines: 3 });
        if (kind === "donut") Object.assign(next, { series: spec.series ?? [45, 30, 25], categories: spec.categories, suffix: "%" });
        if (kind === "line") Object.assign(next, { series: spec.series ?? [18, 34, 29, 46], categories: spec.categories, gridLines: 3 });
        onChange(next);
      }} options={CHART_KIND_OPTIONS} />
    </div>
    {spec.kind === "counter"
      ? <div className="two-column"><NumberField label="起始值" value={spec.startValue ?? 0} step={1} suffix="" onChange={(startValue) => patch({ startValue })} /><NumberField label="结束值" value={spec.endValue ?? 100} step={1} suffix="" onChange={(endValue) => patch({ endValue })} /></div>
      : <>
        <label><span>数值（逗号或换行分隔）</span><textarea rows={3} value={(spec.series ?? []).join(", ")} onChange={(event) => patch({ series: parseNumbers(event.target.value) })} /></label>
        <label><span>分类标签（可选，与数值对应）</span><textarea rows={2} value={(spec.categories ?? []).join(", ")} onChange={(event) => patch({ categories: event.target.value.split(/[\n,，、]+/).map((item) => item.trim()).filter(Boolean).slice(0, 24) })} /></label>
        {(spec.kind === "bar" || spec.kind === "line") && <NumberField label="纵轴上限（留空自动）" value={spec.maxY ?? 0} min={0} step={10} suffix="" onChange={(maxY) => patch({ maxY: maxY > 0 ? maxY : undefined })} />}
      </>}
    <div className="two-column"><NumberField label="小数位" value={spec.decimals ?? 0} min={0} max={4} step={1} suffix="" onChange={(decimals) => patch({ decimals: Math.max(0, Math.min(4, Math.round(decimals))) })} /><NumberField label="展开时长" value={spec.durationSeconds ?? 1.2} min={0.1} max={6} step={0.1} suffix="s" onChange={(durationSeconds) => patch({ durationSeconds: Math.max(0.1, durationSeconds) })} /></div>
    {(spec.kind === "counter" || spec.kind === "donut") && <div className="two-column"><label><span>前缀</span><input value={spec.prefix ?? ""} maxLength={8} onChange={(event) => patch({ prefix: event.target.value || undefined })} /></label><label><span>后缀 / 单位</span><input value={spec.suffix ?? ""} maxLength={8} onChange={(event) => patch({ suffix: event.target.value || undefined, unit: undefined })} /></label></div>}
  </section>;
}

function VideoInspector({ clip, playheadUs, onSeek }: { clip: VideoClip; playheadUs: number; onSeek: (timeUs: number) => void }) {
  const setFocusPickClip = useEditorStore((state) => state.setFocusPickClip);
  const requestPreview = useEditorStore((state) => state.requestPreview);
  const addVideoPresentationCue = useEditorStore((state) => state.addVideoPresentationCue);
  const updateVideoPresentationCue = useEditorStore((state) => state.updateVideoPresentationCue);
  const removeVideoPresentationCue = useEditorStore((state) => state.removeVideoPresentationCue);
  const localUs = Math.max(0, Math.min(clip.durationUs - 1, playheadUs - clip.startUs));
  const presentation = videoPresentationAt(clip, localUs);
  const activeCue = activeVideoPresentationCue(clip, localUs);
  const transitionEnabled = Boolean(activeCue && activeCue.transitionDurationUs > 0);
  const defaultTransitionDurationUs = activeCue
    ? Math.min(650_000, Math.max(100_000, clip.durationUs - activeCue.offsetUs))
    : 650_000;
  const applyPreset = (presetId: VideoMotionPresetId) => {
    addVideoPresentationCue(clip.id, presetId, localUs);
    setFocusPickClip(videoMotionPresetUsesFocusPoint(presetId) ? clip.id : null);
    requestPreview(clip.startUs + localUs, Math.min(clip.startUs + clip.durationUs, clip.startUs + localUs + 1_200_000));
  };
  return <div className="inspector-content">
    <div className="selection-heading"><span className="type-dot video" /><div><strong>{clip.label}</strong><small>选择一个运镜方案即可直接应用</small></div></div>
    <p className="video-cue-position"><Clock3 size={13} />将在当前时间 {formatCueTime(localUs)} 添加运镜节点</p>
    <div className="video-motion-presets">
      {VIDEO_MOTION_PRESETS.map((preset) => {
        const Icon = VIDEO_MOTION_ICONS[preset.id];
        return <button key={preset.id} type="button" title={preset.description} onClick={() => applyPreset(preset.id)}><Icon size={18} /><span><strong>{preset.name}</strong><small>{preset.description}</small></span></button>;
      })}
    </div>
    {presentation.mask.shape === "circle" && <p className="video-target-note"><CircleUserRound size={14} />拖动画布中的取景中心，调整圆形画面里的人物位置。</p>}
    {presentation.focus.enabled && <p className="video-target-note"><Focus size={14} />点击画面选择区域，之后可继续拖动聚焦点微调。</p>}
    {activeCue && <section className="video-cue-duration">
      <header><span>当前运镜节点</span><small>{VIDEO_MOTION_PRESETS.find((preset) => preset.id === activeCue.presetId)?.name ?? activeCue.presetId}</small></header>
      <label className="check-row video-animation-toggle" title="关闭后在该时间点直接切换到目标布局"><input type="checkbox" checked={transitionEnabled} onChange={(event) => updateVideoPresentationCue(clip.id, activeCue.id, { transitionDurationUs: event.target.checked ? defaultTransitionDurationUs : 0 })} /><span>播放转场动画</span></label>
      {(transitionEnabled || activeCue.focus.enabled) && <div>{transitionEnabled && <NumberField label="过渡时长" value={activeCue.transitionDurationUs / 1_000_000} min={0.1} max={(clip.durationUs - activeCue.offsetUs) / 1_000_000} step={0.05} suffix="s" onChange={(value) => updateVideoPresentationCue(clip.id, activeCue.id, { transitionDurationUs: Math.round(value * 1_000_000) })} />}{activeCue.focus.enabled && <NumberField label="聚焦时长" value={activeCue.focus.durationUs / 1_000_000} min={0.1} max={(clip.durationUs - activeCue.offsetUs) / 1_000_000} step={0.1} suffix="s" onChange={(value) => updateVideoPresentationCue(clip.id, activeCue.id, { focus: { ...activeCue.focus, durationUs: Math.round(value * 1_000_000) } })} />}</div>}
    </section>}
    {(clip.presentationCues?.length ?? 0) > 0 && <section className="video-cue-list"><header><span>运镜时间点</span><small>{clip.presentationCues?.length} 个</small></header>{[...(clip.presentationCues ?? [])].sort((left, right) => left.offsetUs - right.offsetUs).map((cue) => {
      const preset = VIDEO_MOTION_PRESETS.find((candidate) => candidate.id === cue.presetId);
      return <div key={cue.id} className={activeCue?.id === cue.id ? "active" : ""}><button type="button" onClick={() => onSeek(clip.startUs + cue.offsetUs)}><time>{formatCueTime(cue.offsetUs)}</time><span>{preset?.name ?? cue.presetId}</span></button><button type="button" aria-label={`删除 ${formatCueTime(cue.offsetUs)} 的运镜节点`} title="删除运镜节点" onClick={() => removeVideoPresentationCue(clip.id, cue.id)}><Trash2 size={13} /></button></div>;
    })}</section>}
  </div>;
}

function formatCueTime(timeUs: number) {
  const seconds = Math.max(0, timeUs) / 1_000_000;
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${(seconds % 60).toFixed(2).padStart(5, "0")}`;
}

function VisualKeyframeEditor({ clipStartUs, localUs, transform, keyframes, onSeek, onChange }: { clipStartUs: number; localUs: number; transform: TransformProps; keyframes: VisualTransformKeyframe[]; onSeek: (timeUs: number) => void; onChange: (keyframes: VisualTransformKeyframe[]) => void }) {
  const add = () => onChange(upsertVisualKeyframe(keyframes, localUs, transform));
  return <section className="visual-keyframes">
    <div><span><DiamondPlus size={13} />位置与缩放关键帧 · {keyframes.length}</span><button type="button" onClick={add}>添加当前帧</button></div>
    {keyframes.map((frame, index) => <div className="visual-keyframe-row" key={`${frame.offsetUs}-${index}`}>
      <button type="button" onClick={() => onSeek(clipStartUs + frame.offsetUs)}>{(frame.offsetUs / 1_000_000).toFixed(2)}s</button>
      <span>{Math.round(frame.x)}%, {Math.round(frame.y)}% · {frame.scale.toFixed(2)}×</span>
      <Select label={`关键帧 ${index + 1} 缓动`} value={frame.easing} onChange={(value) => onChange(keyframes.map((item, itemIndex) => itemIndex === index ? { ...item, easing: value as VisualTransformKeyframe["easing"] } : item))} options={EASING_OPTIONS} />
      <button type="button" aria-label={`删除关键帧 ${index + 1}`} title="删除关键帧" onClick={() => onChange(keyframes.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={12} /></button>
    </div>)}
    {keyframes.length > 0 && <button className="clear-keyframes" type="button" onClick={() => onChange([])}>清除全部关键帧</button>}
  </section>;
}

function GeneratedInspector({ clip, onPatch }: {
  clip: GeneratedBlock;
  onPatch: (patch: Partial<GeneratedBlock>) => void;
}) {
  return <div className="inspector-content">
    <div className="selection-heading"><span className="type-dot generated" /><div><strong>{clip.label}</strong><small>AI 脚本 · {clip.scenes.length} 条时间字幕</small></div></div>
    <label><span>文章</span><textarea rows={5} value={clip.article} onChange={(event) => onPatch({ article: event.target.value, locked: true })} /></label>
    <label><span>口播</span><textarea rows={4} value={clip.narration} onChange={(event) => onPatch({ narration: event.target.value, locked: true })} /></label>
    <p className="inspector-note">时间字幕、动效、运镜与视频素材已分别写入对应时间线轨道，可直接选择片段调整。</p>
  </div>;
}

function NumberField({ label, value, min, max, step, suffix, onChange }: { label: string; value: number; min?: number; max?: number; step?: number; suffix: string; onChange: (value: number) => void }) {
  return <label className="number-field"><span>{label}</span><span><input type="number" value={Number(value.toFixed(3))} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /><i aria-hidden="true">{suffix}</i></span></label>;
}

function RangeField({ label, value, min, max, step = 1, suffix, onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix: string; onChange: (value: number) => void }) {
  return <label className="range-field"><span>{label}<output>{Number(value.toFixed(2))}{suffix}</output></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
