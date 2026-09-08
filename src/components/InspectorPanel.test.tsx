import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { sceneBackgroundComposition } from "@/domain/sceneBackground";
import { InspectorPanel } from "@/components/InspectorPanel";
import { createEmptyProject, type VideoClip } from "@/domain/project";
import { useEditorStore } from "@/stores/editorStore";
import { cameraMotionForPreset } from "@/domain/camera";

beforeEach(() => {
  const project = createEmptyProject();
  project.tracks.find((track) => track.kind === "generated")!.clips.push({
    id: "generated", trackId: "generated-main", kind: "generated", label: "AI 片段", startUs: 0, durationUs: 3_000_000,
    locked: false, article: "文章", narration: "口播", prompt: "主题", insertMode: "insert",
    scenes: [{ id: "caption", title: "增长", narration: "增长 42%", durationUs: 3_000_000, compositionId: "test-number-counter", textColor: "#ffffff", accentColor: "#47d7ac", fontSize: 58, speed: 1, transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }, mediaSourceInUs: 0, mediaFit: "cover", mediaVolume: 0, camera: cameraMotionForPreset("none") }]
  });
  useEditorStore.setState({ project, selectedClipId: "generated", selectedClipIds: ["generated"], playheadUs: 0, zoom: 1, past: [], future: [], clipboard: [], previewRequest: null });
});

describe("InspectorPanel generated metadata", () => {
  it("edits reference cards through internal scale instead of the full stage transform", () => {
    useEditorStore.setState({ project: createEmptyProject(), selectedClipId: null, selectedClipIds: [], playheadUs: 0, past: [], future: [] });
    useEditorStore.getState().addComposition("info-board");
    const id = useEditorStore.getState().selectedClipId!;
    render(<InspectorPanel />);

    fireEvent.change(screen.getByRole("slider", { name: "大小" }), { target: { value: "1.4" } });

    const effect = useEditorStore.getState().project.tracks.flatMap((track) => track.clips).find((clip) => clip.id === id);
    expect(effect).toMatchObject({
      transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 },
      transformKeyframes: [],
      params: { scale: 1.4 }
    });
    expect(screen.queryByRole("slider", { name: "旋转" })).not.toBeInTheDocument();
    expect(screen.queryByText(/位置与缩放关键帧/u)).not.toBeInTheDocument();
  });

  it("uses project material slots instead of path fields for imported camera effects", () => {
    useEditorStore.setState({ project: createEmptyProject(), selectedClipId: null, selectedClipIds: [], playheadUs: 0, past: [], future: [] });
    useEditorStore.getState().addComposition("screen-demo");
    render(<InspectorPanel />);

    expect(screen.getByLabelText("演示录屏素材槽")).toBeInTheDocument();
    expect(screen.getByLabelText("口播视频素材槽")).toBeInTheDocument();
    expect(screen.queryByLabelText("录屏路径(/demo/xxx.mp4)")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("口播视频(烤进导出)")).not.toBeInTheDocument();
  });

  it("edits crop focus and absolute layer without manual container controls", () => {
    useEditorStore.getState().addVideo({ id: "portrait", name: "portrait.mp4", kind: "video", durationUs: 8_000_000 });
    const id = useEditorStore.getState().selectedClipId!;
    const current = () => useEditorStore.getState().project.tracks.flatMap((track) => track.clips).find((clip) => clip.id === id);
    const view = render(<InspectorPanel />);
    expect(screen.getByRole("spinbutton", { name: "视频层级" })).toHaveValue(20);
    expect(screen.queryByRole("combobox", { name: "画面适配" })).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: "容器宽度" })).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: "容器高度" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "匹配素材比例" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("spinbutton", { name: "取景中心 X" }), { target: { value: "60" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "视频层级" }), { target: { value: "240" } });
    expect(current()).toMatchObject({ fit: "contain", zIndex: 240, mask: { focusX: 60 }, transform: { scale: 1 }, sourceInUs: 0, playbackRate: 1 });
    useEditorStore.getState().undo();
    expect(current()).toMatchObject({ zIndex: 20, mask: { focusX: 60 } });
    useEditorStore.getState().redo();
    expect(current()).toMatchObject({ zIndex: 240 });
    view.unmount();
    useEditorStore.getState().setTrackState(current()!.trackId, { locked: true });
    useEditorStore.setState({ selectedClipId: id, selectedClipIds: [id] });
    render(<InspectorPanel />);
    expect(screen.getByRole("spinbutton", { name: "视频层级" })).toBeDisabled();
  });

  it("can detach one effect from theme colors without changing its appearance", () => {
    const state = useEditorStore.getState();
    const project = createEmptyProject();
    project.motionTheme.colors = { ...project.motionTheme.colors, text: "#121212", data: "#0099cc", surface: "#eef0f2" };
    const track = project.tracks.find((candidate) => candidate.kind === "composition")!;
    track.clips.push({
      id: "composition", trackId: track.id, kind: "composition", label: "数据", startUs: 0, durationUs: 2_000_000,
      locked: false, compositionId: "number-pop", text: "42%", color: "#ffffff", accentColor: "#ff0000",
      colorRole: "data", fontSize: 72, speed: 1, transform: { x: 50, y: 30, scale: 1, rotation: 0, opacity: 1 }
    });
    useEditorStore.setState({ ...state, project, selectedClipId: "composition", selectedClipIds: ["composition"] });
    render(<InspectorPanel />);

    expect(screen.getByText("跟随主题")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("combobox", { name: "动效颜色来源" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "单独设置" }));

    const effect = useEditorStore.getState().project.tracks.flatMap((candidate) => candidate.clips).find((clip) => clip.id === "composition");
    expect(effect).toMatchObject({ colorRole: "custom", color: "#121212", accentColor: "#0099cc" });
    expect(screen.getByLabelText("文字颜色")).toHaveValue("#121212");
    expect(screen.getByLabelText("强调色")).toHaveValue("#0099cc");

    useEditorStore.getState().updateMotionTheme({ colors: { text: "#eeeeee", data: "#112233" } });
    expect(useEditorStore.getState().project.tracks.flatMap((candidate) => candidate.clips).find((clip) => clip.id === "composition")).toMatchObject({
      colorRole: "custom", color: "#121212", accentColor: "#0099cc"
    });
  });

  it("lets one effect override its theme backdrop and restore inheritance", () => {
    const state = useEditorStore.getState();
    const project = createEmptyProject();
    project.motionTheme.colors.surface = "#eef0f2";
    const track = project.tracks.find((candidate) => candidate.kind === "composition")!;
    track.clips.push({
      id: "composition", trackId: track.id, kind: "composition", label: "观点", startUs: 0, durationUs: 2_000_000,
      locked: false, compositionId: "title-highlight", text: "核心观点", color: "#ffffff", accentColor: "#ffb84d",
      colorRole: "opinion", fontSize: 56, speed: 1, transform: { x: 50, y: 30, scale: 1, rotation: 0, opacity: 1 }
    });
    useEditorStore.setState({ ...state, project, selectedClipId: "composition", selectedClipIds: ["composition"] });
    render(<InspectorPanel />);

    const background = screen.getByLabelText("背景颜色 · 跟随主题");
    expect(background).toHaveValue("#eef0f2");
    fireEvent.change(background, { target: { value: "#223344" } });
    expect(useEditorStore.getState().project.tracks.flatMap((candidate) => candidate.clips).find((clip) => clip.id === "composition")).toMatchObject({ backdrop: { color: "#223344" } });

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
    const track = project.tracks.find((track) => track.kind === "composition")!;
    track.clips.push(sceneBackgroundComposition({
      id: "scene", trackId: track.id, kind: "scene", label: "深色网格", startUs: 0, durationUs: 3_000_000,
      locked: false, compositionId: "scene-dark-grid", opacity: 1,
      background: { preset: "dark-grid", primaryColor: "#15191f", secondaryColor: "#29313b", borderColor: "#47d7ac", intensity: 0.72 }
    }));
    useEditorStore.setState({ ...state, project, selectedClipId: "scene", selectedClipIds: ["scene"] });
    render(<InspectorPanel />);

    expect(screen.getByText("背景动效 · 视频下层")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("spinbutton", { name: "动效层级" }), { target: { value: "250" } });
    expect(useEditorStore.getState().project.tracks.find((candidate) => candidate.id === track.id)!.clips[0]).toMatchObject({ zIndex: 250 });
    fireEvent.change(screen.getByRole("slider", { name: "透明度" }), { target: { value: "0.55" } });
    expect(useEditorStore.getState().project.tracks.find((candidate) => candidate.id === track.id)!.clips[0]).toMatchObject({ transform: { opacity: 0.55 } });
  });

  it("edits video scale with undo and redo while preserving source timing", () => {
    useEditorStore.setState({ project: createEmptyProject(), playheadUs: 0, selectedClipId: null, selectedClipIds: [], past: [], future: [] });
    useEditorStore.getState().addVideo({ id: "portrait", name: "portrait.mp4", kind: "video", durationUs: 8_000_000 });
    const id = useEditorStore.getState().selectedClipId!;
    useEditorStore.getState().updateVideo(id, { fit: "cover", sourceInUs: 1_000_000, playbackRate: 1.25, durationUs: 4_000_000 });
    render(<InspectorPanel />);
    fireEvent.change(screen.getByRole("slider", { name: "缩放" }), { target: { value: "0.6" } });
    const current = () => useEditorStore.getState().project.tracks.flatMap((track) => track.clips).find((clip) => clip.id === id);
    expect(current()).toMatchObject({ fit: "cover", transform: { scale: 0.6 }, sourceInUs: 1_000_000, playbackRate: 1.25, durationUs: 4_000_000 });
    useEditorStore.getState().undo();
    expect(current()).toMatchObject({ fit: "cover", transform: { scale: 1 } });
    useEditorStore.getState().redo();
    expect(current()).toMatchObject({ fit: "cover", transform: { scale: 0.6 } });
  });

  it("edits an active motion cue target and keeps existing transform keyframes", () => {
    useEditorStore.setState({ project: createEmptyProject(), playheadUs: 0, selectedClipId: null, selectedClipIds: [], past: [], future: [] });
    useEditorStore.getState().addVideo({ id: "video", name: "video.mp4", kind: "video", durationUs: 8_000_000 });
    const id = useEditorStore.getState().selectedClipId!;
    useEditorStore.getState().updateVideo(id, { transformKeyframes: [{ offsetUs: 0, x: 50, y: 50, scale: 1, easing: "linear" }] });
    useEditorStore.getState().addVideoPresentationCue(id, "picture-in-picture-top-right", 1_000_000);
    useEditorStore.getState().setPlayhead(1_000_000);
    render(<InspectorPanel />);
    fireEvent.change(screen.getByRole("slider", { name: "缩放" }), { target: { value: "0.5" } });
    expect(useEditorStore.getState().project.tracks.flatMap((track) => track.clips).find((clip) => clip.id === id))
      .toMatchObject({ transformKeyframes: [{ offsetUs: 0, scale: 1 }], presentationCues: [{ fit: "cover", transform: { x: 82, y: 20, scale: 0.5 } }] });
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

  it("applies the standard fade transition from the video inspector", () => {
    const state = useEditorStore.getState();
    const project = createEmptyProject();
    project.assets.push({ id: "video", name: "cut.mp4", kind: "video", durationUs: 10_000_000 });
    project.tracks.find((track) => track.kind === "video")!.clips.push({ id: "video-clip", trackId: "video-main", kind: "video", label: "cut.mp4", startUs: 3_000_000, durationUs: 5_000_000, locked: false, assetId: "video", sourceInUs: 0, playbackRate: 1, volume: 1, fit: "cover", camera: cameraMotionForPreset("none") });
    useEditorStore.setState({ ...state, project, selectedClipId: "video-clip", selectedClipIds: ["video-clip"], playheadUs: 3_000_000 });
    render(<InspectorPanel />);

    fireEvent.keyDown(screen.getByRole("combobox", { name: "片段转场" }), { key: "Enter" });
    expect(screen.queryByRole("option", { name: "动势缩放" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "淡入" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "转场时长" }), { target: { value: "0.45" } });

    expect(useEditorStore.getState().project.tracks.flatMap((track) => track.clips).find((clip) => clip.id === "video-clip")).toMatchObject({
      transition: { preset: "fade", durationUs: 450_000 }
    });
    expect(useEditorStore.getState().previewRequest).toMatchObject({ startUs: 2_550_000, endUs: 3_450_000 });
    expect(screen.getByRole("combobox", { name: "转场曲线" })).toBeInTheDocument();
  });

  it("applies the standard fade transition from the image inspector", () => {
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
    expect(screen.queryByRole("option", { name: "动势缩放" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "淡入" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "转场时长" }), { target: { value: "0.4" } });

    expect(useEditorStore.getState().project.tracks.flatMap((candidate) => candidate.clips).find((clip) => clip.id === "image-clip")).toMatchObject({
      transition: { preset: "fade", durationUs: 400_000 }
    });
    expect(useEditorStore.getState().previewRequest).toMatchObject({ startUs: 1_600_000, endUs: 2_400_000 });
  });

  it("applies the standard fade transition to every cut in a multi-video selection", () => {
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
    expect(videos.slice(1).every((video) => video.transition?.preset === "fade" && video.transition.durationUs === 450_000)).toBe(true);
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
