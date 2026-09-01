import { Minus, Plus, ZoomIn } from "lucide-react";
import type { TimelineClip } from "@/domain/project";
import { localMediaUrl } from "@/services/media";
import { useEditorStore } from "@/stores/editorStore";

const PIXELS_PER_SECOND = 24;

function clipClass(clip: TimelineClip) {
  return `timeline-clip clip-${clip.kind}`;
}

export function Timeline() {
  const project = useEditorStore((state) => state.project);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const playheadUs = useEditorStore((state) => state.playheadUs);
  const zoom = useEditorStore((state) => state.zoom);
  const setZoom = useEditorStore((state) => state.setZoom);
  const setPlayhead = useEditorStore((state) => state.setPlayhead);
  const selectClip = useEditorStore((state) => state.selectClip);
  const durationSeconds = Math.max(30, project.durationUs / 1_000_000);
  const width = durationSeconds * PIXELS_PER_SECOND * zoom;
  const ticks = Array.from({ length: Math.floor(durationSeconds / 5) + 1 }, (_, index) => index * 5);

  function seek(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setPlayhead(((event.clientX - rect.left) / width) * project.durationUs);
  }

  return (
    <section className="timeline-panel">
      <header className="timeline-header"><strong>时间线</strong><span>{formatTime(playheadUs)}</span><div className="zoom-control"><ZoomIn size={14} /><button type="button" aria-label="缩小时间线" onClick={() => setZoom(zoom - 0.2)}><Minus size={13} /></button><input aria-label="时间线缩放" type="range" min={0.6} max={3} step={0.1} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /><button type="button" aria-label="放大时间线" onClick={() => setZoom(zoom + 0.2)}><Plus size={13} /></button></div></header>
      <div className="timeline-body">
        <div className="track-labels"><div className="ruler-spacer" />{project.tracks.map((track) => <div key={track.id}><span className={`type-dot ${track.kind}`} />{track.name}</div>)}</div>
        <div className="timeline-scroll"><div className="timeline-inner" style={{ width }} onClick={seek}>
          <div className="time-ruler">{ticks.map((tick) => <span key={tick} style={{ left: tick * PIXELS_PER_SECOND * zoom }}>{formatTime(tick * 1_000_000)}</span>)}</div>
          {project.tracks.map((track) => <div className="track-row" key={track.id}>{track.clips.map((clip) => {
            const waveform = clip.kind === "video" ? project.assets.find((asset) => asset.id === clip.assetId)?.waveformPath : undefined;
            return <button type="button" key={clip.id} className={`${clipClass(clip)} ${selectedClipId === clip.id ? "selected" : ""}`} style={{ left: (clip.startUs / 1_000_000) * PIXELS_PER_SECOND * zoom, width: Math.max(34, (clip.durationUs / 1_000_000) * PIXELS_PER_SECOND * zoom), ...(waveform ? { "--waveform": `url('${localMediaUrl(waveform).replaceAll("'", "%27")}')` } : {}) } as React.CSSProperties} onClick={(event) => { event.stopPropagation(); selectClip(clip.id); setPlayhead(clip.startUs); }} title={clip.label}><span>{clip.label}</span>{clip.kind === "generated" && <small>{clip.scenes.length} 条字幕</small>}</button>;
          })}</div>)}
          <span className="playhead" style={{ left: (playheadUs / 1_000_000) * PIXELS_PER_SECOND * zoom }}><i /></span>
        </div></div>
      </div>
    </section>
  );
}

export function formatTime(timeUs: number) {
  const totalSeconds = Math.max(0, timeUs / 1_000_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const frames = Math.floor((totalSeconds % 1) * 30);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
}
