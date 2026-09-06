import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { InspectorPanel } from "@/components/InspectorPanel";
import { createEmptyProject, type VideoClip } from "@/domain/project";
import { useEditorStore } from "@/stores/editorStore";
import { cameraMotionForPreset } from "@/domain/camera";

beforeEach(() => {
  const project = createEmptyProject();
  project.tracks.find((track) => track.kind === "generated")!.clips.push({
    id: "generated", trackId: "generated-main", kind: "generated", label: "AI 片段", startUs: 0, durationUs: 3_000_000,
    locked: false, article: "文章", narration: "口播", prompt: "主题", insertMode: "insert",
    scenes: [{ id: "caption", title: "增长", narration: "增长 42%", durationUs: 3_000_000, effectId: "test-number-counter", textColor: "#ffffff", accentColor: "#47d7ac", fontSize: 58, speed: 1, transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }, mediaSourceInUs: 0, mediaFit: "cover", mediaVolume: 0, camera: cameraMotionForPreset("none") }]
  });
  useEditorStore.setState({ project, selectedClipId: "generated", selectedClipIds: ["generated"], playheadUs: 0, zoom: 1, past: [], future: [], clipboard: [], previewRequest: null });
});

describe("InspectorPanel generated metadata", () => {
  it("can detach one effect from theme colors without changing its appearance", () => {
    const state = useEditorStore.getState();
    const project = createEmptyProject();
    project.motionTheme.colors = { ...project.motionTheme.colors, text: "#121212", data: "#0099cc", surface: "#eef0f2" };
    const track = project.tracks.find((candidate) => candidate.kind === "effect")!;
    track.clips.push({
      id: "effect", trackId: track.id, kind: "effect", label: "数据", startUs: 0, durationUs: 2_000_000,
      locked: false, effectId: "number-pop", text: "42%", color: "#ffffff", accentColor: "#ff0000",
      colorRole: "data", fontSize: 72, speed: 1, transform: { x: 50, y: 30, scale: 1, rotation: 0, opacity: 1 }
    });
    useEditorStore.setState({ ...state, project, selectedClipId: "effect", selectedClipIds: ["effect"] });
    render(<InspectorPanel />);

    expect(screen.getByText("跟随主题")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("combobox", { name: "动效颜色来源" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "单独设置" }));

    const effect = useEditorStore.getState().project.tracks.flatMap((candidate) => candidate.clips).find((clip) => clip.id === "effect");
    expect(effect).toMatchObject({ colorRole: "custom", color: "#121212", accentColor: "#0099cc" });
    expect(screen.getByLabelText("文字颜色")).toHaveValue("#121212");
    expect(screen.getByLabelText("强调色")).toHaveValue("#0099cc");

    useEditorStore.getState().updateMotionTheme({ colors: { text: "#eeeeee", data: "#112233" } });
    expect(useEditorStore.getState().project.tracks.flatMap((candidate) => candidate.clips).find((clip) => clip.id === "effect")).toMatchObject({
      colorRole: "custom", color: "#121212", accentColor: "#0099cc"
    });
  });

  it("lets one effect override its theme backdrop and restore inheritance", () => {
    const state = useEditorStore.getState();
    const project = createEmptyProject();
    project.motionTheme.colors.surface = "#eef0f2";
    const track = project.tracks.find((candidate) => candidate.kind === "effect")!;
    track.clips.push({
      id: "effect", trackId: track.id, kind: "effect", label: "观点", startUs: 0, durationUs: 2_000_000,
      locked: false, effectId: "title-highlight", text: "核心观点", color: "#ffffff", accentColor: "#ffb84d",
      colorRole: "opinion", fontSize: 56, speed: 1, transform: { x: 50, y: 30, scale: 1, rotation: 0, opacity: 1 }
    });
    useEditorStore.setState({ ...state, project, selectedClipId: "effect", selectedClipIds: ["effect"] });
    render(<InspectorPanel />);

    const background = screen.getByLabelText("背景颜色 · 跟随主题");
    expect(background).toHaveValue("#eef0f2");
    fireEvent.change(background, { target: { value: "#223344" } });
    expect(useEditorStore.getState().project.tracks.flatMap((candidate) => candidate.clips).find((clip) => clip.id === "effect")).toMatchObject({ backdrop: { color: "#223344" } });

    fireEvent.click(screen.getByRole("button", { name: "恢复跟随主题底色" }));
    expect(screen.getByLabelText("背景颜色 · 跟随主题")).toHaveValue("#eef0f2");
  });

  it("shows script metadata without a storyboard editor", () => {
    render(<InspectorPanel />);
    expect(screen.getByText("AI 脚本 · 1 条时间字幕")).toBeInTheDocument();
    expect(screen.getByText("时间字幕、动效、运镜与视频素材已分别写入对应时间线轨道，可直接选择片段调整。")).toBeInTheDocument();
    expect(screen.queryByText(/分镜/)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "主动效类型" })).not.toBeInTheDocument();
  });

  it("edits an independent scene background clip", () => {
    const state = useEditorStore.getState();
    const project = createEmptyProject();
    project.tracks.find((track) => track.kind === "scene")!.clips.push({
      id: "scene", trackId: "scene-main", kind: "scene", label: "深色网格", startUs: 0, durationUs: 3_000_000,
      locked: false, effectId: "scene-dark-grid", opacity: 1,
      background: { preset: "dark-grid", primaryColor: "#15191f", secondaryColor: "#29313b", borderColor: "#47d7ac", intensity: 0.72 }
    });
    useEditorStore.setState({ ...state, project, selectedClipId: "scene", selectedClipIds: ["scene"] });
    render(<InspectorPanel />);

    expect(screen.getByText("整画布场景背景 · 视频下层")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: "透明度" }), { target: { value: "0.55" } });
    expect(useEditorStore.getState().project.tracks.find((track) => track.kind === "scene")!.clips[0]).toMatchObject({ opacity: 0.55 });
  });

  it("adds a timed presenter motion cue at the playhead with one click", () => {
    const state = useEditorStore.getState();
    const project = createEmptyProject();
    project.assets.push({ id: "video", name: "growth.mp4", kind: "video", durationUs: 10_000_000 });
    project.tracks.find((track) => track.kind === "video")!.clips.push({ id: "video-clip", trackId: "video-main", kind: "video", label: "growth.mp4", startUs: 0, durationUs: 5_000_000, locked: false, assetId: "video", sourceInUs: 0, playbackRate: 1, volume: 1, fit: "cover", camera: cameraMotionForPreset("none") });
    useEditorStore.setState({ ...state, project, selectedClipId: "video-clip", selectedClipIds: ["video-clip"], playheadUs: 1_000_000 });
    render(<InspectorPanel />);
    fireEvent.click(screen.getByRole("button", { name: /讲解人右下角/ }));
    const video = useEditorStore.getState().project.tracks.flatMap((track) => track.clips).find((clip) => clip.id === "video-clip");
    expect(video).toMatchObject({ kind: "video", presentationCues: [{ offsetUs: 1_000_000, presetId: "presenter-circle-bottom-right", mask: { shape: "circle", focusY: 38 } }] });
    expect(useEditorStore.getState().previewRequest).toMatchObject({ startUs: 1_000_000, endUs: 2_200_000 });
    expect(screen.getByText(/拖动画布中的取景中心/)).toBeInTheDocument();
    expect(screen.getByText("00:01.00")).toBeInTheDocument();
    const animationToggle = screen.getByRole("checkbox", { name: "播放转场动画" });
    expect(animationToggle).toBeChecked();
    fireEvent.click(animationToggle);
    expect(screen.queryByRole("spinbutton", { name: "过渡时长" })).not.toBeInTheDocument();
    expect(useEditorStore.getState().project.tracks.flatMap((track) => track.clips).find((clip) => clip.id === "video-clip")).toMatchObject({ presentationCues: [{ transitionDurationUs: 0 }] });
    fireEvent.click(animationToggle);
    fireEvent.change(screen.getByRole("spinbutton", { name: "过渡时长" }), { target: { value: "1.4" } });
    expect(useEditorStore.getState().project.tracks.flatMap((track) => track.clips).find((clip) => clip.id === "video-clip")).toMatchObject({ presentationCues: [{ transitionDurationUs: 1_400_000 }] });
  });

  it("applies the momentum zoom transition from the video inspector", () => {
    const state = useEditorStore.getState();
    const project = createEmptyProject();
    project.assets.push({ id: "video", name: "cut.mp4", kind: "video", durationUs: 10_000_000 });
    project.tracks.find((track) => track.kind === "video")!.clips.push({ id: "video-clip", trackId: "video-main", kind: "video", label: "cut.mp4", startUs: 3_000_000, durationUs: 5_000_000, locked: false, assetId: "video", sourceInUs: 0, playbackRate: 1, volume: 1, fit: "cover", camera: cameraMotionForPreset("none") });
    useEditorStore.setState({ ...state, project, selectedClipId: "video-clip", selectedClipIds: ["video-clip"], playheadUs: 3_000_000 });
    render(<InspectorPanel />);

    fireEvent.keyDown(screen.getByRole("combobox", { name: "片段转场" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "动势缩放" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "转场时长" }), { target: { value: "0.45" } });

    expect(useEditorStore.getState().project.tracks.flatMap((track) => track.clips).find((clip) => clip.id === "video-clip")).toMatchObject({
      transition: { preset: "momentum-zoom", durationUs: 450_000 }
    });
    expect(useEditorStore.getState().previewRequest).toMatchObject({ startUs: 2_550_000, endUs: 3_450_000 });
    expect(screen.queryByRole("combobox", { name: "转场曲线" })).not.toBeInTheDocument();
  });

  it("applies the momentum zoom transition from the image inspector", () => {
    const state = useEditorStore.getState();
    const project = createEmptyProject();
    const track = project.tracks.find((candidate) => candidate.kind === "image")!;
    track.clips.push({
      id: "image-clip", trackId: track.id, kind: "image", label: "badge.png", startUs: 2_000_000, durationUs: 3_000_000,
      locked: false, assetId: "image", transform: { x: 65, y: 35, scale: 0.8, rotation: 0, opacity: 1 }, entrance: "pop", speed: 1
    });
    useEditorStore.setState({ ...state, project, selectedClipId: "image-clip", selectedClipIds: ["image-clip"], playheadUs: 2_000_000 });
    render(<InspectorPanel />);

    fireEvent.keyDown(screen.getByRole("combobox", { name: "片段转场" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "动势缩放" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "转场时长" }), { target: { value: "0.4" } });

    expect(useEditorStore.getState().project.tracks.flatMap((candidate) => candidate.clips).find((clip) => clip.id === "image-clip")).toMatchObject({
      transition: { preset: "momentum-zoom", durationUs: 400_000 }
    });
    expect(useEditorStore.getState().previewRequest).toMatchObject({ startUs: 1_600_000, endUs: 2_400_000 });
  });

  it("applies the momentum zoom transition to every cut in a multi-video selection", () => {
    const state = useEditorStore.getState();
    const project = createEmptyProject();
    project.assets.push({ id: "video", name: "cut.mp4", kind: "video", durationUs: 10_000_000 });
    const track = project.tracks.find((candidate) => candidate.kind === "video")!;
    const base = { trackId: track.id, kind: "video" as const, locked: false, assetId: "video", sourceInUs: 0, playbackRate: 1, volume: 1, fit: "cover" as const, camera: cameraMotionForPreset("none") };
    track.clips.push(
      { ...base, id: "first", label: "第一段", startUs: 0, durationUs: 2_000_000 },
      { ...base, id: "second", label: "第二段", startUs: 2_000_000, durationUs: 2_000_000 },
      { ...base, id: "third", label: "第三段", startUs: 4_000_000, durationUs: 2_000_000 }
    );
    useEditorStore.setState({ ...state, project, selectedClipId: "third", selectedClipIds: ["first", "second", "third"], playheadUs: 4_000_000, past: [], future: [] });
    render(<InspectorPanel />);

    expect(screen.getByText("3 个视觉素材")).toBeInTheDocument();
    expect(screen.getByText("2 个相邻切点")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "片段转场" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("spinbutton", { name: "转场时长" }), { target: { value: "0.45" } });
    fireEvent.click(screen.getByRole("button", { name: "应用到 2 个切点" }));

    const videos = useEditorStore.getState().project.tracks.find((candidate) => candidate.id === track.id)!.clips as VideoClip[];
    expect(videos[0].transition).toBeUndefined();
    expect(videos.slice(1).every((video) => video.transition?.preset === "momentum-zoom" && video.transition.durationUs === 450_000)).toBe(true);
    expect(useEditorStore.getState().past).toHaveLength(1);
    expect(useEditorStore.getState().previewRequest).toMatchObject({ startUs: 1_550_000, endUs: 2_450_000 });
  });

  it("starts focus picking when a screen presentation preset is applied", () => {
    const state = useEditorStore.getState();
    const project = createEmptyProject();
    project.assets.push({ id: "screen", name: "screen.mp4", kind: "video", durationUs: 10_000_000 });
    project.tracks.find((track) => track.kind === "video")!.clips.push({ id: "screen-clip", trackId: "video-layer-1", kind: "video", label: "screen.mp4", startUs: 0, durationUs: 5_000_000, locked: false, assetId: "screen", sourceInUs: 0, playbackRate: 1, volume: 1, fit: "cover", camera: cameraMotionForPreset("none") });
    useEditorStore.setState({ ...state, project, selectedClipId: "screen-clip", selectedClipIds: ["screen-clip"] });
    render(<InspectorPanel />);
    fireEvent.click(screen.getByRole("button", { name: /区域放大/ }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "聚焦时长" }), { target: { value: "3.2" } });
    expect(useEditorStore.getState().focusPickClipId).toBe("screen-clip");
    expect(useEditorStore.getState().project.tracks.flatMap((track) => track.clips).find((clip) => clip.id === "screen-clip")).toMatchObject({ presentationCues: [{ presetId: "screen-magnify", focus: { enabled: true, zoom: 2.25, durationUs: 3_200_000 } }] });
    expect(screen.getByText(/点击画面选择区域/)).toBeInTheDocument();
  });

  it("edits subtitle presets and keyword highlighting", () => {
    const state = useEditorStore.getState();
    const project = createEmptyProject();
    const track = project.tracks.find((candidate) => candidate.kind === "subtitle")!;
    track.clips.push({ id: "subtitle", trackId: track.id, kind: "subtitle", label: "字幕", startUs: 0, durationUs: 2_000_000, locked: false, text: "突出核心信息", color: "#ffffff", backgroundColor: "#000000", fontSize: 44, positionY: 88 });
    useEditorStore.setState({ ...state, project, selectedClipId: "subtitle", selectedClipIds: ["subtitle"] });
    render(<InspectorPanel />);

    fireEvent.keyDown(screen.getByRole("combobox", { name: "字幕样式预设" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "重点强调" }));
    fireEvent.change(screen.getByRole("textbox", { name: "高亮关键词" }), { target: { value: "核心，信息" } });

    expect(useEditorStore.getState().project.tracks.flatMap((candidate) => candidate.clips).find((clip) => clip.id === "subtitle")).toMatchObject({ stylePreset: "bold", highlightWords: ["核心", "信息"] });
  });

  it("edits only the selected subtitle appearance", () => {
    const state = useEditorStore.getState();
    const project = createEmptyProject();
    const track = project.tracks.find((candidate) => candidate.kind === "subtitle")!;
    track.clips.push(
      { id: "one", trackId: track.id, kind: "subtitle", label: "第一段", startUs: 0, durationUs: 1_000_000, locked: false, text: "第一段核心", color: "#ffffff", backgroundColor: "#000000", fontSize: 44, positionY: 88, highlightWords: ["核心"] },
      { id: "two", trackId: track.id, kind: "subtitle", label: "第二段", startUs: 1_000_000, durationUs: 1_000_000, locked: false, text: "第二段重点", color: "#ffffff", backgroundColor: "#000000", fontSize: 44, positionY: 88, highlightWords: ["重点"] }
    );
    useEditorStore.setState({ ...state, project, selectedClipId: "one", selectedClipIds: ["one"] });
    render(<InspectorPanel />);

    fireEvent.change(screen.getByRole("slider", { name: "字号" }), { target: { value: "52" } });
    const subtitles = useEditorStore.getState().project.tracks.find((candidate) => candidate.kind === "subtitle")!.clips;
    expect(subtitles.map((clip) => clip.kind === "subtitle" ? clip.fontSize : 0)).toEqual([52, 44]);
    expect(screen.queryByRole("button", { name: "全部字幕" })).not.toBeInTheDocument();
  });
});
