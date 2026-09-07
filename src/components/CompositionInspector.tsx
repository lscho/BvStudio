import { ArrowDown, ArrowUp, ImagePlus, Play, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Select } from "@/components/Select";
import { CompositionTiming } from "@/components/CompositionTiming";
import type { CompositionClip, TransformProps } from "@/domain/project";
import { compositionBindingIssues, compositionLayer, compositionNumber, compositionSlots, compositionTransformPatch, isBackgroundComposition, isSequencedMediaComposition, mediaComposition, slotAccepts, type CompositionSlot } from "@/domain/compositions";
import { DEFAULT_TRANSFORM, visualTransformAt } from "@/domain/transforms";
import { importCompositionImages } from "@/services/compositionMedia";
import { isDesktopRuntime } from "@/services/runtime";
import { useEditorStore } from "@/stores/editorStore";

export function CompositionInspector({ clip }: { clip: CompositionClip }) {
  const project = useEditorStore((state) => state.project);
  const update = useEditorStore((state) => state.updateComposition);
  const playheadUs = useEditorStore((state) => state.playheadUs);
  const localUs = Math.max(0, Math.min(clip.durationUs, playheadUs - clip.startUs));
  const transform = visualTransformAt(clip.transform, clip.transformKeyframes, localUs);
  const patchTransform = (patch: Partial<TransformProps>) => update(clip.id, compositionTransformPatch(clip, localUs, patch));
  const definition = mediaComposition(clip.compositionId);
  const background = isBackgroundComposition(clip.compositionId);
  const sequenced = isSequencedMediaComposition(clip.compositionId);
  const locked = clip.locked || Boolean(project.tracks.find((track) => track.id === clip.trackId)?.locked);
  const params = { ...definition?.defaultParams, ...clip.params };
  const issues = compositionBindingIssues(clip, project.assets);
  const patchNumber = (field: string, value: number) => update(clip.id, { params: { ...params, [field]: value } });
  return <fieldset className="inspector-content composition-inspector" disabled={locked}>
    <div className="selection-heading"><span className="type-dot composition" /><div><strong>{clip.label}</strong><small>{locked ? "已锁定" : background ? "背景动效" : "素材动效"}</small></div></div>
    <CompositionTiming clip={clip} locked={locked} />
    <label><span>动效层级</span><input type="number" min={0} max={1000} step={1} value={compositionLayer(clip)} onChange={(event) => {
      if (Number.isFinite(event.target.valueAsNumber)) update(clip.id, { zIndex: event.target.valueAsNumber });
    }} /></label>
    <section className="camera-fields">
      <div className="composition-transform-heading"><span>整体变换</span><button type="button" className="icon-button" aria-label="重置整体变换" title="重置整体变换" onClick={() => patchTransform(DEFAULT_TRANSFORM)}><RotateCcw size={13} /></button></div>
      <div className="two-column">{([
        { field: "x", label: "水平位置（%）", min: 0, max: 100, factor: 1 },
        { field: "y", label: "垂直位置（%）", min: 0, max: 100, factor: 1 },
        { field: "scale", label: "缩放（%）", min: 30, max: 300, factor: 100 },
        { field: "rotation", label: "旋转（度）", min: -180, max: 180, factor: 1 }
      ] as const).map(({ field, label, min, max, factor }) => <label key={field}><span>{label}</span><input type="number" min={min} max={max} step={1} value={Number((transform[field] * factor).toFixed(2))} onChange={(event) => {
        const value = event.target.valueAsNumber;
        if (Number.isFinite(value)) patchTransform({ [field]: Math.max(min, Math.min(max, value)) / factor });
      }} /></label>)}</div>
      <label><span>不透明度</span><input type="range" min={0} max={1} step={0.05} value={transform.opacity} onChange={(event) => patchTransform({ opacity: Number(event.target.value) })} /></label>
    </section>
    <CompositionAssetSlots clip={clip} locked={locked} />
    {issues.length > 0 && <p className="composition-validation" role="status">{issues[0]}</p>}
    <section className="camera-fields">
      <span>场景</span>
      <label><span>{background ? "流动幅度" : "镜头幅度"}</span><input type="range" min={0} max={1} step={0.05} value={compositionNumber(params, "travel", 0.65, 0, 1)} onChange={(event) => patchNumber("travel", Number(event.target.value))} /></label>
      {((!sequenced && !background) || clip.compositionId === "slide-gallery") && <label><span>素材间距</span><input type="range" min={0.8} max={1.6} step={0.05} value={compositionNumber(params, "spacing", 1, 0.8, 1.6)} onChange={(event) => patchNumber("spacing", Number(event.target.value))} /></label>}
      {sequenced && <label><span>画面适配</span><Select label="画面适配" disabled={locked} value={params.fit === "cover" ? "cover" : "contain"} options={[{ value: "contain", label: "完整显示" }, { value: "cover", label: "裁切填满" }]} onChange={(fit) => update(clip.id, { params: { ...params, fit } })} /></label>}
      {background && <>
        <label><span>纹理密度</span><input type="range" min={0.5} max={2} step={0.1} value={compositionNumber(params, "density", 1, 0.5, 2)} onChange={(event) => patchNumber("density", Number(event.target.value))} /></label>
        <div className="two-column">{[{ field: "background", label: "背景色" }, { field: "gridColor", label: "纹理色" }].map(({ field, label }) => <label key={field}><span>{label}</span><input type="color" value={typeof params[field] === "string" ? params[field] : "#191d20"} onChange={(event) => update(clip.id, { params: { ...params, [field]: event.target.value } })} /></label>)}</div>
      </>}
    </section>
    <button type="button" className="button" disabled={issues.length > 0} onClick={() => useEditorStore.getState().requestPreview(clip.startUs, clip.startUs + clip.durationUs)}><Play size={14} />播放动效</button>
  </fieldset>;
}

export function CompositionAssetSlots({ clip, locked }: { clip: CompositionClip; locked: boolean }) {
  return <>{compositionSlots(clip.compositionId).map((slot) => <CompositionSlotEditor key={`${clip.id}-${slot.id}`} clip={clip} slot={slot} locked={locked} />)}</>;
}

function CompositionSlotEditor({ clip, slot, locked }: { clip: CompositionClip; slot: CompositionSlot; locked: boolean }) {
  const assets = useEditorStore((state) => state.project.assets);
  const bind = useEditorStore((state) => state.bindCompositionAssets);
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const ids = clip.bindings?.find((binding) => binding.slotId === slot.id)?.assetIds ?? [];
  const noun = slot.kind === "image" ? "图片" : slot.kind === "video" ? "视频" : "素材";
  const slotName = slot.label.includes(noun) ? slot.label : `${slot.label}${noun}`;
  const available = assets.filter((asset) => slotAccepts(slot, asset.kind) && !asset.missing);
  const commit = (next: string[], imported = [] as typeof assets) => {
    const current = useEditorStore.getState().project.tracks.flatMap((track) => track.clips).find((candidate) => candidate.id === clip.id);
    if (!current || current.kind !== "composition" || current.locked || useEditorStore.getState().project.tracks.find((track) => track.id === current.trackId)?.locked) {
      imported.filter((asset) => !asset.sourcePath && asset.objectUrl).forEach((asset) => URL.revokeObjectURL(asset.objectUrl!));
      return;
    }
    bind(clip.id, [...(current.bindings ?? []).filter((binding) => binding.slotId !== slot.id), { slotId: slot.id, assetIds: next }], imported);
  };
  const addExisting = (id: string) => {
    if (locked || busy || ids.length >= slot.maxItems) return;
    try { commit([...ids, id]); setError(""); } catch (failure) { setError(failure instanceof Error ? failure.message : "添加失败"); }
  };
  const importImages = async (files?: FileList) => {
    if (locked || busy) return;
    setBusy(true); setError("");
    try {
      const imported = await importCompositionImages(files, slot.maxItems - ids.length, slot.kind);
      if (!alive.current) { imported.filter((asset) => !asset.sourcePath && asset.objectUrl).forEach((asset) => URL.revokeObjectURL(asset.objectUrl!)); return; }
      if (imported.length) commit([...ids, ...imported.map((asset) => asset.id)], imported);
    } catch (failure) {
      if (alive.current) setError(failure instanceof Error ? failure.message : "导入失败，请重试");
    } finally { if (alive.current) setBusy(false); }
  };
  return <section className="composition-slot" aria-label={`${slot.label}素材槽`} onDragOver={(event) => { if (!locked) event.preventDefault(); }} onDrop={(event) => {
    event.preventDefault();
    if (locked || busy) return;
    const id = event.dataTransfer.getData("application/x-bvideo-asset");
    if (id) addExisting(id);
    else if (event.dataTransfer.files.length && !isDesktopRuntime()) void importImages(event.dataTransfer.files);
  }}>
    <header><strong>{slot.label}</strong><small>{ids.length} / {slot.maxItems}</small></header>
    {ids.map((id, index) => {
      const asset = assets.find((candidate) => candidate.id === id);
      const itemLabel = `${slot.label}第 ${index + 1} ${slot.kind === "image" ? "张" : "个"}`;
      const reorder = (direction: number) => {
        const next = [...ids];
        [next[index], next[index + direction]] = [next[index + direction], next[index]];
        commit(next);
      };
      return <div className="composition-slot-row" key={`${index}-${id}`}>
        {asset?.objectUrl && !asset.missing ? asset.kind === "video" ? <video className="composition-video-thumb" src={asset.objectUrl} aria-label={asset.name} muted playsInline preload="auto" /> : <img src={asset.objectUrl} alt={asset.name} /> : <span className="composition-missing-image">缺失</span>}
        <Select disabled={locked || busy} label={itemLabel} value={id} options={[...(!available.some((item) => item.id === id) ? [{ value: id, label: asset?.name ?? "素材缺失" }] : []), ...available.map((item) => ({ value: item.id, label: item.name }))]} onChange={(value) => commit(ids.map((item, at) => at === index ? value : item))} />
        <div className="composition-slot-tools">
          <button type="button" title="上移" aria-label={`上移${itemLabel}`} disabled={busy || index === 0} onClick={() => reorder(-1)}><ArrowUp size={13} /></button>
          <button type="button" title="下移" aria-label={`下移${itemLabel}`} disabled={busy || index === ids.length - 1} onClick={() => reorder(1)}><ArrowDown size={13} /></button>
          <button type="button" title="移除" aria-label={`移除${itemLabel}`} disabled={busy} onClick={() => commit(ids.filter((_, at) => at !== index))}><Trash2 size={13} /></button>
        </div>
      </div>;
    })}
    {ids.length < slot.maxItems && <div className="composition-slot-add">
      <Select disabled={locked || busy} label={`添加${slotName}`} value="__choose__" options={[{ value: "__choose__", label: `选择已有${noun}` }, ...available.map((asset) => ({ value: asset.id, label: asset.name }))]} onChange={(id) => { if (id !== "__choose__") addExisting(id); }} />
      <button type="button" aria-label={`导入${slotName}`} title={`导入${noun}`} disabled={busy} onClick={() => isDesktopRuntime() ? void importImages() : input.current?.click()}><ImagePlus size={16} /></button>
      <input ref={input} type="file" accept={slot.kind === "image" ? "image/png,image/jpeg,image/webp,image/bmp" : slot.kind === "video" ? "video/mp4,video/webm,video/quicktime" : "image/png,image/jpeg,image/webp,image/bmp,video/mp4,video/webm,video/quicktime"} multiple={slot.maxItems > 1} hidden aria-label={`上传${slotName}`} onChange={(event) => { if (event.target.files) void importImages(event.target.files); event.target.value = ""; }} />
    </div>}
    {busy && <small role="status">正在读取素材</small>}
    {error && <p role="alert" className="composition-validation">{error}</p>}
  </section>;
}
