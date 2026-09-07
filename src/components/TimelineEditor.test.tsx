import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Timeline } from "@/components/TimelineEditor";
import { createEmptyProject } from "@/domain/project";
import { useEditorStore } from "@/stores/editorStore";

beforeEach(() => {
  useEditorStore.setState({ project: createEmptyProject(), selectedClipId: null, selectedClipIds: [], playheadUs: 8_000_000, zoom: 1, rangeStartUs: 2_000_000, rangeEndUs: 8_000_000, past: [], future: [], clipboard: [] });
});

describe("Timeline interactions", () => {
  it("shows overlapping compositions on separate collapsible rows without grouping their selection", () => {
    useEditorStore.getState().setPlayhead(0);
    useEditorStore.getState().addComposition("background-stripes");
    useEditorStore.getState().addComposition("background-dots");
    const clips = useEditorStore.getState().project.tracks.flatMap(t => t.clips);
    render(<Timeline />);
    const first = screen.getByRole("button", { name: "斜向条纹" });
    fireEvent.pointerDown(first, { pointerId: 8, clientX: 150 });
    fireEvent.pointerUp(first, { pointerId: 8, clientX: 150 });
    expect(useEditorStore.getState().selectedClipIds).toEqual([clips[0].id]);
    fireEvent.click(screen.getByRole("button", { name: "折叠动效轨道" }));
    expect(screen.queryByRole("button", { name: "斜向条纹" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开动效轨道" }));
    expect(screen.getByRole("button", { name: "点阵律动" })).toBeInTheDocument();
  });
  it("selects a group from contextual tools and can focus or return to one member", () => {
    useEditorStore.getState().addComposition("scene-focus-stack");
    const clips = useEditorStore.getState().project.tracks.flatMap(t => t.clips);
    render(<Timeline />);
    fireEvent.click(screen.getByRole("button", { name: "选择整组动效" }));
    expect(useEditorStore.getState().selectedClipIds).toHaveLength(clips.length);
    const first = screen.getByRole("button", { name: clips[0].label });
    fireEvent.pointerDown(first, { pointerId: 9, clientX: 150 });
    fireEvent.pointerUp(first, { pointerId: 9, clientX: 150 });
    expect(useEditorStore.getState().selectedClipIds).toEqual([clips[0].id]);
    const project = useEditorStore.getState().project;
    fireEvent.click(screen.getByRole("button", { name: "聚焦场景组" }));
    expect(screen.queryByRole("button", { name: "字幕锁定" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: clips[0].label })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "返回完整时间线" }));
    expect(screen.getByRole("button", { name: "字幕锁定" })).toBeInTheDocument();
    expect(useEditorStore.getState().project).toBe(project);
  });
  it("moves selected group members together but trims only the dragged member", () => {
    useEditorStore.getState().addComposition("scene-focus-stack");
    const clips = useEditorStore.getState().project.tracks.flatMap(t => t.clips);
    const { container } = render(<Timeline />);
    fireEvent.click(screen.getByRole("button", { name: "切换吸附" }));
    fireEvent.click(screen.getByRole("button", { name: "选择整组动效" }));
    const first = screen.getByRole("button", { name: clips[0].label });
    fireEvent.pointerDown(first, { pointerId: 13, clientX: 150 });
    fireEvent.pointerMove(first, { pointerId: 13, clientX: 174 });
    expect(useEditorStore.getState().project.tracks.flatMap(t => t.clips).map(c => c.startUs)).toEqual(clips.map(c => c.startUs));
    expect(container.querySelectorAll(".track-row")).toHaveLength(9);
    fireEvent.pointerUp(first, { pointerId: 13, clientX: 174 });
    expect(useEditorStore.getState().project.tracks.flatMap(t => t.clips).map(c => c.startUs)).toEqual(clips.map(c => c.startUs + 1_000_000));
    const edge = first.querySelector(".resize-handle.end")!;
    fireEvent.pointerDown(edge, { pointerId: 14, clientX: 174 });
    fireEvent.pointerMove(first, { pointerId: 14, clientX: 150 });
    fireEvent.pointerUp(first, { pointerId: 14, clientX: 150 });
    expect(useEditorStore.getState().project.tracks.flatMap(t => t.clips).map(c => c.durationUs)).toEqual(clips.map((c, i) => c.durationUs - (i === 0 ? 1_000_000 : 0)));
  });
  it("uses absolute microseconds when seeking in a focused group", () => {
    useEditorStore.getState().addComposition("scene-focus-stack");
    const { container } = render(<Timeline />);
    fireEvent.click(screen.getByRole("button", { name: "聚焦场景组" }));
    const inner = container.querySelector<HTMLElement>(".timeline-inner")!;
    inner.getBoundingClientRect = () => ({ x: 100, y: 0, left: 100, top: 0, right: 900, bottom: 200, width: 800, height: 200, toJSON: () => ({}) });
    fireEvent.click(inner, { clientX: 100 });
    expect(useEditorStore.getState().playheadUs).toBe(7_000_000);
    fireEvent.keyDown(inner, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "返回完整时间线" })).not.toBeInTheDocument();
  });
  it("seeks into focus and restores the full timeline viewport without changing the project", () => {
    useEditorStore.getState().addComposition("scene-focus-stack");
    useEditorStore.getState().setPlayhead(0);
    const project = useEditorStore.getState().project;
    const { container } = render(<Timeline />);
    const scroll = container.querySelector<HTMLElement>(".timeline-scroll")!;
    const body = container.querySelector<HTMLElement>(".timeline-body")!;
    Object.defineProperty(scroll, "clientWidth", { configurable: true, value: 400 });
    scroll.scrollLeft = 300;
    body.scrollTop = 24;
    fireEvent.click(screen.getByRole("button", { name: "聚焦场景组" }));
    expect(useEditorStore.getState().playheadUs).toBe(8_000_000);
    expect(scroll.scrollLeft).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "放大时间线" }));
    fireEvent.click(screen.getByRole("button", { name: "返回完整时间线" }));
    expect(useEditorStore.getState().zoom).toBe(1);
    expect(scroll.scrollLeft).toBe(300);
    expect(body.scrollTop).toBe(24);
    expect(useEditorStore.getState().project).toBe(project);
  });
  it("resizes the timeline with keyboard controls and cleans up the workspace height", () => {
    const { container, unmount } = render(<div className="editor-workspace"><Timeline /></div>);
    const workspace = container.querySelector<HTMLElement>(".editor-workspace")!;
    Object.defineProperty(workspace, "clientHeight", { value: 800 });
    const handle = screen.getByRole("separator", { name: "调整时间线高度" });
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(workspace.style.getPropertyValue("--timeline-height")).toBe("160px");
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(workspace.style.getPropertyValue("--timeline-height")).toBe("184px");
    unmount();
    expect(workspace.style.getPropertyValue("--timeline-height")).toBe("");
  });
  it("shows effects without an independent scene track", () => {
    render(<Timeline />);
    expect(screen.queryByText("场景")).not.toBeInTheDocument();
    expect(screen.queryByText("AI 内容")).not.toBeInTheDocument();
    expect(screen.getByText("动效")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "场景锁定" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "动效锁定" })).toBeInTheDocument();
  });

  it("shows and clears a normalized in/out range", () => {
    const { container } = render(<Timeline />);
    expect(screen.getByText(/6\.00s/u)).toBeInTheDocument();
    expect(container.querySelector(".timeline-range")).toHaveStyle({ left: "48px", width: "144px" });
    fireEvent.click(screen.getByRole("button", { name: "清除时间选区" }));
    expect(useEditorStore.getState()).toMatchObject({ rangeStartUs: null, rangeEndUs: null });
    expect(container.querySelector(".timeline-range")).not.toBeInTheDocument();
  });

  it("sets in and out points from the current playhead", () => {
    useEditorStore.getState().clearRange();
    render(<Timeline />);
    fireEvent.click(screen.getByRole("button", { name: "设置选区入点" }));
    expect(useEditorStore.getState().rangeStartUs).toBe(8_000_000);
    act(() => useEditorStore.getState().setPlayhead(12_000_000));
    fireEvent.click(screen.getByRole("button", { name: "设置选区出点" }));
    expect(useEditorStore.getState().rangeEndUs).toBe(12_000_000);
  });

  it("zooms with the mouse wheel and does not render a zoom slider", () => {
    const { container } = render(<Timeline />);
    const scroll = container.querySelector<HTMLElement>(".timeline-scroll")!;
    Object.defineProperty(scroll, "clientWidth", { configurable: true, value: 800 });
    scroll.getBoundingClientRect = () => ({ x: 100, y: 0, left: 100, top: 0, right: 900, bottom: 200, width: 800, height: 200, toJSON: () => ({}) });
    scroll.scrollLeft = 200;

    fireEvent.wheel(scroll, { clientX: 500, deltaY: -100 });
    expect(useEditorStore.getState().zoom).toBeGreaterThan(1);
    expect(screen.queryByRole("slider", { name: "时间线缩放" })).not.toBeInTheDocument();

    fireEvent.wheel(scroll, { clientX: 500, deltaY: 100 });
    expect(useEditorStore.getState().zoom).toBeCloseTo(1, 2);
  });

  it("drags the playhead to seek along the timeline", () => {
    useEditorStore.setState((state) => ({
      project: { ...state.project, durationUs: 30_000_000 },
      playheadUs: 5_000_000
    }));
    const { container } = render(<Timeline />);
    const timeline = container.querySelector<HTMLElement>(".timeline-inner")!;
    const playhead = screen.getByRole("button", { name: "拖动播放头" });
    timeline.getBoundingClientRect = () => ({ x: 100, y: 0, left: 100, top: 0, right: 820, bottom: 200, width: 720, height: 200, toJSON: () => ({}) });

    fireEvent.pointerDown(playhead, { pointerId: 4, clientX: 220 });
    fireEvent.pointerMove(playhead, { pointerId: 4, clientX: 460 });
    fireEvent.pointerUp(playhead, { pointerId: 4, clientX: 460 });

    expect(useEditorStore.getState().playheadUs).toBe(15_000_000);
    expect(playhead).toHaveStyle({ left: "360px" });
  });

  it("keeps dragging the playhead after the mouse leaves its hit area", () => {
    useEditorStore.setState((state) => ({
      project: { ...state.project, durationUs: 30_000_000 },
      playheadUs: 5_000_000
    }));
    const { container } = render(<Timeline />);
    const timeline = container.querySelector<HTMLElement>(".timeline-inner")!;
    const playhead = screen.getByRole("button", { name: "拖动播放头" });
    timeline.getBoundingClientRect = () => ({ x: 100, y: 0, left: 100, top: 0, right: 820, bottom: 200, width: 720, height: 200, toJSON: () => ({}) });

    fireEvent.mouseDown(playhead, { clientX: 220 });
    fireEvent.mouseMove(window, { clientX: 580 });
    fireEvent.mouseUp(window, { clientX: 580 });

    expect(useEditorStore.getState().playheadUs).toBe(20_000_000);
  });

  it("snaps a moved clip to a nearby material edge before frame rounding", () => {
    const state = useEditorStore.getState();
    const project = createEmptyProject();
    const track = project.tracks.find((candidate) => candidate.kind === "video")!;
    const base = { trackId: track.id, kind: "video" as const, locked: false, assetId: "video", sourceInUs: 0, playbackRate: 1, volume: 0, fit: "cover" as const, camera: { preset: "none" as const, startScale: 1, endScale: 1, startX: 0, endX: 0, startY: 0, endY: 0, easing: "linear" as const } };
    track.clips.push(
      { ...base, id: "first", label: "前段", startUs: 0, durationUs: 2_000_000 },
      { ...base, id: "second", label: "后段", startUs: 4_000_000, durationUs: 2_000_000 }
    );
    useEditorStore.setState({ ...state, project, selectedClipId: null, selectedClipIds: [], playheadUs: 8_000_000 });
    const { container } = render(<Timeline />);
    const second = screen.getByRole("button", { name: "后段" });
    Object.defineProperty(second, "setPointerCapture", { configurable: true, value: () => undefined });

    fireEvent.pointerDown(second, { pointerId: 7, clientX: 200 });
    fireEvent.pointerMove(second, { pointerId: 7, clientX: 155.6 });

    expect(container.querySelector(".timeline-snap-guide")).toHaveStyle({ left: "48px" });
    fireEvent.pointerUp(second, { pointerId: 7, clientX: 155.6 });
    expect(useEditorStore.getState().project.tracks.flatMap((candidate) => candidate.clips).find((clip) => clip.id === "second")?.startUs).toBe(2_000_000);

    const magnet = screen.getByRole("button", { name: "切换吸附" });
    expect(magnet).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(magnet);
    fireEvent.pointerDown(second, { pointerId: 8, clientX: 200 });
    fireEvent.pointerMove(second, { pointerId: 8, clientX: 203.6 });
    fireEvent.pointerUp(second, { pointerId: 8, clientX: 203.6 });
    expect(useEditorStore.getState().project.tracks.flatMap((candidate) => candidate.clips).find((clip) => clip.id === "second")?.startUs).toBe(2_150_000);
  });
});
