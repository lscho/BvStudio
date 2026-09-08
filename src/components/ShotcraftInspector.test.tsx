import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { InspectorPanel } from "@/components/InspectorPanel";
import { createEmptyProject, type CompositionClip } from "@/domain/project";
import { useEditorStore } from "@/stores/editorStore";

const current = () => useEditorStore.getState().project.tracks.flatMap((track) => track.clips).find((clip): clip is CompositionClip => clip.kind === "composition")!;
beforeEach(() => useEditorStore.setState({ project: createEmptyProject(), selectedClipId: null, selectedClipIds: [], playheadUs: 0, past: [], future: [], previewRequest: null }));

describe("Shotcraft inspector", () => {
  it("edits hold time without exposing an unrelated outer background", () => {
    useEditorStore.getState().addComposition("shotcraft-blur-slide");
    render(<InspectorPanel />);
    const input = screen.getByRole("spinbutton", { name: "额外停留（秒）" });
    fireEvent.change(input, { target: { value: "1" } });
    fireEvent.blur(input);
    expect(current().shotcraft?.holdUs).toBe(1_000_000);
    expect(current().durationUs).toBe(4_800_000);
    expect(screen.queryByText("整体背景")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "镜头转场" })).toBeDisabled();
    act(() => useEditorStore.getState().undo());
    expect(current().shotcraft?.holdUs).toBe(0);
  });

  it("bounds a screenshot region and disables shot controls on locked tracks", () => {
    useEditorStore.getState().addComposition("shotcraft-spotlight-hero-card");
    render(<InspectorPanel />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "焦点左侧（%）" }), { target: { value: "95" } });
    expect(current().shotcraft?.regions[0]).toMatchObject({ x: 70, width: 30 });
    act(() => useEditorStore.getState().setTrackState(current().trackId, { locked: true }));
    expect(screen.getByRole("spinbutton", { name: "焦点宽度（%）" })).toBeDisabled();
    expect(screen.getByRole("spinbutton", { name: "额外停留（秒）" })).toBeDisabled();
  });
});
