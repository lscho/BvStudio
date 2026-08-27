import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { InspectorPanel } from "@/components/InspectorPanel";
import { createEmptyProject, type GeneratedBlock } from "@/domain/project";
import { useEditorStore } from "@/stores/editorStore";
import { cameraMotionForPreset } from "@/domain/camera";

function generatedClip(): GeneratedBlock {
  return {
    id: "generated",
    trackId: "generated-main",
    kind: "generated",
    label: "AI 片段",
    startUs: 0,
    durationUs: 3_000_000,
    locked: false,
    article: "文章",
    narration: "口播",
    prompt: "主题",
    insertMode: "insert",
    scenes: [{
      id: "scene",
      title: "增长 42%",
      narration: "分镜口播",
      durationUs: 3_000_000,
      effectId: "number-pop",
      textColor: "#ffffff",
      accentColor: "#47d7ac",
      fontSize: 58,
      speed: 1,
      transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 },
      mediaAssetId: "video",
      mediaSourceInUs: 1_000_000,
      mediaFit: "cover",
      mediaVolume: 0,
      camera: cameraMotionForPreset("push-in"),
      recipe: { layout: "number", entrance: "pop", paddingX: 18, paddingY: 8, borderWidth: 0, borderRadius: 2, backgroundOpacity: 0 }
    }]
  };
}

beforeEach(() => {
  const project = createEmptyProject();
  project.assets.push({ id: "video", name: "growth.mp4", kind: "video", durationUs: 10_000_000, sourcePath: "/growth.mp4", missing: false });
  project.tracks.find((track) => track.kind === "generated")!.clips.push(generatedClip());
  useEditorStore.setState({ project, selectedClipId: "generated", selectedClipIds: ["generated"], playheadUs: 0, zoom: 1, past: [], future: [], clipboard: [] });
});

describe("InspectorPanel AI scenes", () => {
  it("shows material selection and every requested effect adjustment", () => {
    render(<InspectorPanel />);
    expect(screen.getByText("AI 复合片段")).toBeInTheDocument();
    expect(screen.getByLabelText("本地视频素材")).toHaveValue("video");
    expect(screen.getByLabelText("动效类型")).toHaveValue("number-pop");
    for (const name of ["字号", "速度", "水平位置", "垂直位置", "大小", "旋转", "透明度", "素材音量"]) {
      expect(screen.getByRole("slider", { name: new RegExp(name) })).toBeInTheDocument();
    }
    expect(screen.getByLabelText("文字颜色")).toHaveValue("#ffffff");
    expect(screen.getByLabelText("强调色")).toHaveValue("#47d7ac");
    expect(screen.getByLabelText("运镜预设")).toHaveValue("push-in");
  });

  it("persists manual scene adjustments through the editor store", () => {
    render(<InspectorPanel />);
    fireEvent.change(screen.getByRole("slider", { name: /速度/ }), { target: { value: "1.8" } });
    fireEvent.change(screen.getByRole("slider", { name: /水平位置/ }), { target: { value: "72" } });
    fireEvent.change(screen.getByLabelText("动效类型"), { target: { value: "quote-card" } });
    fireEvent.change(screen.getByLabelText("运镜预设"), { target: { value: "pan-left" } });
    const clip = useEditorStore.getState().project.tracks.flatMap((track) => track.clips).find((item) => item.id === "generated");
    expect(clip?.kind).toBe("generated");
    if (clip?.kind !== "generated") return;
    expect(clip.scenes[0]).toMatchObject({ effectId: "quote-card", speed: 1.8, transform: { x: 72 }, recipe: { layout: "frame" }, camera: { preset: "pan-left", startScale: 1.16, endScale: 1.16 } });
  });

  it("allows choosing any source in-point when a short matched video loops", () => {
    const state = useEditorStore.getState();
    const project = structuredClone(state.project);
    project.assets[0].durationUs = 1_000_000;
    useEditorStore.setState({ ...state, project });
    render(<InspectorPanel />);

    const sourceIn = screen.getByRole("spinbutton", { name: /素材入点/ });
    expect(sourceIn).toHaveAttribute("max", "0.999999");
    fireEvent.change(sourceIn, { target: { value: "0.8" } });

    const clip = useEditorStore.getState().project.tracks.flatMap((track) => track.clips).find((item) => item.id === "generated");
    expect(clip?.kind === "generated" ? clip.scenes[0].mediaSourceInUs : null).toBe(800_000);
  });

  it("edits camera motion independently on an ordinary video clip", () => {
    const state = useEditorStore.getState();
    const project = createEmptyProject();
    project.assets.push(state.project.assets[0]);
    project.tracks.find((track) => track.kind === "video")!.clips.push({ id: "video-clip", trackId: "video-main", kind: "video", label: "growth.mp4", startUs: 0, durationUs: 5_000_000, locked: false, assetId: "video", sourceInUs: 0, playbackRate: 1, volume: 1, fit: "cover", camera: cameraMotionForPreset("none") });
    useEditorStore.setState({ ...state, project, selectedClipId: "video-clip", selectedClipIds: ["video-clip"] });
    render(<InspectorPanel />);

    fireEvent.change(screen.getByLabelText("运镜预设"), { target: { value: "pull-out" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: /结束水平/ }), { target: { value: "35" } });
    const video = useEditorStore.getState().project.tracks.flatMap((track) => track.clips).find((clip) => clip.id === "video-clip");
    expect(video).toMatchObject({ kind: "video", camera: { preset: "pull-out", startScale: 1.22, endScale: 1, endX: 35 } });
  });
});
