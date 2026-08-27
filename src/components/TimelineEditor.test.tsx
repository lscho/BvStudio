import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Timeline } from "@/components/TimelineEditor";
import { createEmptyProject } from "@/domain/project";
import { useEditorStore } from "@/stores/editorStore";

beforeEach(() => {
  useEditorStore.setState({ project: createEmptyProject(), selectedClipId: null, selectedClipIds: [], playheadUs: 8_000_000, zoom: 1, rangeStartUs: 2_000_000, rangeEndUs: 8_000_000, past: [], future: [], clipboard: [] });
});

describe("Timeline range selection", () => {
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
});
