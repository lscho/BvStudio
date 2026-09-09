import { useState } from "react";
import { Select } from "@/components/Select";
import { TimelineTimeInput } from "@/components/CompositionTiming";
import type { CompositionClip } from "@/domain/project";
import { SHOTCRAFT_TRANSITIONS, defaultShotcraftSettings, shotcraftAdjacentShot, shotcraftPredecessor, type ShotcraftRegion } from "@/domain/shotcraft";
import { useEditorStore } from "@/stores/editorStore";
import { shotcraftAdaptationIssue } from "@/domain/shotcraftLibrary/aiPolicy";

export function ShotcraftInspector({ clip, locked, onPatch }: { clip: CompositionClip; locked: boolean; onPatch: (patch: Partial<CompositionClip>) => void }) {
  const tracks = useEditorStore((state) => state.project.tracks);
  const assets = useEditorStore((state) => state.project.assets);
  const [active, setActive] = useState(0);
  const [failedUrl, setFailedUrl] = useState<string>();
  const settings = clip.shotcraft ?? defaultShotcraftSettings(clip.compositionId);
  const index = Math.min(active, Math.max(0, settings.regions.length - 1));
  const region = settings.regions[index];
  const assetId = clip.bindings?.find((binding) => binding.slotId === "page" || binding.slotId === "images")?.assetIds[0];
  const asset = assets.find((candidate) => candidate.id === assetId);
  const previous = shotcraftAdjacentShot({ tracks }, clip);
  const connected = shotcraftPredecessor({ tracks }, clip);
  const adaptationIssue = shotcraftAdaptationIssue(clip.compositionId);
  const patchRegion = (patch: Partial<ShotcraftRegion>) => {
    if (locked || !region) return;
    const next = { ...region, ...patch };
    next.width = Math.max(1, Math.min(100, next.width));
    next.height = Math.max(1, Math.min(100, next.height));
    next.x = Math.max(0, Math.min(100 - next.width, next.x));
    next.y = Math.max(0, Math.min(100 - next.height, next.y));
    onPatch({ shotcraft: { ...settings, regions: settings.regions.map((value, i) => i === index ? next : value) } });
  };
  return <fieldset className="camera-fields shotcraft-controls" disabled={locked}>
    <span>镜头</span>
    {adaptationIssue && <p className="composition-validation" role="status">{adaptationIssue}</p>}
    <TimelineTimeInput label="额外停留（秒）" valueUs={Math.round(settings.holdUs / clip.speed)} disabled={locked} onChange={(value) => onPatch({ shotcraft: { ...settings, holdUs: Math.min(10_000_000, Math.round(value * clip.speed)) } })} />
    {region && <>
      {settings.regions.length > 1 && <label><span>焦点</span><Select label="编辑焦点" disabled={locked} value={String(index)} options={settings.regions.map((_, i) => ({ value: String(i), label: `焦点 ${i + 1}` }))} onChange={(value) => setActive(Number(value))} /></label>}
      {asset?.objectUrl && !asset.missing && failedUrl !== asset.objectUrl && <button type="button" className="shotcraft-region-preview" aria-label="点击截图定位焦点" title="点击截图移动当前焦点" onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.detail && rect.width && rect.height) patchRegion({ x: (event.clientX - rect.left) / rect.width * 100 - region.width / 2, y: (event.clientY - rect.top) / rect.height * 100 - region.height / 2 });
      }}>
        <img src={asset.objectUrl} alt="焦点区域预览" onError={() => setFailedUrl(asset.objectUrl)} />
        {settings.regions.map((value, i) => <span key={i} className={i === index ? "active" : ""} style={{ left: `${value.x}%`, top: `${value.y}%`, width: `${value.width}%`, height: `${value.height}%` }}><b>{i + 1}</b></span>)}
      </button>}
      <div className="two-column">{([
        ["x", "焦点左侧（%）"], ["y", "焦点顶部（%）"], ["width", "焦点宽度（%）"], ["height", "焦点高度（%）"]
      ] as const).map(([field, label]) => <label key={field}><span>{label}</span><input type="number" aria-label={label} min={field === "x" || field === "y" ? 0 : 1} max={100} step={0.1} value={Number(region[field].toFixed(2))} onChange={(event) => {
        if (Number.isFinite(event.target.valueAsNumber)) patchRegion({ [field]: event.target.valueAsNumber });
      }} /></label>)}</div>
    </>}
    <label><span>衔接上一镜头</span><Select label="镜头转场" disabled={locked || !previous} value={settings.transition.preset} options={SHOTCRAFT_TRANSITIONS} onChange={(preset) => {
      if (SHOTCRAFT_TRANSITIONS.some((item) => item.value === preset)) onPatch({ shotcraft: { ...settings, transition: { ...settings.transition, preset, fromClipId: preset === "none" ? undefined : previous?.id } } });
    }} /></label>
    {settings.transition.preset !== "none" && <>
      <TimelineTimeInput label="转场时长（秒）" valueUs={Math.round(settings.transition.durationUs / clip.speed)} disabled={locked} onChange={(value) => onPatch({ shotcraft: { ...settings, transition: { ...settings.transition, durationUs: Math.max(100_000, Math.min(1_500_000, Math.round(value * clip.speed))) } } })} />
      {!connected && <button type="button" className="inline-reset-button" onClick={() => onPatch({ shotcraft: { ...settings, transition: { preset: "none", durationUs: settings.transition.durationUs } } })}>清除失效转场</button>}
    </>}
    {!previous && <p className="composition-validation" role="status">转场需要同轨紧邻的整屏 Shotcraft 镜头；请保持两段位置、缩放、透明度为默认值且无整体关键帧。</p>}
    {previous && settings.transition.preset !== "none" && !connected && <p className="composition-validation" role="status">原转场已失效，请重新选择转场连接当前上一镜头。</p>}
  </fieldset>;
}
