import { useEffect, useRef, useState } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Download, FileVideo2, FolderOpen, History, LoaderCircle, Redo2, Save, Settings, Square, Undo2 } from "lucide-react";
import { AiGenerateDialog } from "@/components/AiGenerateDialog";
import { AiSettingsDialog } from "@/components/AiSettingsDialog";
import { AudioCreateDialog, type CreatedAudioSource } from "@/components/AudioCreateDialog";
import { EditorWorkspace } from "@/components/EditorWorkspace";
import { ExportDialog, type VideoExportOptions } from "@/components/ExportDialog";
import { EffectLibraryDialog } from "@/components/EffectLibraryDialog";
import { ProjectRecoveryDialog } from "@/components/ProjectRecoveryDialog";
import { RecentProjectsDialog } from "@/components/RecentProjectsDialog";
import { UpdateModal } from "@/components/UpdateModal";
import { WindowControls } from "@/components/WindowControls";
import { useAppUpdater } from "@/hooks/useAppUpdater";
import { useSettings } from "@/hooks/useSettings";
import type { GeneratedBlock, SubtitleClip } from "@/domain/project";
import { buildRenderPlan } from "@/domain/renderPlan";
import { parseProject, serializeProject } from "@/domain/projectFile";
import {
  cancelExportJob,
  generateMediaDerivatives,
  localMediaUrl,
  mediaPathExists,
  probeMedia,
  rasterizeRenderPlan,
  readProjectFile,
  saveProjectFile,
  selectMediaPaths,
  selectAudioDestination,
  selectProjectDestination,
  selectProjectToOpen,
  selectReplacementMediaPath,
  selectVideoDestination,
  startProxyGeneration,
  startAudioExtraction,
  startExportRenderPlan,
  type ExportJobEvent,
  type ProxyJobEvent
} from "@/services/media";
import { desktopPlatform, isDesktopRuntime, toggleDevTools, type DesktopPlatform } from "@/services/runtime";
import {
  clearRecoverySnapshot,
  hydrateProjectAssets,
  projectHasRecoverableContent,
  readRecentProjects,
  readRecoverySnapshot,
  rememberRecentProject,
  restoreRecoverySnapshot,
  writeRecoverySnapshot,
  type RecentProject,
  type RecoverySnapshot
} from "@/services/projectSession";
import { captionSegments } from "@/services/asr";
import { subtitlesForMotionMatch } from "@/domain/captions";
import { browserApiKey, hasApiKey, matchTimelineMotion } from "@/services/ai/provider";
import { cancelCloudSpeechRequest, hasSpeechApiKey, startCloudMediaTranscription, type CloudSpeechProgressEvent } from "@/services/cloudSpeech";
import { useEditorStore } from "@/stores/editorStore";
import { useEffectLibraryStore } from "@/stores/effectLibraryStore";
import { rasterizeReactEffects } from "@/effects/exportRenderer";
import { lintMotionProject } from "@/domain/motionLint";
import { builtinSoundAssetId, builtinSoundEffectById, type BuiltinSoundEffectId } from "@/domain/soundEffects";
import { createBuiltinSoundAsset, previewBuiltinSound } from "@/services/builtinSounds";

function loadVideoMetadata(url: string) {
  return new Promise<{ duration: number; width: number; height: number }>((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => resolve({ duration: Number.isFinite(video.duration) ? video.duration : 30, width: video.videoWidth, height: video.videoHeight });
    video.onerror = () => reject(new Error("无法读取视频信息"));
    video.src = url;
  });
}

function loadAudioMetadata(url: string) {
  return new Promise<{ duration: number }>((resolve, reject) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => resolve({ duration: Number.isFinite(audio.duration) ? audio.duration : 30 });
    audio.onerror = () => reject(new Error("无法读取音频信息"));
    audio.src = url;
  });
}

function loadImageMetadata(url: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("无法读取图片信息"));
    image.src = url;
  });
}

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "bmp"]);

function isImagePath(path: string) {
  return IMAGE_EXTENSIONS.has(path.split(".").at(-1)?.toLowerCase() ?? "");
}

export default function App() {
  const { settings, setSettings } = useSettings();
  const updater = useAppUpdater();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  const [effectLibraryOpen, setEffectLibraryOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [exportJobId, setExportJobId] = useState("");
  const [exportProgress, setExportProgress] = useState<ExportJobEvent | null>(null);
  const [proxyJobId, setProxyJobId] = useState("");
  const [proxyProgress, setProxyProgress] = useState<ProxyJobEvent | null>(null);
  const [asrJobId, setAsrJobId] = useState("");
  const [asrProgress, setAsrProgress] = useState<CloudSpeechProgressEvent | null>(null);
  const [audioExtractionJobId, setAudioExtractionJobId] = useState("");
  const [aiRequestController, setAiRequestController] = useState<AbortController | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [recoverySnapshot, setRecoverySnapshot] = useState<RecoverySnapshot | null>(null);
  const [recoveryError, setRecoveryError] = useState("");
  const [restoringRecovery, setRestoringRecovery] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [platformLayout, setPlatformLayout] = useState<DesktopPlatform>("browser");
  const fileInput = useRef<HTMLInputElement>(null);
  const savedProjectRef = useRef(serializeProject(useEditorStore.getState().project));
  const project = useEditorStore((state) => state.project);
  const addVideo = useEditorStore((state) => state.addVideo);
  const addImage = useEditorStore((state) => state.addImage);
  const addAudio = useEditorStore((state) => state.addAudio);
  const addExtractedAudio = useEditorStore((state) => state.addExtractedAudio);
  const updateAsset = useEditorStore((state) => state.updateAsset);
  const replaceProject = useEditorStore((state) => state.replaceProject);
  const addSubtitles = useEditorStore((state) => state.addSubtitles);
  const applyMotionMatches = useEditorStore((state) => state.applyMotionMatches);
  const alignGeneratedBlockDuration = useEditorStore((state) => state.alignGeneratedBlockDuration);
  const alignGeneratedSceneDurations = useEditorStore((state) => state.alignGeneratedSceneDurations);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const removeSelected = useEditorStore((state) => state.removeSelected);
  const copySelected = useEditorStore((state) => state.copySelected);
  const pasteAtPlayhead = useEditorStore((state) => state.pasteAtPlayhead);
  const splitSelected = useEditorStore((state) => state.splitSelected);
  const setRangeStart = useEditorStore((state) => state.setRangeStart);
  const setRangeEnd = useEditorStore((state) => state.setRangeEnd);
  const pastCount = useEditorStore((state) => state.past.length);
  const futureCount = useEditorStore((state) => state.future.length);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const generatedClips = project.tracks.flatMap((track) => track.clips).filter((clip): clip is GeneratedBlock => clip.kind === "generated");
  const narrationBlock = generatedClips.find((clip) => clip.id === selectedClipId) ?? generatedClips[0];
  const narrationSubtitles = narrationBlock ? project.tracks
    .flatMap((track) => track.clips)
    .filter((clip): clip is SubtitleClip => clip.kind === "subtitle" && clip.sourceBlockId === narrationBlock.id)
    .sort((left, right) => left.startUs - right.startUs) : [];
  const defaultNarration = narrationSubtitles.length
    ? narrationSubtitles.map((subtitle) => subtitle.text).join("\n")
    : narrationBlock?.narration ?? "";
  const loadEffectLibrary = useEffectLibraryStore((state) => state.load);

  useEffect(() => {
    void desktopPlatform().then(setPlatformLayout).catch(() => setPlatformLayout("browser"));
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.colorScheme = settings.colorScheme === "system" ? (media.matches ? "dark" : "light") : settings.colorScheme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [settings.colorScheme]);

  useEffect(() => {
    void updater.checkForUpdates();
  }, [updater.checkForUpdates]);

  useEffect(() => {
    void loadEffectLibrary().catch((error) => console.warn("Failed to load effect library", error));
  }, [loadEffectLibrary]);

  useEffect(() => {
    let active = true;
    void Promise.all([readRecoverySnapshot(), readRecentProjects()]).then(([recovery, recent]) => {
      if (!active) return;
      if (recovery) {
        try {
          parseProject(recovery.projectJson);
          setRecoverySnapshot(recovery);
        } catch {
          void clearRecoverySnapshot();
        }
      }
      setRecentProjects(recent);
      setSessionReady(true);
    }).catch((error) => {
      console.warn("Failed to load project session", error);
      if (active) setSessionReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!sessionReady || !projectHasRecoverableContent(project)) return;
    const serialized = serializeProject(project);
    if (serialized === savedProjectRef.current) return;
    const timer = window.setTimeout(() => {
      void writeRecoverySnapshot(project, currentProjectPath).catch((error) => console.warn("Failed to write recovery snapshot", error));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [currentProjectPath, project, sessionReady]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelected();
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v") {
        event.preventDefault();
        pasteAtPlayhead();
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        splitSelected();
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveProject();
      } else if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        removeSelected();
      } else if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === "i") {
        event.preventDefault();
        setRangeStart(useEditorStore.getState().playheadUs);
      } else if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === "o") {
        event.preventDefault();
        setRangeEnd(useEditorStore.getState().playheadUs);
      } else if (import.meta.env.DEV && isDesktopRuntime() && (event.key === "F12" || ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "i"))) {
        event.preventDefault();
        void toggleDevTools();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [copySelected, currentProjectPath, pasteAtPlayhead, project, redo, removeSelected, setRangeEnd, setRangeStart, splitSelected, undo]);

  async function importBrowserMedia(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    try {
      if (file.type.startsWith("image/")) {
        const metadata = await loadImageMetadata(objectUrl);
        addImage({ id: crypto.randomUUID(), name: file.name, kind: "image", durationUs: 5_000_000, objectUrl, hasAudio: false, missing: false, ...metadata });
      } else if (file.type.startsWith("audio/")) {
        const metadata = await loadAudioMetadata(objectUrl);
        addAudio({ id: crypto.randomUUID(), name: file.name, kind: "audio", durationUs: Math.round(metadata.duration * 1_000_000), objectUrl, hasAudio: true, missing: false });
      } else {
        const metadata = await loadVideoMetadata(objectUrl);
        addVideo({ id: crypto.randomUUID(), name: file.name, kind: "video", durationUs: Math.round(metadata.duration * 1_000_000), width: metadata.width, height: metadata.height, objectUrl, hasAudio: true, missing: false });
      }
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      window.alert(error instanceof Error ? error.message : "视频导入失败");
    }
  }

  async function requestImport() {
    if (!isDesktopRuntime()) {
      fileInput.current?.click();
      return;
    }
    const paths = await selectMediaPaths();
    if (!paths.length) return;
    setBusyMessage(`正在导入 ${paths.length} 个素材`);
    try {
      for (const path of paths) {
        const id = crypto.randomUUID();
        const objectUrl = localMediaUrl(path);
        const name = path.split(/[\\/]/).at(-1) ?? "媒体素材";
        if (isImagePath(path)) {
          let width = 0;
          let height = 0;
          let fileSize = 0;
          let videoCodec = "image";
          try {
            const imageProbe = await probeMedia(path);
            ({ width, height, fileSize, videoCodec } = imageProbe);
          } catch {
            ({ width, height } = await loadImageMetadata(objectUrl));
          }
          addImage({ id, name, kind: "image", durationUs: 5_000_000, sourcePath: path, objectUrl, width, height, fileSize, videoCodec, hasAudio: false, missing: false });
          continue;
        }
        let metadata: Awaited<ReturnType<typeof probeMedia>>;
        try {
          metadata = await probeMedia(path);
        } catch (probeError) {
          try {
            const browserMetadata = await loadVideoMetadata(objectUrl);
            metadata = { durationUs: Math.round(browserMetadata.duration * 1_000_000), width: browserMetadata.width, height: browserMetadata.height, fpsNumerator: 30, fpsDenominator: 1, videoCodec: "unknown", hasVideo: true, hasAudio: false, fileSize: 0 };
          } catch {
            const browserMetadata = await loadAudioMetadata(objectUrl);
            metadata = { durationUs: Math.round(browserMetadata.duration * 1_000_000), width: 0, height: 0, fpsNumerator: 30, fpsDenominator: 1, videoCodec: "none", audioCodec: "unknown", hasVideo: false, hasAudio: true, fileSize: 0 };
          }
          setNotice(probeError instanceof Error ? `${probeError.message}；素材已按基础模式导入` : "FFprobe 不可用；素材已按基础模式导入");
        }
        const asset = { id, name, kind: metadata.hasVideo ? "video" as const : "audio" as const, sourcePath: path, objectUrl, missing: false, ...metadata };
        if (metadata.hasVideo) addVideo(asset);
        else addAudio(asset);
        try {
          const derivatives = await generateMediaDerivatives(path, id, metadata.hasVideo, metadata.hasAudio);
          updateAsset(id, { ...derivatives });
        } catch {
          // 缩略图和波形属于可重建缓存，不阻断素材导入。
        }
        if (metadata.hasVideo && metadata.height > settings.media.proxyHeight && settings.media.proxyEnabled) {
          try {
            const proxy = await createProxy(path, id, metadata.durationUs);
            updateAsset(id, { proxyPath: proxy.proxyPath, proxyObjectUrl: localMediaUrl(proxy.proxyPath), proxyHeight: proxy.height });
          } catch (proxyError) {
            setNotice(proxyError instanceof Error ? `素材已导入，代理生成失败：${proxyError.message}` : "素材已导入，代理生成失败");
          }
        }
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "视频导入失败");
    } finally {
      setBusyMessage(null);
    }
  }

  function downloadProjectInBrowser() {
    const url = URL.createObjectURL(new Blob([serializeProject(project)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.name}.bvideo.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    savedProjectRef.current = serializeProject(project);
    void clearRecoverySnapshot();
  }

  async function saveProject() {
    if (!isDesktopRuntime()) {
      downloadProjectInBrowser();
      return;
    }
    const path = currentProjectPath ?? await selectProjectDestination(project.name);
    if (!path) return;
    try {
      const serialized = serializeProject(project);
      await saveProjectFile(path, serialized);
      savedProjectRef.current = serialized;
      setCurrentProjectPath(path);
      await clearRecoverySnapshot();
      setRecentProjects(await rememberRecentProject(path, project));
      setNotice("工程已保存");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "工程保存失败");
    }
  }

  async function openProjectPath(path: string) {
    if (!path) return;
    try {
      const next = await hydrateProjectAssets(parseProject(await readProjectFile(path)), {
        desktop: isDesktopRuntime(), proxyEnabled: settings.media.proxyEnabled, proxyHeight: settings.media.proxyHeight,
        pathExists: mediaPathExists, mediaUrl: localMediaUrl, createProxy
      });
      replaceProject(next);
      savedProjectRef.current = serializeProject(next);
      setCurrentProjectPath(path);
      await clearRecoverySnapshot();
      setRecentProjects(await rememberRecentProject(path, next));
      setRecentOpen(false);
      const missingCount = next.assets.filter((asset) => asset.missing).length;
      setNotice(missingCount ? `已打开 ${next.name}，有 ${missingCount} 个素材需要重新定位` : `已打开 ${next.name}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "工程打开失败");
    }
  }

  async function openProject() {
    if (!isDesktopRuntime()) return;
    const path = await selectProjectToOpen();
    if (path) await openProjectPath(path);
  }

  async function restoreProject() {
    if (!recoverySnapshot || restoringRecovery) return;
    setRestoringRecovery(true);
    setRecoveryError("");
    try {
      const next = await restoreRecoverySnapshot(recoverySnapshot, {
        desktop: isDesktopRuntime(), proxyEnabled: settings.media.proxyEnabled, proxyHeight: settings.media.proxyHeight,
        pathExists: mediaPathExists, mediaUrl: localMediaUrl, createProxy
      });
      replaceProject(next);
      setCurrentProjectPath(recoverySnapshot.projectPath);
      setRecoverySnapshot(null);
      const missingCount = next.assets.filter((asset) => asset.missing).length;
      setNotice(missingCount ? `已恢复工程，有 ${missingCount} 个素材需要重新定位` : "已恢复未保存的工程");
    } catch (error) {
      setRecoveryError(error instanceof Error ? error.message : "工程恢复失败");
    } finally {
      setRestoringRecovery(false);
    }
  }

  async function discardRecovery() {
    await clearRecoverySnapshot();
    setRecoveryError("");
    setRecoverySnapshot(null);
  }

  async function relinkAsset(assetId: string) {
    const asset = project.assets.find((candidate) => candidate.id === assetId);
    if (!asset) return;
    const path = await selectReplacementMediaPath(asset.sourcePath);
    if (!path) return;
    setBusyMessage(`正在重新定位“${asset.name}”`);
    try {
      if (asset.kind === "image") {
        if (!isImagePath(path)) throw new Error("请选择 PNG、JPG、WebP 或 BMP 图片");
        const metadata = await probeMedia(path);
        updateAsset(assetId, { sourcePath: path, objectUrl: localMediaUrl(path), missing: false, width: metadata.width, height: metadata.height, fileSize: metadata.fileSize, videoCodec: metadata.videoCodec, hasAudio: false });
        setNotice(`已重新定位 ${asset.name}`);
        return;
      }
      const metadata = await probeMedia(path);
      updateAsset(assetId, { sourcePath: path, objectUrl: localMediaUrl(path), missing: false, ...metadata });
      try {
        const derivatives = await generateMediaDerivatives(path, assetId, metadata.hasVideo, metadata.hasAudio);
        updateAsset(assetId, derivatives);
      } catch {
        // 缩略图和波形可以稍后重建。
      }
      if (metadata.hasVideo && metadata.height > settings.media.proxyHeight && settings.media.proxyEnabled) {
        const proxy = await createProxy(path, assetId, metadata.durationUs);
        updateAsset(assetId, { proxyPath: proxy.proxyPath, proxyObjectUrl: localMediaUrl(proxy.proxyPath), proxyHeight: proxy.height });
      } else {
        updateAsset(assetId, { proxyPath: undefined, proxyObjectUrl: undefined, proxyHeight: undefined });
      }
      setNotice(`已重新定位 ${asset.name}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "素材重新定位失败");
    } finally {
      setBusyMessage(null);
    }
  }

  async function addCreatedAudio(source: CreatedAudioSource, startUs?: number, generatedBlockId?: string) {
    const id = crypto.randomUUID();
    if (source.path) {
      const metadata = await probeMedia(source.path);
      const name = source.path.split(/[\\/]/).at(-1) ?? source.name;
      addAudio({ id, name, kind: "audio", sourcePath: source.path, objectUrl: localMediaUrl(source.path), missing: false, ...metadata }, source.role, startUs, generatedBlockId);
      if (generatedBlockId && source.role === "voice") {
        if (source.segmentDurationsUs?.length && source.sourceSubtitleIds?.length === source.segmentDurationsUs.length) {
          alignGeneratedSceneDurations(generatedBlockId, source.segmentDurationsUs, source.sourceSubtitleIds);
        } else {
          alignGeneratedBlockDuration(generatedBlockId, metadata.durationUs);
        }
      }
      try {
        const derivatives = await generateMediaDerivatives(source.path, id, false, true);
        updateAsset(id, derivatives);
      } catch {
        // 波形缓存失败不影响配音素材。
      }
      setNotice(`已加入 ${source.name}`);
      return;
    }
    if (source.blob) {
      const objectUrl = URL.createObjectURL(source.blob);
      const metadata = await loadAudioMetadata(objectUrl);
      addAudio({ id, name: source.name, kind: "audio", durationUs: Math.round(metadata.duration * 1_000_000), objectUrl, hasAudio: true, missing: false }, source.role, startUs, generatedBlockId);
      if (generatedBlockId && source.role === "voice") alignGeneratedBlockDuration(generatedBlockId, Math.round(metadata.duration * 1_000_000));
      setNotice(`已加入 ${source.name}`);
    }
  }

  async function matchSubtitleEffects() {
    if (aiRequestController) return;
    const allSubtitles = project.tracks.flatMap((track) => track.clips).filter((clip) => clip.kind === "subtitle");
    if (!allSubtitles.length) {
      setNotice("请先通过视频识别或 AI 生成获得时间字幕");
      return;
    }
    if (!settings.aiProvider.model || !(await hasApiKey())) {
      setNotice("请先配置云端大模型和 API Key");
      setSettingsOpen(true);
      return;
    }
    const subtitles = subtitlesForMotionMatch(allSubtitles, useEditorStore.getState().selectedClipIds);
    const videoClips = project.tracks.flatMap((track) => track.clips).filter((clip) => clip.kind === "video");
    const controller = new AbortController();
    setAiRequestController(controller);
    setNotice(null);
    setBusyMessage(`正在为 ${subtitles.length} 条字幕匹配场景、动效与音效`);
    try {
      const result = await matchTimelineMotion(settings.aiProvider, {
        topic: project.name,
        style: "内容优先、关键词精炼、时间轴感知、避免遮挡字幕",
        article: generatedClips.map((clip) => clip.article).filter(Boolean).join("\n").slice(0, 8_000),
        captions: subtitles.map((clip) => ({ startSeconds: clip.startUs / 1_000_000, endSeconds: (clip.startUs + clip.durationUs) / 1_000_000, text: clip.text })),
        timelineDurationSeconds: Math.max(0.1, project.durationUs / 1_000_000),
        materials: project.assets.filter((asset) => asset.kind === "video" && !asset.missing).slice(0, 40).map((asset) => {
          const sourceSubtitles = allSubtitles.filter((subtitle) => subtitle.sourceAssetId === asset.id);
          const placedRole = videoClips.find((clip) => clip.assetId === asset.id)?.role;
          return {
            id: asset.id,
            name: asset.name,
            durationSeconds: asset.durationUs / 1_000_000,
            width: asset.width,
            height: asset.height,
            roleHint: sourceSubtitles.length ? "a-roll" as const : placedRole ?? "unspecified" as const,
            transcriptExcerpt: sourceSubtitles.map((subtitle) => subtitle.text).join(" ").slice(0, 500)
          };
        })
      }, browserApiKey(), controller.signal, (progress) => setBusyMessage(progress.message));
      const soundIds = [...new Set((result.matches ?? []).flatMap((match) => match.soundEffectId ? [match.soundEffectId] : []))];
      const soundAssets = await Promise.all(soundIds.map(async (soundId) => {
        const expectedName = `${builtinSoundEffectById(soundId)?.name}.wav`;
        const existing = useEditorStore.getState().project.assets.find((asset) => asset.id === builtinSoundAssetId(soundId) && !asset.missing && asset.name === expectedName);
        return existing ?? createBuiltinSoundAsset(soundId, { refresh: true });
      }));
      const applied = applyMotionMatches(subtitles.map((clip) => clip.id), result.matches ?? [], soundAssets);
      const lintIssues = lintMotionProject(useEditorStore.getState().project);
      const errors = lintIssues.filter((issue) => issue.severity === "error");
      if (errors.length) {
        undo();
        throw new Error(`AI 编排未通过动效检查：${errors[0].message}`);
      }
      const warnings = lintIssues.filter((issue) => issue.severity === "warning");
      const visualCount = applied.effectCount + applied.sceneCount;
      let completionNotice = `AI 编排已完成：写入 ${visualCount} 个动效、${applied.soundCount} 个音效、${applied.videoCount} 段视频或运镜`;
      if (applied.requestedEffectCount === 0) {
        completionNotice += "；模型本次没有为这些字幕选择动效";
      } else if (applied.skippedEffectCount > 0) {
        completionNotice += `；${applied.skippedEffectCount} 个动效因避让空间不足未添加，请调整人物避让区后重试`;
      }
      if (warnings.length) completionNotice += `；动效检查有 ${warnings.length} 条提醒：${warnings[0].message}`;
      setNotice(completionNotice);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "动效匹配失败");
    } finally {
      setAiRequestController(null);
      setBusyMessage(null);
    }
  }

  async function addBuiltinSound(soundId: BuiltinSoundEffectId) {
    try {
      const expectedName = `${builtinSoundEffectById(soundId)?.name}.wav`;
      const current = useEditorStore.getState().project.assets.find((asset) => asset.id === builtinSoundAssetId(soundId) && !asset.missing && asset.name === expectedName);
      const asset = current ?? await createBuiltinSoundAsset(soundId, { refresh: true });
      addAudio(asset, "sound");
      setNotice(`已在播放头添加“${builtinSoundEffectById(soundId)?.name ?? "内置音效"}”`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "内置音效添加失败");
    }
  }

  function playBuiltinSound(soundId: BuiltinSoundEffectId) {
    void previewBuiltinSound(soundId).catch(() => setNotice("浏览器阻止了音效试听，请再次点击试听"));
  }

  async function exportVideo(options: VideoExportOptions) {
    setExportOpen(false);
    if (!isDesktopRuntime()) {
      setNotice("视频导出需要在桌面客户端中运行");
      return;
    }
    const missing = project.assets.filter((asset) => asset.missing);
    if (missing.length) {
      setNotice(`有 ${missing.length} 个素材已丢失，请先重新定位`);
      return;
    }
    const lintIssues = lintMotionProject(project);
    const lintErrors = lintIssues.filter((issue) => issue.severity === "error");
    if (lintErrors.length) {
      setNotice(`导出已阻止：${lintErrors[0].message}（共 ${lintErrors.length} 项错误）`);
      return;
    }
    const lintWarnings = lintIssues.filter((issue) => issue.severity === "warning");
    if (lintWarnings.length) setNotice(`动效检查有 ${lintWarnings.length} 条提醒，继续导出：${lintWarnings[0].message}`);
    const outputPath = await selectVideoDestination(project.name, options.format);
    if (!outputPath) return;
    setBusyMessage(`正在渲染 ${options.format.toUpperCase()}，请保持客户端开启`);
    try {
      const plan = await rasterizeRenderPlan(await rasterizeReactEffects(buildRenderPlan(project, outputPath, options)));
      const job = startExportRenderPlan(plan, (event) => {
        setExportProgress(event);
        setBusyMessage(event.message);
      });
      setExportJobId(job.jobId);
      await job.result;
      setNotice(`视频已导出到 ${outputPath}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error || "视频导出失败"));
    } finally {
      setBusyMessage(null);
      setExportJobId("");
      setExportProgress(null);
    }
  }

  async function createProxy(path: string, assetId: string, durationUs: number) {
    const job = startProxyGeneration(path, assetId, settings.media.proxyHeight, durationUs, (event) => {
      setProxyProgress(event);
      setBusyMessage(event.message);
    });
    setProxyJobId(job.jobId);
    try {
      return await job.result;
    } finally {
      setProxyJobId("");
      setProxyProgress(null);
      setBusyMessage(null);
    }
  }

  async function cancelCurrentTask() {
    if (aiRequestController) aiRequestController.abort();
    else if (exportJobId) await cancelExportJob(exportJobId);
    else if (proxyJobId) await cancelExportJob(proxyJobId);
    else if (audioExtractionJobId) await cancelExportJob(audioExtractionJobId);
    else if (asrJobId) await cancelCloudSpeechRequest(asrJobId);
  }

  async function extractAssetAudio(assetId: string, exportToFile: boolean) {
    const asset = project.assets.find((candidate) => candidate.id === assetId);
    if (!asset?.sourcePath || asset.kind !== "video" || asset.missing || !asset.hasAudio) {
      setNotice("该视频没有可分离的本地音轨");
      return;
    }
    const baseName = asset.name.replace(/\.[^.]+$/u, "") || "分离音频";
    const outputPath = exportToFile ? await selectAudioDestination(baseName) : null;
    if (exportToFile && !outputPath) return;
    setBusyMessage(`正在分离“${asset.name}”的音频`);
    try {
      const job = startAudioExtraction(asset.sourcePath, asset.id, asset.durationUs, outputPath, (event) => setBusyMessage(`${event.message} · ${Math.round(event.progress * 100)}%`));
      setAudioExtractionJobId(job.jobId);
      const result = await job.result;
      if (exportToFile) {
        setNotice(`音频已导出到 ${result.path}`);
        return;
      }
      const metadata = await probeMedia(result.path);
      const id = crypto.randomUUID();
      addExtractedAudio({ id, name: `${baseName} · 分离音频.m4a`, kind: "audio", sourcePath: result.path, objectUrl: localMediaUrl(result.path), missing: false, ...metadata }, asset.id);
      try {
        const derivatives = await generateMediaDerivatives(result.path, id, false, true);
        updateAsset(id, derivatives);
      } catch {
        // 波形缓存失败不影响已分离音轨。
      }
      setNotice("音频已分离并按原视频时间对齐到音效轨");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error || "音频分离失败"));
    } finally {
      setAudioExtractionJobId("");
      setBusyMessage(null);
    }
  }

  async function transcribeAsset(assetId: string) {
    const asset = project.assets.find((candidate) => candidate.id === assetId);
    if (!asset?.sourcePath || asset.missing) {
      setNotice("该素材没有可访问的本地路径");
      return;
    }
    if (!(await hasSpeechApiKey())) {
      setNotice("请先在设置中配置云端语音 API Key");
      setSettingsOpen(true);
      return;
    }
    setBusyMessage(`正在使用 MiMo 云端识别“${asset.name}”`);
    try {
      const job = startCloudMediaTranscription(asset.sourcePath, asset.durationUs, settings.cloudSpeech, (event) => {
        setAsrProgress(event);
        setBusyMessage(event.message);
      });
      setAsrJobId(job.jobId);
      const transcript = await job.result;
      const segments = captionSegments(transcript, asset.durationUs);
      if (!segments.length) throw new Error("云端模型没有识别出字幕内容");
      addSubtitles(assetId, segments);
      setNotice(`已生成 ${segments.length} 条云端字幕 · ${transcript.language || "自动识别"} · ${transcript.device}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error || "云端字幕提取失败"));
    } finally {
      setBusyMessage(null);
      setAsrJobId("");
      setAsrProgress(null);
    }
  }

  return (
    <Tooltip.Provider delayDuration={350}>
      <div className="app-shell" data-desktop-platform={platformLayout}>
        <header className="app-header" data-tauri-drag-region>
          <div className="brand"><span className="brand-mark">B</span><strong>BVideo Studio</strong><span className="project-name">{project.name}</span></div>
          <div className="header-tools">
            <ToolButton label="撤销" disabled={!pastCount} onClick={undo}><Undo2 size={16} /></ToolButton>
            <ToolButton label="重做" disabled={!futureCount} onClick={redo}><Redo2 size={16} /></ToolButton>
            <span className="toolbar-divider" />
            <ToolButton label="打开工程" onClick={() => void openProject()}><FolderOpen size={16} /></ToolButton>
            {isDesktopRuntime() && <ToolButton label="最近工程" onClick={() => setRecentOpen(true)}><History size={16} /></ToolButton>}
            <ToolButton label="保存工程" onClick={() => void saveProject()}><Save size={16} /></ToolButton>
            <button className="button header-button" type="button" onClick={() => void requestImport()}><FileVideo2 size={16} />导入</button>
            <button className="button header-button export" type="button" disabled={Boolean(busyMessage)} onClick={() => setExportOpen(true)}>{busyMessage ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}{exportProgress ? `${Math.round(exportProgress.progress * 100)}%` : busyMessage ? "处理中" : "导出"}</button>
            <ToolButton label="模型与客户端设置" onClick={() => setSettingsOpen(true)}><Settings size={17} /></ToolButton>
          </div>
          <WindowControls />
        </header>
        <EditorWorkspace aiProvider={settings.aiProvider} onNeedSettings={() => setSettingsOpen(true)} onImport={() => void requestImport()} onGenerate={() => setGenerateOpen(true)} onMatchEffects={() => void matchSubtitleEffects()} onTranscribe={(assetId) => void transcribeAsset(assetId)} onExtractAudio={(assetId) => void extractAssetAudio(assetId, false)} onExportAudio={(assetId) => void extractAssetAudio(assetId, true)} onRelink={(assetId) => void relinkAsset(assetId)} onCreateAudio={() => setAudioOpen(true)} onManageEffects={() => setEffectLibraryOpen(true)} onPreviewBuiltinSound={playBuiltinSound} onAddBuiltinSound={(soundId) => void addBuiltinSound(soundId)} />
        <input ref={fileInput} className="visually-hidden" type="file" accept="video/*,audio/*,image/png,image/jpeg,image/webp,image/bmp" onChange={(event) => void importBrowserMedia(event)} />
      </div>
      {(busyMessage || notice) && <div className={`status-toast ${busyMessage ? "busy" : ""}`}>{busyMessage && <LoaderCircle className="spin" size={15} />}<span>{busyMessage ?? notice}{exportProgress ? <small>{Math.round(exportProgress.progress * 100)}% · {exportProgress.segmentIndex}/{exportProgress.segmentCount || "-"}</small> : proxyProgress ? <small>{Math.round(proxyProgress.progress * 100)}%</small> : asrProgress ? <small>{Math.round(asrProgress.progress * 100)}% · 云端处理</small> : null}</span>{(aiRequestController || exportJobId || proxyJobId || audioExtractionJobId || asrJobId) && <button type="button" aria-label={aiRequestController ? "取消 AI 匹配" : exportJobId ? "取消视频导出" : proxyJobId ? "取消代理生成" : audioExtractionJobId ? "取消音频分离" : "取消字幕识别"} title="取消任务" onClick={() => void cancelCurrentTask()}><Square size={12} fill="currentColor" /></button>}{notice && <button type="button" aria-label="关闭提示" onClick={() => setNotice(null)}>×</button>}</div>}
      <AiSettingsDialog open={settingsOpen} settings={settings} onOpenChange={setSettingsOpen} onSave={setSettings} />
      <AiGenerateDialog open={generateOpen} settings={settings} onOpenChange={setGenerateOpen} onNeedSettings={() => { setGenerateOpen(false); setSettingsOpen(true); }} />
      <AudioCreateDialog open={audioOpen} defaultText={defaultNarration} speechSegments={narrationSubtitles.map((subtitle) => ({ id: subtitle.id, text: subtitle.text }))} cloudSpeech={settings.cloudSpeech} onOpenChange={setAudioOpen} onCreated={(source) => addCreatedAudio(source, narrationBlock?.startUs, narrationBlock?.id)} />
      <EffectLibraryDialog open={effectLibraryOpen} onOpenChange={setEffectLibraryOpen} />
      <ExportDialog open={exportOpen} canvas={project.canvas} defaultEncoder={settings.media.encoder} busy={Boolean(busyMessage)} onOpenChange={setExportOpen} onExport={(options) => void exportVideo(options)} />
      <ProjectRecoveryDialog snapshot={recoverySnapshot} restoring={restoringRecovery} error={recoveryError} onDiscard={() => void discardRecovery()} onRestore={() => void restoreProject()} />
      <RecentProjectsDialog open={recentOpen} projects={recentProjects} onOpenChange={setRecentOpen} onOpenProject={(path) => void openProjectPath(path)} onBrowse={() => { setRecentOpen(false); void openProject(); }} />
      {updater.visible && updater.info && <UpdateModal info={updater.info} status={updater.status} canDismiss={updater.canDismiss} downloadedBytes={updater.downloadedBytes} totalBytes={updater.totalBytes} progressPercent={updater.progressPercent} errorMessage={updater.errorMessage} installed={updater.installed} onDismiss={() => updater.setVisible(false)} onInstall={() => void updater.installAndRestart()} onRestart={() => void updater.retryRestart()} />}
    </Tooltip.Provider>
  );
}

function ToolButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <Tooltip.Root><Tooltip.Trigger asChild><button className="icon-button" type="button" aria-label={label} disabled={disabled} onClick={onClick}>{children}</button></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content className="tooltip" sideOffset={7}>{label}<Tooltip.Arrow className="tooltip-arrow" /></Tooltip.Content></Tooltip.Portal></Tooltip.Root>;
}
