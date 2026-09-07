import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CompositionInspector } from "@/components/CompositionInspector";
import { createEmptyProject, type CompositionClip } from "@/domain/project";
import { useEditorStore } from "@/stores/editorStore";

function selected() {
  const clip = useEditorStore.getState().project.tracks.flatMap((track) => track.clips).find((item): item is CompositionClip => item.kind === "composition");
  if (!clip) throw new Error("Missing test composition");
  return clip;
}
beforeEach(() => {
  useEditorStore.setState({ project: createEmptyProject(), past: [], future: [], selectedClipIds: [], playheadUs: 0 });
  useEditorStore.getState().addComposition("poster-wall-3d");
});
describe("composition inspector", () => {
  it("edits a background's actual layer with undo and redo", () => {
    useEditorStore.setState({ project: createEmptyProject(), selectedClipId: null, selectedClipIds: [], past: [], future: [] });
    useEditorStore.getState().addComposition("background-grid");
    const view = render(<CompositionInspector clip={selected()} />);
    expect(screen.getByRole("spinbutton", { name: "动效层级" })).toHaveValue(0);
    fireEvent.change(screen.getByRole("spinbutton", { name: "动效层级" }), { target: { value: "240" } });
    expect(selected().zIndex).toBe(240);
    useEditorStore.getState().undo();
    expect(selected().zIndex).toBe(0);
    useEditorStore.getState().redo();
    expect(selected().zIndex).toBe(240);
    useEditorStore.getState().setTrackState(selected().trackId, { locked: true });
    view.rerender(<CompositionInspector clip={selected()} />);
    expect(screen.getByRole("spinbutton", { name: "动效层级" })).toBeDisabled();
  });

  it("edits the whole scene transform independently of its materials and supports reset", () => {
    const before = selected();
    const view = render(<CompositionInspector clip={before} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "水平位置（%）" }), { target: { value: "25" } });
    view.rerender(<CompositionInspector clip={selected()} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "缩放（%）" }), { target: { value: "50" } });
    view.rerender(<CompositionInspector clip={selected()} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "旋转（度）" }), { target: { value: "30" } });
    expect(selected().transform).toMatchObject({ x: 25, scale: 0.5, rotation: 30 });
    expect(selected().params).toEqual(before.params);
    expect(selected().bindings).toEqual(before.bindings);
    view.rerender(<CompositionInspector clip={selected()} />);
    fireEvent.click(screen.getByRole("button", { name: "重置整体变换" }));
    expect(selected().transform).toEqual(before.transform);
    useEditorStore.getState().undo();
    expect(selected().transform).toMatchObject({ x: 25, scale: 0.5, rotation: 30 });
  });
  it("disables scene positioning on locked tracks", () => {
    useEditorStore.getState().setTrackState(selected().trackId, { locked: true });
    render(<CompositionInspector clip={selected()} />);
    expect(screen.getByRole("spinbutton", { name: "缩放（%）" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "重置整体变换" })).toBeDisabled();
  });
  it("shows input requirements and disables playback for an incomplete composition", () => {
    render(<CompositionInspector clip={selected()} />);
    expect(screen.getByRole("status")).toHaveTextContent("海报需要 2–12 张图片");
    expect(screen.getByRole("button", { name: "播放动效" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "导入海报图片" })).toBeEnabled();
  });
  it("reorders and removes assets without modifying their media records", () => {
    useEditorStore.getState().bindCompositionAssets(selected().id, [{ slotId: "posters", assetIds: ["a", "b"] }], ["a", "b"].map(id => ({ id, name: id, kind: "image", durationUs: 0 })));
    const view = render(<CompositionInspector clip={selected()} />);
    fireEvent.click(screen.getByRole("button", { name: "上移海报第 2 张" }));
    expect(selected().bindings?.[0].assetIds).toEqual(["b", "a"]);
    view.rerender(<CompositionInspector clip={selected()} />);
    fireEvent.click(screen.getByRole("button", { name: "移除海报第 1 张" }));
    expect(selected().bindings?.[0].assetIds).toEqual(["a"]);
    expect(useEditorStore.getState().project.assets).toHaveLength(2);
  });
});
