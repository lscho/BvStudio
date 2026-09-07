import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BetweenHorizontalEnd, BetweenHorizontalStart, ChevronDown, ChevronRight, Eye, EyeOff, Focus, Group, Layers3, Lock, Magnet, Minus, Plus, Scissors, Unlock, Volume2, VolumeX, X, ZoomIn } from "lucide-react";
import type { TimelineClip, TimelineTrack } from "@/domain/project";
import { clipGroupId, timelineRows } from "@/domain/timelineLayout";
import { sceneGroupRetimeRatio } from "@/domain/compositions";
import { localMediaUrl } from "@/services/media";
import { useEditorStore } from "@/stores/editorStore";

const PIXELS_PER_SECOND = 24;
const SNAP_THRESHOLD_PX = 12;
type DragMode = "move" | "start" | "end";

interface DragState {
  clipId: string;
  pointerId: number;
  mode: DragMode;
  originX: number;
  initialStartUs: number;
  initialDurationUs: number;
  deltaUs: number;
  snapUs: number | null;
  clipIds: string[];
  groupId?: string;
  additive: boolean;
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
  const selectSceneGroup = useEditorStore((state) => state.selectSceneGroup);
  const retimeSceneGroup = useEditorStore((state) => state.retimeSceneGroup);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const allClips = useMemo(() => project.tracks.flatMap((track) => track.clips), [project]);
  const [focusState, setFocusState] = useState<{ groupId: string; projectId: string; startUs: number; endUs: number; pixelsPerSecond: number; zoom: number; scrollLeft: number; scrollTop: number } | null>(null);
  const focus = focusState?.projectId === project.id && allClips.some(c => clipGroupId(c) === focusState.groupId) ? focusState : null;
  const focusedMembers = focus ? allClips.filter(c => clipGroupId(c) === focus.groupId) : [];
  const originUs = focus ? Math.max(0, Math.min(focus.startUs, ...focusedMembers.map(c => c.startUs - 1_000_000))) : 0;
  const pixelsPerSecond = focus ? focus.pixelsPerSecond * zoom / focus.zoom : PIXELS_PER_SECOND * zoom;
  const rows = useMemo(() => timelineRows(project.tracks, collapsed, pixelsPerSecond, focus?.groupId), [project.tracks, collapsed, pixelsPerSecond, focus?.groupId]);
  const selectedClip = allClips.find(c => selectedClipIds.includes(c.id));
  const selectedGroupId = selectedClip ? clipGroupId(selectedClip) : undefined;
  const contextGroupId = focus?.groupId ?? selectedGroupId;
  const contextMembers = contextGroupId ? allClips.filter(c => clipGroupId(c) === contextGroupId) : [];
  const contextLabel = contextMembers[0]?.label.replace(/^AI (动效|场景)\s*·\s*/u, "");
  const panelRef = useRef<HTMLElement>(null);
  const heightDrag = useRef<{ pointerId: number; y: number; height: number } | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const toggleRow = (id: string) => setCollapsed(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  useEffect(() => {
    const workspace = panelRef.current?.closest<HTMLElement>(".editor-workspace");
    if (!workspace || height === null) return;
    workspace.style.setProperty("--timeline-height", `${height}px`);
    return () => { workspace.style.removeProperty("--timeline-height"); };
  }, [height]);
  const changeHeight = (value: number) => setHeight(Math.max(160, Math.min(Math.max(160, (panelRef.current?.closest<HTMLElement>(".editor-workspace")?.clientHeight ?? window.innerHeight) - 300), value)));
  const [snapping, setSnapping] = useState(true);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const timelineInnerRef = useRef<HTMLDivElement | null>(null);
  const playheadPointerRef = useRef<number | null>(null);
  const playheadMouseDragRef = useRef(false);
  const pendingZoomAnchorRef = useRef<{ pointerX: number; timeSeconds: number } | null>(null);
  const viewEndUs = focus ? Math.max(focus.endUs, ...focusedMembers.map(c => clipEnd(c) + 1_000_000)) : Math.max(30_000_000, project.durationUs);
  const durationSeconds = (viewEndUs - originUs) / 1_000_000;
  const width = durationSeconds * pixelsPerSecond;
  const tickStep = focus && pixelsPerSecond >= 60 ? 1 : 5;
  const ticks = useMemo(() => Array.from({ length: Math.ceil(durationSeconds / tickStep) + 1 }, (_, index) => Math.ceil(originUs / 1_000_000 / tickStep) * tickStep + index * tickStep).filter(tick => tick * 1_000_000 <= viewEndUs), [durationSeconds, originUs, tickStep, viewEndUs]);
  const timeLeft = (timeUs: number) => (timeUs - originUs) / 1_000_000 * pixelsPerSecond;
  const restoredScroll = useRef<{ left: number; top: number } | null>(null);

  function focusGroup(groupId: string) {
    const members = allClips.filter(c => clipGroupId(c) === groupId);
    if (!members.length || focus?.groupId === groupId) return;
    const startUs = Math.max(0, Math.min(...members.map(c => c.startUs)) - 1_000_000);
    const endUs = Math.max(...members.map(clipEnd)) + 1_000_000;
    const scroll = timelineScrollRef.current;
    setFocusState({ groupId, projectId: project.id, startUs, endUs, pixelsPerSecond: Math.max(24, ((scroll?.clientWidth || 800) - 24) / ((endUs - startUs) / 1_000_000)), zoom, scrollLeft: scroll?.scrollLeft ?? 0, scrollTop: panelRef.current?.querySelector(".timeline-body")?.scrollTop ?? 0 });
    selectSceneGroup(groupId);
    setPlayhead(Math.min(...members.map(c => c.startUs)));
  }

  function exitFocus() {
    if (focus) {
      restoredScroll.current = { left: focus.scrollLeft, top: focus.scrollTop };
      setZoom(focus.zoom);
    }
    setFocusState(null);
  }
  useEffect(() => {
    if (focus && selectedClipIds.length && selectedClipIds.every(id => !focusedMembers.some(c => c.id === id))) exitFocus();
  }, [focus, selectedClipIds, project]);
  const range = rangeStartUs !== null && rangeEndUs !== null && rangeStartUs !== rangeEndUs
    ? { startUs: Math.min(rangeStartUs, rangeEndUs), endUs: Math.max(rangeStartUs, rangeEndUs) }
    : null;
  const visibleRange = range && range.endUs > originUs && range.startUs < viewEndUs
    ? { startUs: Math.max(originUs, range.startUs), endUs: Math.min(viewEndUs, range.endUs) } : null;

  useEffect(() => {
    const clipId = selectedClipIds.at(-1);
    const clip = clipId ? allClips.find((candidate) => candidate.id === clipId) : undefined;
    const container = timelineScrollRef.current;
    if (!clip || !container || container.clientWidth <= 0) return;
    const left = timeLeft(clip.startUs);
    const right = left + Math.max(34, clip.durationUs / 1_000_000 * pixelsPerSecond);
    const padding = 48;
    if (dragRef.current) return;
    if (left < container.scrollLeft + padding) container.scrollLeft = Math.max(0, left - padding);
    else if (right > container.scrollLeft + container.clientWidth - padding) container.scrollLeft = Math.max(0, right - container.clientWidth + padding);
  }, [project, selectedClipIds, pixelsPerSecond, originUs]);

  useEffect(() => {
    const scroll = timelineScrollRef.current;
    const body = panelRef.current?.querySelector(".timeline-body");
    if (scroll) scroll.scrollLeft = focus ? 0 : restoredScroll.current?.left ?? scroll.scrollLeft;
    if (body) body.scrollTop = focus ? 0 : restoredScroll.current?.top ?? body.scrollTop;
    restoredScroll.current = null;
  }, [focus]);

  useEffect(() => {
    const anchor = pendingZoomAnchorRef.current;
    const container = timelineScrollRef.current;
    if (!anchor || !container) return;
    container.scrollLeft = Math.max(0, anchor.timeSeconds * pixelsPerSecond - anchor.pointerX);
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
  }, [project.durationUs, setPlayhead, pixelsPerSecond, originUs]);

  function zoomAround(nextZoom: number, pointerX: number) {
    const container = timelineScrollRef.current;
    const boundedZoom = Math.min(3, Math.max(0.6, nextZoom));
    if (!container || Math.abs(boundedZoom - zoom) < 0.000_1) return;
    pendingZoomAnchorRef.current = {
      pointerX,
      timeSeconds: (container.scrollLeft + pointerX) / pixelsPerSecond
    };
    setZoom(boundedZoom);
  }

  function zoomWithWheel(event: React.WheelEvent<HTMLDivElement>) {
    const body = panelRef.current?.querySelector(".timeline-body");
    if (!event.ctrlKey && !event.metaKey && body && body.scrollHeight > body.clientHeight) return;
    const delta = event.deltaY;
    if (Math.abs(delta) < 0.01) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    zoomAround(Number((zoom * Math.exp(-delta * 0.0015)).toFixed(3)), event.clientX - rect.left);
  }

  function snapTime(timeUs: number, excludedIds: string[]): { timeUs: number; snapUs: number | null } {
    if (!snapping) return { timeUs: Math.max(0, timeUs), snapUs: null };
    const frameUs = 1_000_000 * project.canvas.fpsDenominator / project.canvas.fpsNumerator;
    const frameSnapped = Math.round(timeUs / frameUs) * frameUs;
    const boundaries = [0, useEditorStore.getState().playheadUs, ...allClips.filter((clip) => clip.kind !== "generated" && !excludedIds.includes(clip.id)).flatMap((clip) => [clip.startUs, clipEnd(clip)])];
    const thresholdUs = SNAP_THRESHOLD_PX / pixelsPerSecond * 1_000_000;
    const closest = boundaries.reduce((best, candidate) => Math.abs(candidate - timeUs) < Math.abs(best - timeUs) ? candidate : best);
    return Math.abs(closest - timeUs) <= thresholdUs
      ? { timeUs: Math.max(0, closest), snapUs: Math.max(0, closest) }
      : { timeUs: Math.max(0, frameSnapped), snapUs: null };
  }

  function seek(event: React.MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest(".timeline-clip, .track-control, .playhead")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    selectClip(null);
    setPlayhead(Math.max(0, Math.min(project.durationUs, originUs + ((event.clientX - rect.left) / pixelsPerSecond) * 1_000_000)));
  }

  function seekPlayhead(clientX: number) {
    const rect = timelineInnerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPlayhead(Math.max(0, Math.min(project.durationUs, originUs + ((clientX - rect.left) / pixelsPerSecond) * 1_000_000)));
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

  function beginDrag(event: React.PointerEvent<HTMLElement>, clip: TimelineClip, mode: DragMode, groupId?: string) {
    const track = project.tracks.find((candidate) => candidate.id === clip.trackId);
    const additive = event.metaKey || event.ctrlKey || event.shiftKey;
    const selectedGroup = clipGroupId(clip);
    const fullGroupSelected = selectedGroup && selectedClipIds.length > 1 && allClips.filter(c => clipGroupId(c) === selectedGroup).every(c => selectedClipIds.includes(c.id));
    if (groupId) selectSceneGroup(groupId);
    else if (additive || (mode !== "move" && fullGroupSelected) || !selectedClipIds.includes(clip.id)) selectClip(clip.id, additive);
    if (clip.locked || track?.locked) return;
    event.preventDefault();
    event.stopPropagation();
    const ids = useEditorStore.getState().selectedClipIds.filter(id => allClips.some(c => c.id === id && !c.locked && !project.tracks.find(t => t.id === c.trackId)?.locked));
    const members = allClips.filter(candidate => groupId ? clipGroupId(candidate) === groupId : candidate.id === clip.id);
    if ((groupId || (fullGroupSelected && mode === "move")) && allClips.filter(c => clipGroupId(c) === (groupId ?? selectedGroup)).some(member => member.locked || project.tracks.find(t => t.id === member.trackId)?.locked)) return;
    const startUs = Math.min(...members.map(c => c.startUs));
    const endUs = Math.max(...members.map(clipEnd));
    event.currentTarget.setPointerCapture(event.pointerId);
    const nextDrag = { clipId: clip.id, clipIds: ids.includes(clip.id) ? ids : [clip.id], groupId, additive, pointerId: event.pointerId, mode, originX: event.clientX, initialStartUs: startUs, initialDurationUs: endUs - startUs, deltaUs: 0, snapUs: null };
    dragRef.current = nextDrag;
    setDrag(nextDrag);
  }

  function updateDrag(event: React.PointerEvent<HTMLElement>) {
    const currentDrag = dragRef.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;
    const rawDelta = (event.clientX - currentDrag.originX) / pixelsPerSecond * 1_000_000;
    const movingIds = currentDrag.clipIds;
    let deltaUs = rawDelta;
    let snapUs: number | null = null;
    if (currentDrag.mode === "move") {
      const startSnap = snapTime(currentDrag.initialStartUs + rawDelta, movingIds);
      const endSnap = snapTime(currentDrag.initialStartUs + currentDrag.initialDurationUs + rawDelta, movingIds);
      const startDelta = startSnap.timeUs - currentDrag.initialStartUs;
      const endDelta = endSnap.timeUs - currentDrag.initialStartUs - currentDrag.initialDurationUs;
      const edgeSnaps = [
        { deltaUs: startDelta, snapUs: startSnap.snapUs },
        { deltaUs: endDelta, snapUs: endSnap.snapUs }
      ].filter((candidate): candidate is { deltaUs: number; snapUs: number } => candidate.snapUs !== null);
      const closestEdge = edgeSnaps.reduce<{ deltaUs: number; snapUs: number } | null>((best, candidate) => (
        !best || Math.abs(candidate.deltaUs - rawDelta) < Math.abs(best.deltaUs - rawDelta) ? candidate : best
      ), null);
      if (closestEdge) {
        deltaUs = closestEdge.deltaUs;
        snapUs = closestEdge.snapUs;
      } else {
        deltaUs = Math.abs(startDelta - rawDelta) <= Math.abs(endDelta - rawDelta) ? startDelta : endDelta;
      }
    } else if (currentDrag.mode === "start") {
      const result = snapTime(currentDrag.initialStartUs + rawDelta, currentDrag.groupId ? movingIds : [currentDrag.clipId]);
      deltaUs = Math.min(result.timeUs - currentDrag.initialStartUs, currentDrag.initialDurationUs - 100_000);
      snapUs = result.snapUs;
    } else {
      const result = snapTime(currentDrag.initialStartUs + currentDrag.initialDurationUs + rawDelta, currentDrag.groupId ? movingIds : [currentDrag.clipId]);
      deltaUs = Math.max(result.timeUs - currentDrag.initialStartUs - currentDrag.initialDurationUs, 100_000 - currentDrag.initialDurationUs);
      snapUs = result.snapUs;
    }
    const requestedDelta = deltaUs;
    if (currentDrag.mode === "move") {
      const earliest = Math.min(...allClips.filter(c => movingIds.includes(c.id)).map(c => c.startUs));
      deltaUs = Math.max(-earliest, deltaUs);
    } else if (currentDrag.groupId) {
      const members = allClips.filter(c => (c.kind === "composition" || c.kind === "scene") && c.sceneGroupId === currentDrag.groupId);
      const ratio = sceneGroupRetimeRatio(members.filter(c => c.kind === "composition" || c.kind === "scene"), (currentDrag.initialDurationUs + deltaUs) / currentDrag.initialDurationUs);
      deltaUs = currentDrag.initialDurationUs * (ratio - 1);
    } else {
      const clip = allClips.find(c => c.id === currentDrag.clipId);
      const minimum = clip?.kind === "subtitle" ? 100_000 : 250_000;
      if (currentDrag.mode === "start") {
        const sourceLimit = clip?.kind === "video" || clip?.kind === "audio" ? -clip.sourceInUs / clip.playbackRate : -currentDrag.initialStartUs;
        deltaUs = Math.max(-currentDrag.initialStartUs, sourceLimit, Math.min(deltaUs, currentDrag.initialDurationUs - minimum));
      } else deltaUs = Math.max(minimum - currentDrag.initialDurationUs, deltaUs);
    }
    if (Math.abs(requestedDelta - deltaUs) > 1) snapUs = null;
    const nextDrag = { ...currentDrag, deltaUs: Math.round(deltaUs), snapUs };
    dragRef.current = nextDrag;
    setDrag(nextDrag);
  }

  function finishDrag(event: React.PointerEvent<HTMLElement>) {
    const currentDrag = dragRef.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (Math.abs(currentDrag.deltaUs) < 1) {
      if (!currentDrag.additive) selectClip(currentDrag.clipId, false);
      if (currentDrag.groupId) selectSceneGroup(currentDrag.groupId);
    } else if (currentDrag.mode === "move") {
      moveClips(currentDrag.clipIds, currentDrag.deltaUs);
    } else if (currentDrag.groupId) {
      retimeSceneGroup(currentDrag.groupId, currentDrag.initialDurationUs + currentDrag.deltaUs);
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
    if (drag.mode === "move" && drag.clipIds.includes(clip.id)) return { startUs: Math.max(0, clip.startUs + drag.deltaUs), durationUs: clip.durationUs };
    if (drag.groupId && clipGroupId(clip) === drag.groupId) {
      const ratio = Math.max(250_000, drag.initialDurationUs + drag.deltaUs) / drag.initialDurationUs;
      return { startUs: Math.round(drag.initialStartUs + (clip.startUs - drag.initialStartUs) * ratio), durationUs: Math.round(clip.durationUs * ratio) };
    }
    if (clip.id !== drag.clipId) return { startUs: clip.startUs, durationUs: clip.durationUs };
    if (drag.mode === "start") return { startUs: Math.max(0, drag.initialStartUs + drag.deltaUs), durationUs: Math.max(100_000, drag.initialDurationUs - drag.deltaUs) };
    return { startUs: clip.startUs, durationUs: Math.max(100_000, drag.initialDurationUs + drag.deltaUs) };
  }

  return (
    <section ref={panelRef} className="timeline-panel" onKeyDown={event => { if (event.key === "Escape" && focus) { event.stopPropagation(); exitFocus(); } }} onPointerMove={updateDrag} onPointerUp={finishDrag} onPointerCancel={cancelDrag}>
      <div className="timeline-height-handle" role="separator" tabIndex={0} aria-label="调整时间线高度" aria-orientation="horizontal" aria-valuemin={160} aria-valuemax={Math.max(160, window.innerHeight - 344)} aria-valuenow={height ?? 286} onKeyDown={(event) => { if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); changeHeight((height ?? panelRef.current?.clientHeight ?? 286) + (event.key === "ArrowUp" ? 24 : -24)); } }} onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); heightDrag.current = { pointerId: event.pointerId, y: event.clientY, height: panelRef.current?.clientHeight ?? 286 }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { event.stopPropagation(); if (heightDrag.current?.pointerId === event.pointerId) changeHeight(heightDrag.current.height + heightDrag.current.y - event.clientY); }} onPointerUp={(event) => { event.stopPropagation(); heightDrag.current = null; }} onPointerCancel={() => { heightDrag.current = null; }} />
      <header className="timeline-header"><strong>时间线</strong><TimelineTimecode />{focus && <button className="timeline-tool" type="button" aria-label="返回完整时间线" title="返回完整时间线" onClick={exitFocus}><ArrowLeft size={14} /></button>}{contextGroupId && <span className="timeline-group-context"><span title={contextLabel}>{contextLabel}</span><button className="timeline-tool" type="button" aria-label="选择整组动效" title="选择整组动效" onClick={() => selectSceneGroup(contextGroupId)}><Group size={14} /></button>{!focus && <button className="timeline-tool" type="button" aria-label="聚焦场景组" title="聚焦场景组" onClick={() => focusGroup(contextGroupId)}><Focus size={14} /></button>}</span>}<button className="timeline-tool" type="button" aria-label="在播放头分割" title="分割片段" disabled={!selectedClipIds.length} onClick={splitSelected}><Scissors size={14} /></button><button className={`timeline-tool ${snapping ? "active" : ""}`} type="button" aria-label="切换吸附" aria-pressed={snapping} title={snapping ? "吸附已开启" : "吸附已关闭"} onClick={() => setSnapping(!snapping)}><Magnet size={14} /></button><span className="timeline-divider" /><button className={`timeline-tool ${rangeStartUs !== null ? "active" : ""}`} type="button" aria-label="设置选区入点" title="设置入点 (I)" onClick={() => setRangeStart(useEditorStore.getState().playheadUs)}><BetweenHorizontalStart size={14} /></button><button className={`timeline-tool ${rangeEndUs !== null ? "active" : ""}`} type="button" aria-label="设置选区出点" title="设置出点 (O)" onClick={() => setRangeEnd(useEditorStore.getState().playheadUs)}><BetweenHorizontalEnd size={14} /></button><button className="timeline-tool" type="button" aria-label="清除时间选区" title="清除选区" disabled={rangeStartUs === null && rangeEndUs === null} onClick={clearRange}><X size={13} /></button>{range && <span className="range-summary">{formatTime(range.startUs)} – {formatTime(range.endUs)} · {((range.endUs - range.startUs) / 1_000_000).toFixed(2)}s</span>}<div className="zoom-control"><ZoomIn size={14} /><button type="button" aria-label="缩小时间线" onClick={() => zoomAround(zoom - 0.2, timelineScrollRef.current?.clientWidth ? timelineScrollRef.current.clientWidth / 2 : 0)}><Minus size={13} /></button><output>{Math.round(zoom * 100)}%</output><button type="button" aria-label="放大时间线" onClick={() => zoomAround(zoom + 0.2, timelineScrollRef.current?.clientWidth ? timelineScrollRef.current.clientWidth / 2 : 0)}><Plus size={13} /></button></div></header>
      <div className="timeline-body">
        <div className="track-labels"><div className="ruler-spacer" />{rows.map(row => row.kind === "track"
          ? <TrackLabel key={row.id} track={row.track} expanded={focus ? undefined : row.expanded} onToggle={() => toggleRow(row.id)} onChange={(patch) => setTrackState(row.track.id, patch)} />
          : <div key={row.id} className="timeline-row-label row-lane" style={{ paddingLeft: 16 }}><span className="track-name">{row.label}</span></div>)}</div>
        <div className="timeline-scroll" ref={timelineScrollRef} onWheel={zoomWithWheel}><div className="timeline-inner" ref={timelineInnerRef} style={{ width }} onClick={seek}>
          <div className="time-ruler">{ticks.map((tick) => <span key={tick} style={{ left: timeLeft(tick * 1_000_000) }}>{formatTime(tick * 1_000_000)}</span>)}</div>
          {rows.map((row) => <div className={`track-row row-${row.kind} ${row.track.locked ? "locked" : ""} ${row.track.hidden ? "hidden-track" : ""}`} key={row.id}>
            {row.expanded === false && row.members.length > 0 && <button type="button" className="timeline-clip timeline-summary" style={{ left: timeLeft(Math.min(...row.members.map(c => c.startUs))), width: Math.max(34, (Math.max(...row.members.map(clipEnd)) - Math.min(...row.members.map(c => c.startUs))) / 1_000_000 * pixelsPerSecond) }} aria-label={`展开${row.label}内容`} onClick={event => { event.stopPropagation(); toggleRow(row.id); }}><span>{row.members.length} 个片段</span></button>}
            {row.clips.map((clip) => {
            const waveform = clip.kind === "video" || clip.kind === "audio" ? project.assets.find((asset) => asset.id === clip.assetId)?.waveformPath : undefined;
            const timing = draftTiming(clip);
            const grouped = (clip.kind === "composition" || clip.kind === "scene") && Boolean(clip.sceneGroupId);
            return <button type="button" key={clip.id} className={`timeline-clip clip-${clip.kind} ${selectedClipIds.includes(clip.id) ? "selected" : ""} ${grouped ? "grouped" : ""} ${clip.locked ? "locked" : ""}`} style={{ left: timeLeft(timing.startUs), width: Math.max(34, timing.durationUs / 1_000_000 * pixelsPerSecond), ...(waveform ? { "--waveform": `url('${localMediaUrl(waveform).replaceAll("'", "%27")}')` } : {}) } as React.CSSProperties} onPointerDown={(event) => beginDrag(event, clip, dragModeForTarget(event.target))} onPointerMove={updateDrag} onPointerUp={finishDrag} onPointerCancel={cancelDrag} onClick={(event) => { event.stopPropagation(); if (event.detail === 0) selectClip(clip.id, event.metaKey || event.ctrlKey || event.shiftKey); }} onDoubleClick={() => { const group = clipGroupId(clip); if (group) focusGroup(group); }} aria-pressed={selectedClipIds.includes(clip.id)} title={grouped ? `${clip.label} · 场景组` : clip.label}><i className="resize-handle start" />{clip.kind === "video" && clip.presentationCues?.map((cue) => <i key={cue.id} className="motion-cue-marker" style={{ left: `${cue.offsetUs / Math.max(1, clip.durationUs) * 100}%` }} title={`${(cue.offsetUs / 1_000_000).toFixed(2)}s · ${cue.presetId}`} />)}<span>{grouped && <Layers3 className="clip-group-mark" size={11} aria-hidden="true" />}{clip.label}</span><i className="resize-handle end" /></button>;
          })}</div>)}
          {visibleRange && <span className="timeline-range" style={{ left: timeLeft(visibleRange.startUs), width: ((visibleRange.endUs - visibleRange.startUs) / 1_000_000) * pixelsPerSecond }} />}
          {drag?.snapUs != null && <span className="timeline-snap-guide" style={{ left: timeLeft(drag.snapUs) }} />}
          <TimelinePlayhead pixelsPerSecond={pixelsPerSecond} originUs={originUs} endUs={focus ? viewEndUs : undefined} onMouseDown={beginPlayheadMouseDrag} onPointerDown={beginPlayheadDrag} onPointerMove={updatePlayheadDrag} onPointerUp={finishPlayheadDrag} onPointerCancel={cancelPlayheadDrag} />
        </div></div>
      </div>
      {drag && <output className="timeline-drag-readout">{(drag.initialStartUs / 1_000_000 + (drag.mode === "end" ? 0 : drag.deltaUs / 1_000_000)).toFixed(3)}s · {((drag.initialDurationUs + (drag.mode === "end" ? drag.deltaUs : drag.mode === "start" ? -drag.deltaUs : 0)) / 1_000_000).toFixed(3)}s</output>}
    </section>
  );
}

function TimelineTimecode() {
  const playheadUs = useEditorStore((state) => state.playheadUs);
  return <span>{formatTime(playheadUs)}</span>;
}

function TimelinePlayhead({ pixelsPerSecond, originUs, endUs, onMouseDown, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }: {
  pixelsPerSecond: number;
  originUs: number;
  endUs?: number;
  onMouseDown: React.MouseEventHandler<HTMLButtonElement>;
  onPointerDown: React.PointerEventHandler<HTMLButtonElement>;
  onPointerMove: React.PointerEventHandler<HTMLButtonElement>;
  onPointerUp: React.PointerEventHandler<HTMLButtonElement>;
  onPointerCancel: React.PointerEventHandler<HTMLButtonElement>;
}) {
  const playheadUs = useEditorStore((state) => state.playheadUs);
  if (endUs !== undefined && (playheadUs < originUs || playheadUs > endUs)) return null;
  return <button className="playhead" type="button" aria-label="拖动播放头" title="拖动播放头" style={{ left: (playheadUs - originUs) / 1_000_000 * pixelsPerSecond }} onMouseDown={onMouseDown} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onClick={(event) => event.stopPropagation()}><i /></button>;
}

function TrackLabel({ track, expanded, onToggle, onChange }: { track: TimelineTrack; expanded?: boolean; onToggle: () => void; onChange: (patch: { locked?: boolean; muted?: boolean; hidden?: boolean }) => void }) {
  return <div>{expanded !== undefined ? <button type="button" className="track-control" aria-label={`${expanded ? "折叠" : "展开"}${track.name}轨道`} aria-expanded={expanded} onClick={onToggle}>{expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</button> : <span className={`type-dot ${track.kind}`} />}<span className="track-name">{track.name}</span><span className="track-controls"><button className="track-control" type="button" aria-label={`${track.name}${track.locked ? "解锁" : "锁定"}`} onClick={() => onChange({ locked: !track.locked })}>{track.locked ? <Lock size={11} /> : <Unlock size={11} />}</button><button className="track-control" type="button" aria-label={`${track.name}${track.hidden ? "显示" : "隐藏"}`} onClick={() => onChange({ hidden: !track.hidden })}>{track.hidden ? <EyeOff size={11} /> : <Eye size={11} />}</button>{(track.kind === "video" || track.kind === "audio") && <button className="track-control" type="button" aria-label={`${track.name}${track.muted ? "取消静音" : "静音"}`} onClick={() => onChange({ muted: !track.muted })}>{track.muted ? <VolumeX size={11} /> : <Volume2 size={11} />}</button>}</span></div>;
}

export function formatTime(timeUs: number) {
  const totalSeconds = Math.max(0, timeUs / 1_000_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const frames = Math.floor((totalSeconds % 1) * 30);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
}
