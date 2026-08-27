import { Lock, LockOpen, SlidersHorizontal } from "lucide-react";
import type { EffectDefinition } from "@/domain/effects";
import type { AudioClip, EffectClip, GeneratedBlock, ImageClip, MediaAsset, SubtitleClip, VideoClip } from "@/domain/project";
import { selectedClip, useEditorStore } from "@/stores/editorStore";
import { useEffectLibraryStore } from "@/stores/effectLibraryStore";
import { CAMERA_PRESETS, cameraMotionForPreset, type CameraMotion, type CameraPresetId } from "@/domain/camera";

export function InspectorPanel() {
  const project = useEditorStore((state) => state.project);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const updateEffect = useEditorStore((state) => state.updateEffect);
  const updateVideo = useEditorStore((state) => state.updateVideo);
  const updateImage = useEditorStore((state) => state.updateImage);
  const updateAudio = useEditorStore((state) => state.updateAudio);
  const updateGenerated = useEditorStore((state) => state.updateGenerated);
  const updateGeneratedScene = useEditorStore((state) => state.updateGeneratedScene);
  const updateSubtitle = useEditorStore((state) => state.updateSubtitle);
  const effects = useEffectLibraryStore((state) => state.effects);
  const clip = selectedClip(project, selectedClipId);

  function patchEffect(patch: Partial<EffectClip>) {
    if (clip?.kind === "effect") updateEffect(clip.id, patch);
  }
  function patchVideo(patch: Partial<VideoClip>) {
    if (clip?.kind === "video") updateVideo(clip.id, patch);
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
      {clip?.kind === "effect" && <div className="inspector-content">
        <div className="selection-heading"><span className="type-dot effect" /><div><strong>{clip.label}</strong><small>动效片段</small></div></div>
        <div className="two-column"><NumberField label="开始时间" value={clip.startUs / 1_000_000} min={0} step={0.1} suffix="s" onChange={(value) => patchEffect({ startUs: Math.round(value * 1_000_000) })} /><NumberField label="持续时间" value={clip.durationUs / 1_000_000} min={0.1} step={0.1} suffix="s" onChange={(value) => patchEffect({ durationUs: Math.round(value * 1_000_000) })} /></div>
        <label><span>文字</span><textarea rows={3} value={clip.text} onChange={(event) => patchEffect({ text: event.target.value })} /></label>
        <div className="two-column"><label><span>文字颜色</span><input type="color" value={clip.color} onChange={(event) => patchEffect({ color: event.target.value })} /></label><label><span>强调色</span><input type="color" value={clip.accentColor} onChange={(event) => patchEffect({ accentColor: event.target.value })} /></label></div>
        <RangeField label="字号" value={clip.fontSize} min={18} max={120} suffix="px" onChange={(fontSize) => patchEffect({ fontSize })} />
        <RangeField label="速度" value={clip.speed} min={0.25} max={3} step={0.05} suffix="×" onChange={(speed) => patchEffect({ speed })} />
        <RangeField label="水平位置" value={clip.transform.x} min={0} max={100} suffix="%" onChange={(x) => patchEffect({ transform: { ...clip.transform, x } })} />
        <RangeField label="垂直位置" value={clip.transform.y} min={0} max={100} suffix="%" onChange={(y) => patchEffect({ transform: { ...clip.transform, y } })} />
        <RangeField label="大小" value={clip.transform.scale} min={0.3} max={3} step={0.05} suffix="×" onChange={(scale) => patchEffect({ transform: { ...clip.transform, scale } })} />
        <RangeField label="旋转" value={clip.transform.rotation} min={-180} max={180} step={1} suffix="°" onChange={(rotation) => patchEffect({ transform: { ...clip.transform, rotation } })} />
        <RangeField label="透明度" value={clip.transform.opacity} min={0} max={1} step={0.05} suffix="" onChange={(opacity) => patchEffect({ transform: { ...clip.transform, opacity } })} />
      </div>}
      {clip?.kind === "generated" && <GeneratedInspector clip={clip} assets={project.assets} effects={effects} onPatch={patchGenerated} onScenePatch={(sceneId, patch) => updateGeneratedScene(clip.id, sceneId, patch)} />}
      {clip?.kind === "video" && <div className="inspector-content"><div className="selection-heading"><span className="type-dot video" /><div><strong>{clip.label}</strong><small>视频片段</small></div></div><div className="two-column"><NumberField label="开始时间" value={clip.startUs / 1_000_000} min={0} step={0.1} suffix="s" onChange={(value) => patchVideo({ startUs: Math.round(value * 1_000_000) })} /><NumberField label="片段时长" value={clip.durationUs / 1_000_000} min={0.1} step={0.1} suffix="s" onChange={(value) => patchVideo({ durationUs: Math.round(value * 1_000_000) })} /></div><NumberField label="源入点" value={clip.sourceInUs / 1_000_000} min={0} step={0.1} suffix="s" onChange={(value) => patchVideo({ sourceInUs: Math.round(value * 1_000_000) })} /><RangeField label="播放速度" value={clip.playbackRate} min={0.25} max={4} step={0.05} suffix="×" onChange={(playbackRate) => patchVideo({ playbackRate })} /><RangeField label="音量" value={clip.volume} min={0} max={2} step={0.05} suffix="×" onChange={(volume) => patchVideo({ volume })} /><label><span>画面适配</span><select value={clip.fit} onChange={(event) => patchVideo({ fit: event.target.value as VideoClip["fit"] })}><option value="cover">填满画布</option><option value="contain">完整显示</option></select></label><CameraFields value={clip.camera} onChange={(camera) => patchVideo({ camera })} /></div>}
      {clip?.kind === "image" && <div className="inspector-content"><div className="selection-heading"><span className="type-dot image" /><div><strong>{clip.label}</strong><small>图片贴图</small></div></div><div className="two-column"><NumberField label="开始时间" value={clip.startUs / 1_000_000} min={0} step={0.05} suffix="s" onChange={(value) => patchImage({ startUs: Math.round(value * 1_000_000) })} /><NumberField label="持续时间" value={clip.durationUs / 1_000_000} min={0.1} step={0.05} suffix="s" onChange={(value) => patchImage({ durationUs: Math.round(value * 1_000_000) })} /></div><label><span>入场动效</span><select value={clip.entrance} onChange={(event) => patchImage({ entrance: event.target.value as ImageClip["entrance"] })}><option value="pop">弹出</option><option value="slide-left">左侧滑入</option><option value="fade-up">向上淡入</option><option value="none">无</option></select></label><RangeField label="动效速度" value={clip.speed} min={0.25} max={3} step={0.05} suffix="×" onChange={(speed) => patchImage({ speed })} /><RangeField label="水平位置" value={clip.transform.x} min={0} max={100} suffix="%" onChange={(x) => patchImage({ transform: { ...clip.transform, x } })} /><RangeField label="垂直位置" value={clip.transform.y} min={0} max={100} suffix="%" onChange={(y) => patchImage({ transform: { ...clip.transform, y } })} /><RangeField label="大小" value={clip.transform.scale} min={0.1} max={3} step={0.05} suffix="×" onChange={(scale) => patchImage({ transform: { ...clip.transform, scale } })} /><RangeField label="旋转" value={clip.transform.rotation} min={-180} max={180} step={1} suffix="°" onChange={(rotation) => patchImage({ transform: { ...clip.transform, rotation } })} /><RangeField label="透明度" value={clip.transform.opacity} min={0} max={1} step={0.05} suffix="" onChange={(opacity) => patchImage({ transform: { ...clip.transform, opacity } })} /></div>}
      {clip?.kind === "audio" && <div className="inspector-content"><div className="selection-heading"><span className="type-dot audio" /><div><strong>{clip.label}</strong><small>音频片段</small></div></div><div className="two-column"><NumberField label="开始时间" value={clip.startUs / 1_000_000} min={0} step={0.05} suffix="s" onChange={(value) => patchAudio({ startUs: Math.round(value * 1_000_000) })} /><NumberField label="片段时长" value={clip.durationUs / 1_000_000} min={0.1} step={0.05} suffix="s" onChange={(value) => patchAudio({ durationUs: Math.round(value * 1_000_000) })} /></div><NumberField label="源入点" value={clip.sourceInUs / 1_000_000} min={0} step={0.05} suffix="s" onChange={(value) => patchAudio({ sourceInUs: Math.round(value * 1_000_000) })} /><RangeField label="播放速度" value={clip.playbackRate} min={0.25} max={4} step={0.05} suffix="×" onChange={(playbackRate) => patchAudio({ playbackRate })} /><RangeField label="音量" value={clip.volume} min={0} max={2} step={0.05} suffix="×" onChange={(volume) => patchAudio({ volume })} /><div className="two-column"><NumberField label="淡入" value={clip.fadeInUs / 1_000_000} min={0} max={clip.durationUs / 1_000_000} step={0.1} suffix="s" onChange={(value) => patchAudio({ fadeInUs: Math.round(value * 1_000_000) })} /><NumberField label="淡出" value={clip.fadeOutUs / 1_000_000} min={0} max={clip.durationUs / 1_000_000} step={0.1} suffix="s" onChange={(value) => patchAudio({ fadeOutUs: Math.round(value * 1_000_000) })} /></div><label><span>混音角色</span><select value={clip.role} onChange={(event) => patchAudio({ role: event.target.value as AudioClip["role"] })}><option value="voice">人声/配音</option><option value="music">背景音乐（自动闪避人声）</option><option value="sound">音效</option></select></label></div>}
      {clip?.kind === "subtitle" && <div className="inspector-content"><div className="selection-heading"><span className="type-dot subtitle" /><div><strong>{clip.label}</strong><small>字幕片段</small></div></div><div className="two-column"><NumberField label="开始时间" value={clip.startUs / 1_000_000} min={0} step={0.05} suffix="s" onChange={(value) => patchSubtitle({ startUs: Math.round(value * 1_000_000) })} /><NumberField label="持续时间" value={clip.durationUs / 1_000_000} min={0.1} step={0.05} suffix="s" onChange={(value) => patchSubtitle({ durationUs: Math.round(value * 1_000_000) })} /></div><label><span>字幕文字</span><textarea rows={4} value={clip.text} onChange={(event) => patchSubtitle({ text: event.target.value, label: event.target.value })} /></label><div className="two-column"><label><span>文字颜色</span><input type="color" value={clip.color} onChange={(event) => patchSubtitle({ color: event.target.value })} /></label><label><span>背景颜色</span><input type="color" value={clip.backgroundColor} onChange={(event) => patchSubtitle({ backgroundColor: event.target.value })} /></label></div><RangeField label="字号" value={clip.fontSize} min={18} max={100} suffix="px" onChange={(fontSize) => patchSubtitle({ fontSize })} /><RangeField label="垂直位置" value={clip.positionY} min={10} max={96} suffix="%" onChange={(positionY) => patchSubtitle({ positionY })} /></div>}
    </aside>
  );
}

function GeneratedInspector({ clip, assets, effects, onPatch, onScenePatch }: {
  clip: GeneratedBlock;
  assets: MediaAsset[];
  effects: EffectDefinition[];
  onPatch: (patch: Partial<GeneratedBlock>) => void;
  onScenePatch: (sceneId: string, patch: Partial<GeneratedBlock["scenes"][number]>) => void;
}) {
  const videoAssets = assets.filter((asset) => asset.kind === "video" && !asset.missing);
  return <div className="inspector-content">
    <div className="selection-heading"><span className="type-dot generated" /><div><strong>{clip.label}</strong><small>AI 复合片段</small></div></div>
    <label><span>文章</span><textarea rows={5} value={clip.article} onChange={(event) => onPatch({ article: event.target.value, locked: true })} /></label>
    <label><span>口播</span><textarea rows={4} value={clip.narration} onChange={(event) => onPatch({ narration: event.target.value, locked: true })} /></label>
    <section className="generated-scene-editors"><span>分镜 · {clip.scenes.length}</span>{clip.scenes.map((scene, index) => {
      const media = videoAssets.find((asset) => asset.id === scene.mediaAssetId);
      return <details key={scene.id} open={index === 0}>
        <summary><b>{index + 1}</b><span>{scene.title}</span><small>{(scene.durationUs / 1_000_000).toFixed(1)}s</small></summary>
        <div className="generated-scene-fields">
          <label><span>画面文字</span><input value={scene.title} onChange={(event) => onScenePatch(scene.id, { title: event.target.value })} /></label>
          <label><span>分镜口播</span><textarea rows={2} value={scene.narration} onChange={(event) => onScenePatch(scene.id, { narration: event.target.value })} /></label>
          <div className="two-column"><NumberField label="时长" value={scene.durationUs / 1_000_000} min={0.5} max={60} step={0.5} suffix="s" onChange={(value) => onScenePatch(scene.id, { durationUs: Math.round(value * 1_000_000) })} /><label><span>动效类型</span><select value={scene.effectId} onChange={(event) => { const effect = effects.find((item) => item.id === event.target.value); if (effect) onScenePatch(scene.id, { effectId: effect.id, recipe: structuredClone(effect.recipe) }); }}>{effects.map((effect) => <option key={effect.id} value={effect.id}>{effect.name}</option>)}</select></label></div>
          <label><span>本地视频素材</span><select value={scene.mediaAssetId ?? ""} onChange={(event) => onScenePatch(scene.id, { mediaAssetId: event.target.value || undefined, mediaSourceInUs: 0 })}><option value="">不使用素材</option>{videoAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
          {media && <><div className="two-column"><NumberField label="素材入点" value={scene.mediaSourceInUs / 1_000_000} min={0} max={Math.max(0, (media.durationUs - 1) / 1_000_000)} step={0.1} suffix="s" onChange={(value) => onScenePatch(scene.id, { mediaSourceInUs: Math.min(Math.round(value * 1_000_000), Math.max(0, media.durationUs - 1)) })} /><label><span>画面适配</span><select value={scene.mediaFit} onChange={(event) => onScenePatch(scene.id, { mediaFit: event.target.value as "cover" | "contain" })}><option value="cover">填满画布</option><option value="contain">完整显示</option></select></label></div><RangeField label="素材音量" value={scene.mediaVolume} min={0} max={2} step={0.05} suffix="×" onChange={(mediaVolume) => onScenePatch(scene.id, { mediaVolume })} /><CameraFields value={scene.camera} onChange={(camera) => onScenePatch(scene.id, { camera })} /></>}
          <div className="two-column"><label><span>文字颜色</span><input type="color" value={scene.textColor} onChange={(event) => onScenePatch(scene.id, { textColor: event.target.value })} /></label><label><span>强调色</span><input type="color" value={scene.accentColor} onChange={(event) => onScenePatch(scene.id, { accentColor: event.target.value })} /></label></div>
          <RangeField label="字号" value={scene.fontSize} min={18} max={120} suffix="px" onChange={(fontSize) => onScenePatch(scene.id, { fontSize })} />
          <RangeField label="速度" value={scene.speed} min={0.25} max={3} step={0.05} suffix="×" onChange={(speed) => onScenePatch(scene.id, { speed })} />
          <RangeField label="水平位置" value={scene.transform.x} min={0} max={100} suffix="%" onChange={(x) => onScenePatch(scene.id, { transform: { ...scene.transform, x } })} />
          <RangeField label="垂直位置" value={scene.transform.y} min={0} max={100} suffix="%" onChange={(y) => onScenePatch(scene.id, { transform: { ...scene.transform, y } })} />
          <RangeField label="大小" value={scene.transform.scale} min={0.3} max={3} step={0.05} suffix="×" onChange={(scale) => onScenePatch(scene.id, { transform: { ...scene.transform, scale } })} />
          <RangeField label="旋转" value={scene.transform.rotation} min={-180} max={180} suffix="°" onChange={(rotation) => onScenePatch(scene.id, { transform: { ...scene.transform, rotation } })} />
          <RangeField label="透明度" value={scene.transform.opacity} min={0} max={1} step={0.05} suffix="" onChange={(opacity) => onScenePatch(scene.id, { transform: { ...scene.transform, opacity } })} />
        </div>
      </details>;
    })}</section>
    <button className="wide-action" type="button" onClick={() => onPatch({ locked: !clip.locked })}>{clip.locked ? <Lock size={13} /> : <LockOpen size={13} />}{clip.locked ? "已锁定人工调整" : "锁定当前内容"}</button>
  </div>;
}

function NumberField({ label, value, min, max, step, suffix, onChange }: { label: string; value: number; min?: number; max?: number; step?: number; suffix: string; onChange: (value: number) => void }) {
  return <label className="number-field"><span>{label}</span><span><input type="number" value={Number(value.toFixed(3))} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /><i>{suffix}</i></span></label>;
}

function CameraFields({ value, onChange }: { value: CameraMotion; onChange: (value: CameraMotion) => void }) {
  const patch = (next: Partial<CameraMotion>) => onChange({ ...value, ...next });
  return <section className="camera-fields">
    <span>镜头运动</span>
    <label><span>运镜预设</span><select value={value.preset} onChange={(event) => onChange(cameraMotionForPreset(event.target.value as CameraPresetId))}>{CAMERA_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select></label>
    <div className="two-column"><NumberField label="起始缩放" value={value.startScale} min={1} max={3} step={0.01} suffix="×" onChange={(startScale) => patch({ startScale })} /><NumberField label="结束缩放" value={value.endScale} min={1} max={3} step={0.01} suffix="×" onChange={(endScale) => patch({ endScale })} /></div>
    <div className="two-column"><NumberField label="起始水平" value={value.startX} min={-100} max={100} step={1} suffix="%" onChange={(startX) => patch({ startX })} /><NumberField label="结束水平" value={value.endX} min={-100} max={100} step={1} suffix="%" onChange={(endX) => patch({ endX })} /></div>
    <div className="two-column"><NumberField label="起始垂直" value={value.startY} min={-100} max={100} step={1} suffix="%" onChange={(startY) => patch({ startY })} /><NumberField label="结束垂直" value={value.endY} min={-100} max={100} step={1} suffix="%" onChange={(endY) => patch({ endY })} /></div>
    <label><span>运镜缓动</span><select value={value.easing} onChange={(event) => patch({ easing: event.target.value as CameraMotion["easing"] })}><option value="linear">匀速</option><option value="ease-in">渐快</option><option value="ease-out">渐慢</option><option value="ease-in-out">平滑</option></select></label>
  </section>;
}

function RangeField({ label, value, min, max, step = 1, suffix, onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix: string; onChange: (value: number) => void }) {
  return <label className="range-field"><span>{label}<output>{Number(value.toFixed(2))}{suffix}</output></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
