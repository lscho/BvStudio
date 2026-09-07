import type { CompositionClip } from "@/domain/project";
import { useEditorStore } from "@/stores/editorStore";

export function TimelineTimeInput({ label, valueUs, disabled, onChange }: { label: string; valueUs: number; disabled: boolean; onChange: (valueUs: number) => void }) {
  return <label><span>{label}</span><input key={`${label}:${valueUs}`} type="number" aria-label={label} min={0} step={0.001} disabled={disabled} defaultValue={Number((valueUs / 1_000_000).toFixed(6))} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} onBlur={event => {
    const value = event.currentTarget.valueAsNumber;
    event.currentTarget.value = String(valueUs / 1_000_000);
    if (Number.isFinite(value) && value >= 0 && Math.round(value * 1_000_000) !== valueUs) onChange(Math.round(value * 1_000_000));
  }} /></label>;
}

export function CompositionTiming({ clip, locked }: { clip: CompositionClip; locked: boolean }) {
  const move = useEditorStore(state => state.moveClips);
  const trim = useEditorStore(state => state.trimClip);
  const retime = useEditorStore(state => state.retimeComposition);
  return <section className="camera-fields composition-timing"><span>时间</span>
    <div className="two-column">
      <TimelineTimeInput label="开始时间（秒）" valueUs={clip.startUs} disabled={locked} onChange={value => move([clip.id], value - clip.startUs)} />
      <TimelineTimeInput label="结束时间（秒）" valueUs={clip.startUs + clip.durationUs} disabled={locked} onChange={value => trim(clip.id, "end", value - clip.startUs - clip.durationUs)} />
    </div>
    <TimelineTimeInput label="播放时长（秒）" valueUs={clip.durationUs} disabled={locked} onChange={value => retime(clip.id, value)} />
  </section>;
}

export function CompositionGroupInspector({ groupId, clips }: { groupId: string; clips: CompositionClip[] }) {
  const tracks = useEditorStore(state => state.project.tracks);
  const move = useEditorStore(state => state.moveClips);
  const retime = useEditorStore(state => state.retimeSceneGroup);
  const select = useEditorStore(state => state.selectClip);
  const startUs = Math.min(...clips.map(clip => clip.startUs));
  const endUs = Math.max(...clips.map(clip => clip.startUs + clip.durationUs));
  const locked = clips.some(clip => clip.locked || tracks.find(track => track.id === clip.trackId)?.locked);
  return <div className="inspector-content">
    <div className="selection-heading"><span className="type-dot composition" /><div><strong>场景组</strong><small>{clips.length} 个动效{locked ? " · 已锁定" : ""}</small></div></div>
    <TimelineTimeInput label="整组开始（秒）" valueUs={startUs} disabled={locked} onChange={value => move(clips.map(c => c.id), value - startUs)} />
    <TimelineTimeInput label="整组时长（秒）" valueUs={endUs - startUs} disabled={locked} onChange={value => retime(groupId, value)} />
    <div className="composition-group-members">{clips.map(clip => <button type="button" key={clip.id} onClick={() => select(clip.id)}>{clip.label}</button>)}</div>
  </div>;
}
