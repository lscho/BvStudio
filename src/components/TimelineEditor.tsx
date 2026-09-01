import { useEffect, useMemo, useRef, useState } from "react";
import { BetweenHorizontalEnd, BetweenHorizontalStart, Eye, EyeOff, Lock, Magnet, Minus, Scissors, Unlock, Volume2, VolumeX, X, ZoomIn } from "lucide-react";
import type { TimelineClip, TimelineTrack } from "@/domain/project";
import { localMediaUrl } from "@/services/media";
import { useEditorStore } from "@/stores/editorStore";

const PIXELS_PER_SECOND = 24;
type DragMode = "move" | "start" | "end";

interface DragState {
  clipId: string;
  pointerId: number;
  mode: DragMode;
  originX: number;
  initialStartUs: number;
  initialDurationUs: number;
  deltaUs: number;
}

function clipEnd(clip: TimelineClip) {
  return clip.startUs + clip.durationUs;
}

export function Timeline() {
  const project = useEditorStore((state) => state.project);
  const selectedClipIds = useEditorStore((state) => state.selectedClipIds);
  const zoom = useEditorStore((state) => state.zoom);
  const rangeStartUs = useEditorStore((state) => state.rangeStartUs);
  const rangeEndUs = useEditorStore((state) => state.rangeEndUs);
  const setZoom = useEditorStore((state) => state.setZoom);
  const setPlayhead = useEditorStore((state) => state.setPlayhead);
  const setRangeStart = useEditorStore((state) => state.setRangeStart);
  const setRangeEnd = useEditorStore((state) => state.setRangeEnd);
  const clearRange = useEditorStore((state) => state.clearRange);
  const selectClip = useEditorStore((state) => state.selectClip);
  const moveClips = useEditorStore((state) => state.moveClips);
  const trimClip = useEditorStore((state) => state.trimClip);
  const splitSelected = useEditorStore((state) => state.splitSelected);
  const setTrackState = useEditorStore((state) => state.setTrackState);
  const [snapping, setSnapping] = useState(true);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const timelineInnerRef = useRef<HTMLDivElement | null>(null);
  const playheadPointerRef = useRef<number | null>(null);
  const playheadMouseDragRef = useRef(false);
  const pendingZoomAnchorRef = useRef<{ pointerX: number; timeSeconds: number } | null>(null);
  const durationSeconds = Math.max(30, project.durationUs / 1_000_000);
  const width = durationSeconds * PIXELS_PER_SECOND * zoom;
  const ticks = useMemo(() => Array.from({ length: Math.floor(durationSeconds / 5) + 1 }, (_, index) => index * 5), [durationSeconds]);
  const allClips = useMemo(() => project.tracks.flatMap((track) => track.clips), [project]);
  const range = rangeStartUs !== null && rangeEndUs !== null && rangeStartUs !== rangeEndUs
    ? { startUs: Math.min(rangeStartUs, rangeEndUs), endUs: Math.max(rangeStartUs, rangeEndUs) }
    : null;

  useEffect(() => {
    const clipId = selectedClipIds.at(-1);
    const clip = clipId ? allClips.find((candidate) => candidate.id === clipId) : undefined;
    const container = timelineScrollRef.current;
    if (!clip || !container || container.clientWidth <= 0) return;
    const left = clip.startUs / 1_000_000 * PIXELS_PER_SECOND * zoom;
    const right = left + Math.max(34, clip.durationUs / 1_000_000 * PIXELS_PER_SECOND * zoom);
    const padding = 48;
    if (left < container.scrollLeft + padding) container.scrollLeft = Math.max(0, left - padding);
    else if (right > container.scrollLeft + container.clientWidth - padding) container.scrollLeft = Math.max(0, right - container.clientWidth + padding);
  }, [project, selectedClipIds, zoom]);

  useEffect(() => {
    const anchor = pendingZoomAnchorRef.current;
    const container = timelineScrollRef.current;
    if (!anchor || !container) return;
    container.scrollLeft = Math.max(0, anchor.timeSeconds * PIXELS_PER_SECOND * zoom - anchor.pointerX);
    pendingZoomAnchorRef.current = null;
  }, [zoom]);

  useEffect(() => {
    const update = (event: MouseEvent) => {
      if (!playheadMouseDragRef.current) return;
      event.preventDefault();
      seekPlayhead(event.clientX);
    };
    const finish = (event: MouseEvent) => {
      if (!playheadMouseDragRef.current) return;
      seekPlayhead(event.clientX);
      playheadMouseDragRef.current = false;
    };
    const cancel = () => {
      playheadMouseDragRef.current = false;
    };
    window.addEventListener("mousemove", update);
    window.addEventListener("mouseup", finish);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("mousemove", update);
      window.removeEventListener("mouseup", finish);
      window.removeEventListener("blur", cancel);
    };
  }, [project.durationUs, setPlayhead, zoom]);

  function zoomAround(nextZoom: number, pointerX: number) {
    const container = timelineScrollRef.current;
    const boundedZoom = Math.min(3, Math.max(0.6, nextZoom));
    if (!container || Math.abs(boundedZoom - zoom) < 0.000_1) return;
    pendingZoomAnchorRef.current = {
      pointerX,
      timeSeconds: (container.scrollLeft + pointerX) / (PIXELS_PER_SECOND * zoom)
    };
    setZoom(boundedZoom);
  }

  function zoomWithWheel(event: React.WheelEvent<HTMLDivElement>) {
    const delta = event.deltaY;
    if (Math.abs(delta) < 0.01) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    zoomAround(Number((zoom * Math.exp(-delta * 0.0015)).toFixed(3)), event.clientX - rect.left);
  }

  function snapTime(timeUs: number, excludedIds: string[]): number {
    if (!snapping) return Math.max(0, timeUs);
    const frameUs = 1_000_000 * project.canvas.fpsDenominator / project.canvas.fpsNumerator;
    const frameSnapped = Math.round(timeUs / frameUs) * frameUs;
    const boundaries = [0, useEditorStore.getState().playheadUs, ...allClips.filter((clip) => !excludedIds.includes(clip.id)).flatMap((clip) => [clip.startUs, clipEnd(clip)])];
    const thresholdUs = 9 / (PIXELS_PER_SECOND * zoom) * 1_000_000;
    const closest = boundaries.reduce((best, candidate) => Math.abs(candidate - timeUs) < Math.abs(best - timeUs) ? candidate : best, frameSnapped);
    return Math.max(0, Math.abs(closest - timeUs) <= thresholdUs ? closest : frameSnapped);
  }

  function seek(event: React.MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest(".timeline-clip, .track-control, .playhead")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    selectClip(null);
    setPlayhead(Math.max(0, Math.min(project.durationUs, ((event.clientX - rect.left) / (PIXELS_PER_SECOND * zoom)) * 1_000_000)));
  }

  function seekPlayhead(clientX: number) {
    const rect = timelineInnerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPlayhead(Math.max(0, Math.min(project.durationUs, ((clientX - rect.left) / (PIXELS_PER_SECOND * zoom)) * 1_000_000)));
  }

  function beginPlayheadDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse") return;
    event.preventDefault();
    event.stopPropagation();
    playheadPointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    seekPlayhead(event.clientX);
  }

  function updatePlayheadDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (playheadPointerRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    seekPlayhead(event.clientX);
  }

  function finishPlayheadDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (playheadPointerRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    seekPlayhead(event.clientX);
    playheadPointerRef.current = null;
  }

  function cancelPlayheadDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (playheadPointerRef.current === event.pointerId) playheadPointerRef.current = null;
  }

  function beginPlayheadMouseDrag(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    playheadMouseDragRef.current = true;
    seekPlayhead(event.clientX);
  }

  function beginDrag(event: React.PointerEvent<HTMLElement>, clip: TimelineClip, mode: DragMode) {
    const track = project.tracks.find((candidate) => candidate.id === clip.trackId);
    if (clip.locked || track?.locked) return;
    event.preventDefault();
    event.stopPropagation();
    const additive = event.metaKey || event.ctrlKey || event.shiftKey;
    if (!selectedClipIds.includes(clip.id) || additive) selectClip(clip.id, additive);
    event.currentTarget.setPointerCapture(event.pointerId);
    const nextDrag = { clipId: clip.id, pointerId: event.pointerId, mode, originX: event.clientX, initialStartUs: clip.startUs, initialDurationUs: clip.durationUs, deltaUs: 0 };
    dragRef.current = nextDrag;
    setDrag(nextDrag);
  }

  function updateDrag(event: React.PointerEvent<HTMLElement>) {
    const currentDrag = dragRef.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;
    const rawDelta = (event.clientX - currentDrag.originX) / (PIXELS_PER_SECOND * zoom) * 1_000_000;
    const movingIds = selectedClipIds.includes(currentDrag.clipId) ? selectedClipIds : [currentDrag.clipId];
    let deltaUs = rawDelta;
    if (currentDrag.mode === "move") {
      const clip = allClips.find((candidate) => candidate.id === currentDrag.clipId)!;
      const startDelta = snapTime(currentDrag.initialStartUs + rawDelta, movingIds) - currentDrag.initialStartUs;
      const endDelta = snapTime(currentDrag.initialStartUs + currentDrag.initialDurationUs + rawDelta, movingIds) - clipEnd(clip);
      deltaUs = Math.abs(startDelta - rawDelta) <= Math.abs(endDelta - rawDelta) ? startDelta : endDelta;
    } else if (currentDrag.mode === "start") {
      deltaUs = Math.min(snapTime(currentDrag.initialStartUs + rawDelta, [currentDrag.clipId]) - currentDrag.initialStartUs, currentDrag.initialDurationUs - 100_000);
    } else {
      deltaUs = Math.max(snapTime(currentDrag.initialStartUs + currentDrag.initialDurationUs + rawDelta, [currentDrag.clipId]) - currentDrag.initialStartUs - currentDrag.initialDurationUs, 100_000 - currentDrag.initialDurationUs);
    }
    const nextDrag = { ...currentDrag, deltaUs: Math.round(deltaUs) };
    dragRef.current = nextDrag;
    setDrag(nextDrag);
  }

  function finishDrag(event: React.PointerEvent<HTMLElement>) {
    const currentDrag = dragRef.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (currentDrag.mode === "move") {
      moveClips(selectedClipIds.includes(currentDrag.clipId) ? selectedClipIds : [currentDrag.clipId], currentDrag.deltaUs);
    } else {
      trimClip(currentDrag.clipId, currentDrag.mode, currentDrag.deltaUs);
    }
    dragRef.current = null;
    setDrag(null);
  }

  function cancelDrag() {
    dragRef.current = null;
    setDrag(null);
  }

  function dragModeForTarget(target: EventTarget): DragMode {
    const element = target as HTMLElement;
    if (element.closest(".resize-handle.start")) return "start";
    if (element.closest(".resize-handle.end")) return "end";
    return "move";
  }

  function draftTiming(clip: TimelineClip) {
    if (!drag) return { startUs: clip.startUs, durationUs: clip.durationUs };
    if (drag.mode === "move" && (selectedClipIds.includes(clip.id) || clip.id === drag.clipId)) return { startUs: Math.max(0, clip.startUs + drag.deltaUs), durationUs: clip.durationUs };
    if (clip.id !== drag.clipId) return { startUs: clip.startUs, durationUs: clip.durationUs };
    if (drag.mode === "start") return { startUs: Math.max(0, drag.initialStartUs + drag.deltaUs), durationUs: Math.max(100_000, drag.initialDurationUs - drag.deltaUs) };
    return { startUs: clip.startUs, durationUs: Math.max(100_000, drag.initialDurationUs + drag.deltaUs) };
  }

  return (
    <section className="timeline-panel" onPointerMove={updateDrag} onPointerUp={finishDrag} onPointerCancel={cancelDrag}>
      <header className="timeline-header"><strong>时间线</strong><TimelineTimecode /><button className="timeline-tool" type="button" aria-label="在播放头分割" title="分割片段" disabled={!selectedClipIds.length} onClick={splitSelected}><Scissors size={14} /></button><button className={`timeline-tool ${snapping ? "active" : ""}`} type="button" aria-label="切换吸附" title="吸附" onClick={() => setSnapping(!snapping)}><Magnet size={14} /></button><span className="timeline-divider" /><button className={`timeline-tool ${rangeStartUs !== null ? "active" : ""}`} type="button" aria-label="设置选区入点" title="设置入点 (I)" onClick={() => setRangeStart(useEditorStore.getState().playheadUs)}><BetweenHorizontalStart size={14} /></button><button className={`timeline-tool ${rangeEndUs !== null ? "active" : ""}`} type="button" aria-label="设置选区出点" title="设置出点 (O)" onClick={() => setRangeEnd(useEditorStore.getState().playheadUs)}><BetweenHorizontalEnd size={14} /></button><button className="timeline-tool" type="button" aria-label="清除时间选区" title="清除选区" disabled={rangeStartUs === null && rangeEndUs === null} onClick={clearRange}><X size={13} /></button>{range && <span className="range-summary">{formatTime(range.startUs)} – {formatTime(range.endUs)} · {((range.endUs - range.startUs) / 1_000_000).toFixed(2)}s</span>}<div className="zoom-control"><ZoomIn size={14} /><button type="button" aria-label="缩小时间线" onClick={() => zoomAround(zoom - 0.2, timelineScrollRef.current?.clientWidth ? timelineScrollRef.current.clientWidth / 2 : 0)}><Minus size={13} /></button><output>{Math.round(zoom * 100)}%</output><button type="button" aria-label="放大时间线" onClick={() => zoomAround(zoom + 0.2, timelineScrollRef.current?.clientWidth ? timelineScrollRef.current.clientWidth / 2 : 0)}>+</button></div></header>
      <div className="timeline-body">
        <div className="track-labels"><div className="ruler-spacer" />{project.tracks.map((track) => <TrackLabel key={track.id} track={track} onChange={(patch) => setTrackState(track.id, patch)} />)}</div>
        <div className="timeline-scroll" ref={timelineScrollRef} onWheel={zoomWithWheel}><div className="timeline-inner" ref={timelineInnerRef} style={{ width }} onClick={seek}>
          <div className="time-ruler">{ticks.map((tick) => <span key={tick} style={{ left: tick * PIXELS_PER_SECOND * zoom }}>{formatTime(tick * 1_000_000)}</span>)}</div>
          {project.tracks.map((track) => <div className={`track-row ${track.locked ? "locked" : ""} ${track.hidden ? "hidden-track" : ""}`} key={track.id}>{track.clips.map((clip) => {
            const waveform = clip.kind === "video" || clip.kind === "audio" ? project.assets.find((asset) => asset.id === clip.assetId)?.waveformPath : undefined;
            const timing = draftTiming(clip);
            return <button type="button" key={clip.id} className={`timeline-clip clip-${clip.kind} ${selectedClipIds.includes(clip.id) ? "selected" : ""} ${clip.locked ? "locked" : ""}`} style={{ left: (timing.startUs / 1_000_000) * PIXELS_PER_SECOND * zoom, width: Math.max(34, (timing.durationUs / 1_000_000) * PIXELS_PER_SECOND * zoom), ...(waveform ? { "--waveform": `url('${localMediaUrl(waveform).replaceAll("'", "%27")}')` } : {}) } as React.CSSProperties} onPointerDown={(event) => beginDrag(event, clip, dragModeForTarget(event.target))} onPointerMove={updateDrag} onPointerUp={finishDrag} onPointerCancel={cancelDrag} onClick={(event) => event.stopPropagation()} title={clip.label}><i className="resize-handle start" />{clip.kind === "video" && clip.presentationCues?.map((cue) => <i key={cue.id} className="motion-cue-marker" style={{ left: `${cue.offsetUs / Math.max(1, clip.durationUs) * 100}%` }} title={`${(cue.offsetUs / 1_000_000).toFixed(2)}s · ${cue.presetId}`} />)}<span>{clip.label}</span>{clip.kind === "generated" && <small>{clip.scenes.length} 条字幕</small>}<i className="resize-handle end" /></button>;
          })}</div>)}
          {range && <span className="timeline-range" style={{ left: (range.startUs / 1_000_000) * PIXELS_PER_SECOND * zoom, width: ((range.endUs - range.startUs) / 1_000_000) * PIXELS_PER_SECOND * zoom }} />}
          <TimelinePlayhead zoom={zoom} onMouseDown={beginPlayheadMouseDrag} onPointerDown={beginPlayheadDrag} onPointerMove={updatePlayheadDrag} onPointerUp={finishPlayheadDrag} onPointerCancel={cancelPlayheadDrag} />
        </div></div>
      </div>
    </section>
  );
}

function TimelineTimecode() {
  const playheadUs = useEditorStore((state) => state.playheadUs);
  return <span>{formatTime(playheadUs)}</span>;
}

function TimelinePlayhead({ zoom, onMouseDown, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }: {
  zoom: number;
  onMouseDown: React.MouseEventHandler<HTMLButtonElement>;
  onPointerDown: React.PointerEventHandler<HTMLButtonElement>;
  onPointerMove: React.PointerEventHandler<HTMLButtonElement>;
  onPointerUp: React.PointerEventHandler<HTMLButtonElement>;
  onPointerCancel: React.PointerEventHandler<HTMLButtonElement>;
}) {
  const playheadUs = useEditorStore((state) => state.playheadUs);
  return <button className="playhead" type="button" aria-label="拖动播放头" title="拖动播放头" style={{ left: (playheadUs / 1_000_000) * PIXELS_PER_SECOND * zoom }} onMouseDown={onMouseDown} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onClick={(event) => event.stopPropagation()}><i /></button>;
}

function TrackLabel({ track, onChange }: { track: TimelineTrack; onChange: (patch: { locked?: boolean; muted?: boolean; hidden?: boolean }) => void }) {
  return <div><span className={`type-dot ${track.kind}`} /><span className="track-name">{track.name}</span><span className="track-controls"><button className="track-control" type="button" aria-label={`${track.name}${track.locked ? "解锁" : "锁定"}`} onClick={() => onChange({ locked: !track.locked })}>{track.locked ? <Lock size={11} /> : <Unlock size={11} />}</button><button className="track-control" type="button" aria-label={`${track.name}${track.hidden ? "显示" : "隐藏"}`} onClick={() => onChange({ hidden: !track.hidden })}>{track.hidden ? <EyeOff size={11} /> : <Eye size={11} />}</button>{(track.kind === "video" || track.kind === "audio") && <button className="track-control" type="button" aria-label={`${track.name}${track.muted ? "取消静音" : "静音"}`} onClick={() => onChange({ muted: !track.muted })}>{track.muted ? <VolumeX size={11} /> : <Volume2 size={11} />}</button>}</span></div>;
}

export function formatTime(timeUs: number) {
  const totalSeconds = Math.max(0, timeUs / 1_000_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const frames = Math.floor((totalSeconds % 1) * 30);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
}
