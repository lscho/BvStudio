import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { InspectorPanel } from "@/components/InspectorPanel";
import { createEmptyProject, type CompositionClip } from "@/domain/project";
import { useEditorStore } from "@/stores/editorStore";

const clips = () => useEditorStore.getState().project.tracks.flatMap(t => t.clips).filter((c): c is CompositionClip => c.kind === "composition");
beforeEach(() => {
  useEditorStore.setState({ project: createEmptyProject(), selectedClipId: null, selectedClipIds: [], playheadUs: 0, past: [], future: [] });
  useEditorStore.getState().addComposition("background-stripes");
});

describe("composition timing inputs", () => {
  it("commits microseconds once on blur and separates trimming from retiming", () => {
    render(<InspectorPanel />);
    const start = screen.getByRole("spinbutton", { name: "开始时间（秒）" });
    const history = useEditorStore.getState().past.length;
    fireEvent.change(start, { target: { value: "1.234567" } });
    expect(clips()[0].startUs).toBe(0);
    fireEvent.blur(start);
    expect(clips()[0].startUs).toBe(1_234_567);
    expect(useEditorStore.getState().past).toHaveLength(history + 1);
    const end = screen.getByRole("spinbutton", { name: "结束时间（秒）" });
    fireEvent.change(end, { target: { value: "4.234567" } }); fireEvent.blur(end);
    expect(clips()[0]).toMatchObject({ durationUs: 3_000_000, animationDurationUs: 6_000_000 });
    const duration = screen.getByRole("spinbutton", { name: "播放时长（秒）" });
    fireEvent.change(duration, { target: { value: "6" } }); fireEvent.blur(duration);
    expect(clips()[0]).toMatchObject({ durationUs: 6_000_000, animationDurationUs: 12_000_000 });
  });
  it("restores invalid inputs and displays the clamped committed duration", () => {
    useEditorStore.getState().addComposition("motion-zoom");
    render(<InspectorPanel />);
    let duration = screen.getByRole("spinbutton", { name: "播放时长（秒）" });
    fireEvent.change(duration, { target: { value: "100" } }); fireEvent.blur(duration);
    duration = screen.getByRole("spinbutton", { name: "播放时长（秒）" });
    expect(duration).toHaveValue(10);
    fireEvent.change(duration, { target: { value: "200" } }); fireEvent.blur(duration);
    expect(duration).toHaveValue(10);
    fireEvent.change(duration, { target: { value: "-2" } }); fireEvent.blur(duration);
    expect(duration).toHaveValue(10);
    fireEvent.change(duration, { target: { value: "" } }); fireEvent.blur(duration);
    expect(duration).toHaveValue(10);
  });
  it("edits a group explicitly and disables timing when any member is locked", () => {
    useEditorStore.getState().addComposition("background-dots");
    for (const clip of clips()) useEditorStore.getState().updateComposition(clip.id, { sceneGroupId: "g" });
    useEditorStore.getState().selectSceneGroup("g");
    const { unmount } = render(<InspectorPanel />);
    const duration = screen.getByRole("spinbutton", { name: "整组时长（秒）" });
    fireEvent.change(duration, { target: { value: "9" } }); fireEvent.blur(duration);
    expect(clips().map(c => c.durationUs)).toEqual([9_000_000, 9_000_000]);
    fireEvent.click(screen.getByRole("button", { name: "斜向条纹" }));
    expect(useEditorStore.getState().selectedClipIds).toEqual([clips()[0].id]);
    expect(screen.queryByRole("spinbutton", { name: "整组时长（秒）" })).not.toBeInTheDocument();
    unmount();
    useEditorStore.getState().updateComposition(clips()[1].id, { locked: true });
    useEditorStore.getState().selectSceneGroup("g");
    render(<InspectorPanel />);
    expect(screen.getByRole("spinbutton", { name: "整组时长（秒）" })).toBeDisabled();
    expect(screen.getByRole("spinbutton", { name: "整组开始（秒）" })).toBeDisabled();
  });
});
