import { DiamondPlus, Layers3, Lock, LockOpen, SlidersHorizontal, Trash2 } from "lucide-react";
import type { EffectDefinition } from "@/domain/effects";
import type { AudioClip, EffectClip, GeneratedBlock, ImageClip, MediaAsset, SubtitleClip, TransformProps, VideoClip, VisualTransformKeyframe } from "@/domain/project";
import { selectedClip, useEditorStore } from "@/stores/editorStore";
import { useEffectLibraryStore } from "@/stores/effectLibraryStore";
import { CAMERA_PRESETS, cameraMotionForPreset, type CameraMotion, type CameraPresetId } from "@/domain/camera";
import { createGeneratedEffectLayers } from "@/domain/sceneEffects";
import { DEFAULT_TRANSFORM, VIDEO_LAYOUT_PRESETS, upsertVisualKeyframe, videoLayoutForPreset, visualTransformAt, type VideoLayoutPresetId } from "@/domain/transforms";

export function InspectorPanel() {
  const project = useEditorStore((state) => state.project);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const playheadUs = useEditorStore((state) => state.playheadUs);
  const setPlayhead = useEditorStore((state) => state.setPlayhead);
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
      {clip?.kind === "effect" && <EffectInspector clip={clip} playheadUs={playheadUs} onSeek={setPlayhead} onPatch={patchEffect} />}
      {clip?.kind === "generated" && <GeneratedInspector clip={clip} assets={project.assets} effects={effects} onPatch={patchGenerated} onScenePatch={(sceneId, patch) => updateGeneratedScene(clip.id, sceneId, patch)} />}
      {clip?.kind === "video" && <VideoInspector clip={clip} playheadUs={playheadUs} onSeek={setPlayhead} onPatch={patchVideo} />}
      {clip?.kind === "image" && <div className="inspector-content"><div className="selection-heading"><span className="type-dot image" /><div><strong>{clip.label}</strong><small>图片贴图</small></div></div><div className="two-column"><NumberField label="开始时间" value={clip.startUs / 1_000_000} min={0} step={0.05} suffix="s" onChange={(value) => patchImage({ startUs: Math.round(value * 1_000_000) })} /><NumberField label="持续时间" value={clip.durationUs / 1_000_000} min={0.1} step={0.05} suffix="s" onChange={(value) => patchImage({ durationUs: Math.round(value * 1_000_000) })} /></div><label><span>入场动效</span><select value={clip.entrance} onChange={(event) => patchImage({ entrance: event.target.value as ImageClip["entrance"] })}><option value="pop">弹出</option><option value="slide-left">左侧滑入</option><option value="fade-up">向上淡入</option><option value="none">无</option></select></label><RangeField label="动效速度" value={clip.speed} min={0.25} max={3} step={0.05} suffix="×" onChange={(speed) => patchImage({ speed })} /><RangeField label="水平位置" value={clip.transform.x} min={0} max={100} suffix="%" onChange={(x) => patchImage({ transform: { ...clip.transform, x } })} /><RangeField label="垂直位置" value={clip.transform.y} min={0} max={100} suffix="%" onChange={(y) => patchImage({ transform: { ...clip.transform, y } })} /><RangeField label="大小" value={clip.transform.scale} min={0.1} max={3} step={0.05} suffix="×" onChange={(scale) => patchImage({ transform: { ...clip.transform, scale } })} /><RangeField label="旋转" value={clip.transform.rotation} min={-180} max={180} step={1} suffix="°" onChange={(rotation) => patchImage({ transform: { ...clip.transform, rotation } })} /><RangeField label="透明度" value={clip.transform.opacity} min={0} max={1} step={0.05} suffix="" onChange={(opacity) => patchImage({ transform: { ...clip.transform, opacity } })} /></div>}
      {clip?.kind === "audio" && <div className="inspector-content"><div className="selection-heading"><span className="type-dot audio" /><div><strong>{clip.label}</strong><small>音频片段</small></div></div><div className="two-column"><NumberField label="开始时间" value={clip.startUs / 1_000_000} min={0} step={0.05} suffix="s" onChange={(value) => patchAudio({ startUs: Math.round(value * 1_000_000) })} /><NumberField label="片段时长" value={clip.durationUs / 1_000_000} min={0.1} step={0.05} suffix="s" onChange={(value) => patchAudio({ durationUs: Math.round(value * 1_000_000) })} /></div><NumberField label="源入点" value={clip.sourceInUs / 1_000_000} min={0} step={0.05} suffix="s" onChange={(value) => patchAudio({ sourceInUs: Math.round(value * 1_000_000) })} /><RangeField label="播放速度" value={clip.playbackRate} min={0.25} max={4} step={0.05} suffix="×" onChange={(playbackRate) => patchAudio({ playbackRate })} /><RangeField label="音量" value={clip.volume} min={0} max={2} step={0.05} suffix="×" onChange={(volume) => patchAudio({ volume })} /><div className="two-column"><NumberField label="淡入" value={clip.fadeInUs / 1_000_000} min={0} max={clip.durationUs / 1_000_000} step={0.1} suffix="s" onChange={(value) => patchAudio({ fadeInUs: Math.round(value * 1_000_000) })} /><NumberField label="淡出" value={clip.fadeOutUs / 1_000_000} min={0} max={clip.durationUs / 1_000_000} step={0.1} suffix="s" onChange={(value) => patchAudio({ fadeOutUs: Math.round(value * 1_000_000) })} /></div><label><span>混音角色</span><select value={clip.role} onChange={(event) => patchAudio({ role: event.target.value as AudioClip["role"] })}><option value="voice">人声/配音</option><option value="music">背景音乐（自动闪避人声）</option><option value="sound">音效</option></select></label></div>}
      {clip?.kind === "subtitle" && <div className="inspector-content"><div className="selection-heading"><span className="type-dot subtitle" /><div><strong>{clip.label}</strong><small>字幕片段</small></div></div><div className="two-column"><NumberField label="开始时间" value={clip.startUs / 1_000_000} min={0} step={0.05} suffix="s" onChange={(value) => patchSubtitle({ startUs: Math.round(value * 1_000_000) })} /><NumberField label="持续时间" value={clip.durationUs / 1_000_000} min={0.1} step={0.05} suffix="s" onChange={(value) => patchSubtitle({ durationUs: Math.round(value * 1_000_000) })} /></div><label><span>字幕文字</span><textarea rows={4} value={clip.text} onChange={(event) => patchSubtitle({ text: event.target.value, label: event.target.value })} /></label><div className="two-column"><label><span>文字颜色</span><input type="color" value={clip.color} onChange={(event) => patchSubtitle({ color: event.target.value })} /></label><label><span>背景颜色</span><input type="color" value={clip.backgroundColor} onChange={(event) => patchSubtitle({ backgroundColor: event.target.value })} /></label></div><RangeField label="字号" value={clip.fontSize} min={18} max={100} suffix="px" onChange={(fontSize) => patchSubtitle({ fontSize })} /><RangeField label="垂直位置" value={clip.positionY} min={10} max={96} suffix="%" onChange={(positionY) => patchSubtitle({ positionY })} /></div>}
    </aside>
  );
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
  return <div className="inspector-content">
    <div className="selection-heading"><span className="type-dot effect" /><div><strong>{clip.label}</strong><small>动效片段 · 视频上层</small></div></div>
    <div className="two-column"><NumberField label="开始时间" value={clip.startUs / 1_000_000} min={0} step={0.1} suffix="s" onChange={(value) => onPatch({ startUs: Math.round(value * 1_000_000) })} /><NumberField label="持续时间" value={clip.durationUs / 1_000_000} min={0.1} step={0.1} suffix="s" onChange={(value) => onPatch({ durationUs: Math.round(value * 1_000_000) })} /></div>
    <NumberField label="动效层级" value={clip.zIndex ?? 20} min={0} max={200} step={1} suffix="" onChange={(zIndex) => onPatch({ zIndex })} />
    <label><span>文字</span><textarea rows={3} value={clip.text} onChange={(event) => onPatch({ text: event.target.value })} /></label>
    <div className="two-column"><label><span>文字颜色</span><input type="color" value={clip.color} onChange={(event) => onPatch({ color: event.target.value })} /></label><label><span>强调色</span><input type="color" value={clip.accentColor} onChange={(event) => onPatch({ accentColor: event.target.value })} /></label></div>
    <RangeField label="字号" value={clip.fontSize} min={18} max={120} suffix="px" onChange={(fontSize) => onPatch({ fontSize })} />
    <RangeField label="速度" value={clip.speed} min={0.25} max={3} step={0.05} suffix="×" onChange={(speed) => onPatch({ speed })} />
    <RangeField label="大小" value={current.scale} min={0.3} max={3} step={0.05} suffix="×" onChange={(scale) => patchTransform({ scale })} />
    <RangeField label="旋转" value={current.rotation} min={-180} max={180} step={1} suffix="°" onChange={(rotation) => patchTransform({ rotation })} />
    <RangeField label="透明度" value={current.opacity} min={0} max={1} step={0.05} suffix="" onChange={(opacity) => patchTransform({ opacity })} />
    <VisualKeyframeEditor clipStartUs={clip.startUs} localUs={localUs} transform={current} keyframes={clip.transformKeyframes ?? []} onSeek={onSeek} onChange={(transformKeyframes) => onPatch({ transformKeyframes })} />
  </div>;
}

function VideoInspector({ clip, playheadUs, onSeek, onPatch }: { clip: VideoClip; playheadUs: number; onSeek: (timeUs: number) => void; onPatch: (patch: Partial<VideoClip>) => void }) {
  const base = clip.transform ?? DEFAULT_TRANSFORM;
  const localUs = Math.max(0, Math.min(clip.durationUs, playheadUs - clip.startUs));
  const current = visualTransformAt(base, clip.transformKeyframes, localUs);
  const patchTransform = (patch: Partial<TransformProps>) => onPatch({ ...keyframeTransformPatch(base, clip.transformKeyframes, localUs, patch), layoutPreset: "custom" });
  const applyPreset = (layoutPreset: VideoLayoutPresetId) => {
    const layout = videoLayoutForPreset(layoutPreset, clip.durationUs);
    onPatch({ layoutPreset, ...layout });
  };
  return <div className="inspector-content">
    <div className="selection-heading"><span className="type-dot video" /><div><strong>{clip.label}</strong><small>{(clip.zIndex ?? 0) === 0 ? "主视频画面" : "叠加视频图层"}</small></div></div>
    <div className="two-column"><NumberField label="开始时间" value={clip.startUs / 1_000_000} min={0} step={0.1} suffix="s" onChange={(value) => onPatch({ startUs: Math.round(value * 1_000_000) })} /><NumberField label="片段时长" value={clip.durationUs / 1_000_000} min={0.1} step={0.1} suffix="s" onChange={(value) => onPatch({ durationUs: Math.round(value * 1_000_000) })} /></div>
    <div className="two-column"><NumberField label="源入点" value={clip.sourceInUs / 1_000_000} min={0} step={0.1} suffix="s" onChange={(value) => onPatch({ sourceInUs: Math.round(value * 1_000_000) })} /><NumberField label="视频层级" value={clip.zIndex ?? 0} min={0} max={99} step={1} suffix="" onChange={(zIndex) => onPatch({ zIndex })} /></div>
    <label><span>布局与转场</span><select aria-label="视频布局与转场" value={clip.layoutPreset ?? "full"} onChange={(event) => applyPreset(event.target.value as VideoLayoutPresetId)}>{VIDEO_LAYOUT_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select></label>
    <div className="two-column"><NumberField label="水平位置" value={current.x} min={0} max={100} step={1} suffix="%" onChange={(x) => patchTransform({ x })} /><NumberField label="垂直位置" value={current.y} min={0} max={100} step={1} suffix="%" onChange={(y) => patchTransform({ y })} /></div>
    <RangeField label="图层大小" value={current.scale} min={0.1} max={2} step={0.01} suffix="×" onChange={(scale) => patchTransform({ scale })} />
    <RangeField label="图层旋转" value={current.rotation} min={-180} max={180} step={1} suffix="°" onChange={(rotation) => patchTransform({ rotation })} />
    <RangeField label="图层透明度" value={current.opacity} min={0} max={1} step={0.05} suffix="" onChange={(opacity) => patchTransform({ opacity })} />
    <VisualKeyframeEditor clipStartUs={clip.startUs} localUs={localUs} transform={current} keyframes={clip.transformKeyframes ?? []} onSeek={onSeek} onChange={(transformKeyframes) => onPatch({ transformKeyframes, layoutPreset: "custom" })} />
    <RangeField label="播放速度" value={clip.playbackRate} min={0.25} max={4} step={0.05} suffix="×" onChange={(playbackRate) => onPatch({ playbackRate })} />
    <RangeField label="音量" value={clip.volume} min={0} max={2} step={0.05} suffix="×" onChange={(volume) => onPatch({ volume })} />
    <label><span>画面适配</span><select value={clip.fit} onChange={(event) => onPatch({ fit: event.target.value as VideoClip["fit"] })}><option value="cover">填满图层</option><option value="contain">完整显示</option></select></label>
    <CameraFields value={clip.camera} onChange={(camera) => onPatch({ camera })} />
  </div>;
}

function VisualKeyframeEditor({ clipStartUs, localUs, transform, keyframes, onSeek, onChange }: { clipStartUs: number; localUs: number; transform: TransformProps; keyframes: VisualTransformKeyframe[]; onSeek: (timeUs: number) => void; onChange: (keyframes: VisualTransformKeyframe[]) => void }) {
  const add = () => onChange(upsertVisualKeyframe(keyframes, localUs, transform));
  return <section className="visual-keyframes">
    <div><span><DiamondPlus size={13} />位置与缩放关键帧 · {keyframes.length}</span><button type="button" onClick={add}>添加当前帧</button></div>
    {keyframes.map((frame, index) => <div className="visual-keyframe-row" key={`${frame.offsetUs}-${index}`}>
      <button type="button" onClick={() => onSeek(clipStartUs + frame.offsetUs)}>{(frame.offsetUs / 1_000_000).toFixed(2)}s</button>
      <span>{Math.round(frame.x)}%, {Math.round(frame.y)}% · {frame.scale.toFixed(2)}×</span>
      <select aria-label={`关键帧 ${index + 1} 缓动`} value={frame.easing} onChange={(event) => onChange(keyframes.map((item, itemIndex) => itemIndex === index ? { ...item, easing: event.target.value as VisualTransformKeyframe["easing"] } : item))}><option value="linear">匀速</option><option value="ease-in">渐快</option><option value="ease-out">渐慢</option><option value="ease-in-out">平滑</option></select>
      <button type="button" aria-label={`删除关键帧 ${index + 1}`} title="删除关键帧" onClick={() => onChange(keyframes.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={12} /></button>
    </div>)}
    {keyframes.length > 0 && <button className="clear-keyframes" type="button" onClick={() => onChange([])}>清除全部关键帧</button>}
  </section>;
}

function GeneratedInspector({ clip, assets, effects, onPatch, onScenePatch }: {
  clip: GeneratedBlock;
  assets: MediaAsset[];
  effects: EffectDefinition[];
  onPatch: (patch: Partial<GeneratedBlock>) => void;
  onScenePatch: (sceneId: string, patch: Partial<GeneratedBlock["scenes"][number]>) => void;
}) {
  const videoAssets = assets.filter((asset) => asset.kind === "video" && !asset.missing);
  const atomicEffects = effects.filter((effect) => effect.kind !== "scene");
  const sceneTemplates = effects.filter((effect) => effect.kind === "scene");
  return <div className="inspector-content">
    <div className="selection-heading"><span className="type-dot generated" /><div><strong>{clip.label}</strong><small>AI 复合片段</small></div></div>
    <label><span>文章</span><textarea rows={5} value={clip.article} onChange={(event) => onPatch({ article: event.target.value, locked: true })} /></label>
    <label><span>口播</span><textarea rows={4} value={clip.narration} onChange={(event) => onPatch({ narration: event.target.value, locked: true })} /></label>
    <section className="generated-scene-editors"><span>分镜 · {clip.scenes.length}</span>{clip.scenes.map((scene, index) => {
      const media = videoAssets.find((asset) => asset.id === scene.mediaAssetId);
      const secondaryMedia = videoAssets.find((asset) => asset.id === scene.secondaryMediaAssetId);
      const applyLayers = (layers: ReturnType<typeof createGeneratedEffectLayers>) => {
        const primary = layers[0];
        if (!primary) return;
        onScenePatch(scene.id, {
          title: primary.text,
          effectId: primary.effectId,
          textColor: primary.textColor,
          accentColor: primary.accentColor,
          fontSize: primary.fontSize,
          speed: primary.speed,
          transform: primary.transform,
          recipe: primary.recipe,
          additionalEffects: layers.slice(1)
        });
      };
      return <details key={scene.id} open={index === 0}>
        <summary><b>{index + 1}</b><span>{scene.title}</span><small>{(scene.durationUs / 1_000_000).toFixed(1)}s</small></summary>
        <div className="generated-scene-fields">
          <label><span>画面文字</span><input value={scene.title} onChange={(event) => onScenePatch(scene.id, { title: event.target.value })} /></label>
          <label><span>分镜口播</span><textarea rows={2} value={scene.narration} onChange={(event) => onScenePatch(scene.id, { narration: event.target.value })} /></label>
          <div className="two-column"><NumberField label="时长" value={scene.durationUs / 1_000_000} min={0.5} max={60} step={0.5} suffix="s" onChange={(value) => onScenePatch(scene.id, { durationUs: Math.round(value * 1_000_000) })} /><label><span>主动效类型</span><select value={scene.effectId} onChange={(event) => { const effect = atomicEffects.find((item) => item.id === event.target.value); if (effect) onScenePatch(scene.id, { effectId: effect.id, recipe: structuredClone(effect.recipe) }); }}>{atomicEffects.map((effect) => <option key={effect.id} value={effect.id}>{effect.name}</option>)}</select></label></div>
          <label><span>应用场景模板</span><select value="" onChange={(event) => { const template = sceneTemplates.find((item) => item.id === event.target.value); if (template) applyLayers(createGeneratedEffectLayers([template.id], scene.title, scene.accentColor, scene.durationUs, "scene-template", `${scene.title} ${scene.narration}`)); }}><option value="">选择一个场景组合</option>{sceneTemplates.map((effect) => <option key={effect.id} value={effect.id}>{effect.name}</option>)}</select></label>
          <section className="generated-effect-layers">
            <div><span><Layers3 size={13} />叠加动效 · {(scene.additionalEffects ?? []).length + 1}</span><select aria-label={`为分镜 ${index + 1} 添加动效层`} value="" onChange={(event) => { if (!event.target.value) return; const [layer] = createGeneratedEffectLayers([event.target.value], atomicEffects.find((item) => item.id === event.target.value)?.defaultText ?? scene.title, scene.accentColor, scene.durationUs, "manual", `${scene.title} ${scene.narration}`); if (layer) onScenePatch(scene.id, { additionalEffects: [...(scene.additionalEffects ?? []), { ...layer, zIndex: Math.max(20, ...(scene.additionalEffects ?? []).map((item) => item.zIndex)) + 10 }] }); }}><option value="">添加一层</option>{atomicEffects.map((effect) => <option key={effect.id} value={effect.id}>{effect.name}</option>)}</select></div>
            {(scene.additionalEffects ?? []).map((layer, layerIndex) => <div className="generated-effect-layer" key={layer.id}><b>{layerIndex + 2}</b><span><select aria-label={`叠加动效 ${layerIndex + 2}`} value={layer.effectId} onChange={(event) => { const definition = atomicEffects.find((item) => item.id === event.target.value); if (!definition) return; onScenePatch(scene.id, { additionalEffects: (scene.additionalEffects ?? []).map((item) => item.id === layer.id ? { ...item, effectId: definition.id, recipe: structuredClone(definition.recipe) } : item) }); }}>{atomicEffects.map((effect) => <option key={effect.id} value={effect.id}>{effect.name}</option>)}</select><input aria-label={`叠加文字 ${layerIndex + 2}`} value={layer.text} onChange={(event) => onScenePatch(scene.id, { additionalEffects: (scene.additionalEffects ?? []).map((item) => item.id === layer.id ? { ...item, text: event.target.value } : item) })} /></span><input className="layer-order-input" aria-label={`叠加层级 ${layerIndex + 2}`} type="number" min={0} max={200} value={layer.zIndex} onChange={(event) => onScenePatch(scene.id, { additionalEffects: (scene.additionalEffects ?? []).map((item) => item.id === layer.id ? { ...item, zIndex: Number(event.target.value) } : item) })} /><button type="button" aria-label={`删除叠加动效 ${layerIndex + 2}`} title="删除动效层" onClick={() => onScenePatch(scene.id, { additionalEffects: (scene.additionalEffects ?? []).filter((item) => item.id !== layer.id) })}><Trash2 size={13} /></button></div>)}
          </section>
          <label><span>本地视频素材</span><select value={scene.mediaAssetId ?? ""} onChange={(event) => onScenePatch(scene.id, { mediaAssetId: event.target.value || undefined, mediaSourceInUs: 0 })}><option value="">不使用素材</option>{videoAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
          {media && <><div className="two-column"><NumberField label="素材入点" value={scene.mediaSourceInUs / 1_000_000} min={0} max={Math.max(0, (media.durationUs - 1) / 1_000_000)} step={0.1} suffix="s" onChange={(value) => onScenePatch(scene.id, { mediaSourceInUs: Math.min(Math.round(value * 1_000_000), Math.max(0, media.durationUs - 1)) })} /><label><span>画面适配</span><select value={scene.mediaFit} onChange={(event) => onScenePatch(scene.id, { mediaFit: event.target.value as "cover" | "contain" })}><option value="cover">填满画布</option><option value="contain">完整显示</option></select></label></div><RangeField label="素材音量" value={scene.mediaVolume} min={0} max={2} step={0.05} suffix="×" onChange={(mediaVolume) => onScenePatch(scene.id, { mediaVolume })} /><CameraFields value={scene.camera} onChange={(camera) => onScenePatch(scene.id, { camera })} /></>}
          <section className="generated-effect-layers">
            <div><span><Layers3 size={13} />前景视频图层</span></div>
            <label><span>叠加视频素材</span><select value={scene.secondaryMediaAssetId ?? ""} onChange={(event) => onScenePatch(scene.id, { secondaryMediaAssetId: event.target.value || undefined, secondaryMediaSourceInUs: 0 })}><option value="">不使用叠加视频</option>{videoAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
            {secondaryMedia && <><label><span>多视频布局与转场</span><select value={scene.mediaLayoutPreset ?? "picture-in-picture-top-right"} onChange={(event) => onScenePatch(scene.id, { mediaLayoutPreset: event.target.value as VideoClip["layoutPreset"] })}>{VIDEO_LAYOUT_PRESETS.filter((preset) => preset.id !== "custom").map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select></label><div className="two-column"><NumberField label="前景入点" value={(scene.secondaryMediaSourceInUs ?? 0) / 1_000_000} min={0} max={Math.max(0, (secondaryMedia.durationUs - 1) / 1_000_000)} step={0.1} suffix="s" onChange={(value) => onScenePatch(scene.id, { secondaryMediaSourceInUs: Math.min(Math.round(value * 1_000_000), Math.max(0, secondaryMedia.durationUs - 1)) })} /><label><span>前景适配</span><select value={scene.secondaryMediaFit ?? "cover"} onChange={(event) => onScenePatch(scene.id, { secondaryMediaFit: event.target.value as "cover" | "contain" })}><option value="cover">填满图层</option><option value="contain">完整显示</option></select></label></div><RangeField label="前景音量" value={scene.secondaryMediaVolume ?? 0} min={0} max={2} step={0.05} suffix="×" onChange={(secondaryMediaVolume) => onScenePatch(scene.id, { secondaryMediaVolume })} /></>}
          </section>
          <div className="two-column"><label><span>文字颜色</span><input type="color" value={scene.textColor} onChange={(event) => onScenePatch(scene.id, { textColor: event.target.value })} /></label><label><span>强调色</span><input type="color" value={scene.accentColor} onChange={(event) => onScenePatch(scene.id, { accentColor: event.target.value })} /></label></div>
          <RangeField label="字号" value={scene.fontSize} min={18} max={120} suffix="px" onChange={(fontSize) => onScenePatch(scene.id, { fontSize })} />
          <RangeField label="速度" value={scene.speed} min={0.25} max={3} step={0.05} suffix="×" onChange={(speed) => onScenePatch(scene.id, { speed })} />
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
