import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Timeline } from "@/components/TimelineEditor";
import { createEmptyProject } from "@/domain/project";
import { useEditorStore } from "@/stores/editorStore";

beforeEach(() => {
  useEditorStore.setState({ project: createEmptyProject(), selectedClipId: null, selectedClipIds: [], playheadUs: 8_000_000, zoom: 1, rangeStartUs: 2_000_000, rangeEndUs: 8_000_000, past: [], future: [], clipboard: [] });
});

describe("Timeline interactions", () => {
  it("shows independent scene and effect tracks", () => {
    render(<Timeline />);
    expect(screen.getByText("场景")).toBeInTheDocument();
    expect(screen.getByText("动效")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "场景锁定" })).toBeInTheDocument();
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
});
