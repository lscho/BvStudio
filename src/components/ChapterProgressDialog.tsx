import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, ListTree, LoaderCircle, Plus, SlidersHorizontal, Sparkles, Square, Trash2, WandSparkles, X } from "lucide-react";
import { contentEndUs, type ChapterMarker, type ChapterProgressSettings } from "@/domain/project";
import { autoChapterMarkers, CHAPTER_PROGRESS_PRESETS, type ChapterProgressPresetDefinition } from "@/domain/videoDecorations";
import { browserApiKey, generateSubtitleChapters, hasApiKey, type AiProviderConfig } from "@/services/ai/provider";
import { useEditorStore } from "@/stores/editorStore";

interface Props {
  open: boolean;
  aiProvider: AiProviderConfig;
  onOpenChange: (open: boolean) => void;
  onNeedSettings: () => void;
}

type ChapterAppearance = Omit<ChapterProgressSettings, "enabled" | "chapters">;

export function ChapterProgressDialog({ open, aiProvider, onOpenChange, onNeedSettings }: Props) {
  const project = useEditorStore((state) => state.project);
  const updateChapterProgress = useEditorStore((state) => state.updateChapterProgress);
  const [enabled, setEnabled] = useState(false);
  const [chapterCount, setChapterCount] = useState(4);
  const [chapters, setChapters] = useState<ChapterMarker[]>([]);
  const [aiWorking, setAiWorking] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiController, setAiController] = useState<AbortController | null>(null);
  const [appearance, setAppearance] = useState<ChapterAppearance>(() => {
    const { enabled: _enabled, chapters: _chapters, ...initial } = project.chapterProgress;
    return initial;
  });
  const subtitles = useMemo(() => project.tracks.flatMap((track) => track.clips).filter((clip) => clip.kind === "subtitle"), [project.tracks]);
  const durationUs = Math.max(contentEndUs(project), subtitles.at(-1)?.startUs ?? 0, 1_000_000);
  const presetName = appearance.preset === "custom"
    ? "自定义"
    : CHAPTER_PROGRESS_PRESETS.find((preset) => preset.id === appearance.preset)?.name ?? "自定义";

  useEffect(() => {
    if (!open) return;
    const { enabled: nextEnabled, chapters: nextChapters, ...nextAppearance } = project.chapterProgress;
    setEnabled(nextEnabled);
    setChapters(structuredClone(nextChapters));
    setChapterCount(Math.max(2, Math.min(6, nextChapters.length || 4)));
    setAppearance(nextAppearance);
    setAiError("");
    setAiMessage("");
  }, [open, project.chapterProgress]);

  function generateChapters() {
    setChapters(autoChapterMarkers(subtitles, durationUs, chapterCount));
    setEnabled(true);
  }

  function patchChapter(id: string, patch: Partial<ChapterMarker>) {
    setChapters((current) => current.map((chapter) => chapter.id === id ? { ...chapter, ...patch } : chapter).sort((left, right) => left.startUs - right.startUs));
  }

  function applyPreset(preset: ChapterProgressPresetDefinition) {
    const { id, name: _name, description: _description, ...settings } = preset;
    setAppearance({ preset: id, ...settings });
    setEnabled(true);
  }

  async function generateAiChapters() {
    if (!subtitles.length) {
      setAiError("请先生成或提取时间字幕");
      return;
    }
    if (!aiProvider.model.trim()) {
      setAiError("请先配置云端模型和 API Key");
      return;
    }
    const orderedSubtitles = [...subtitles].sort((left, right) => left.startUs - right.startUs);
    const requestController = new AbortController();
    setAiController(requestController);
    setAiWorking(true);
    setAiError("");
    setAiMessage("正在连接模型服务");
    try {
      if (!(await hasApiKey())) throw new Error("请先配置 API Key");
      const result = await generateSubtitleChapters(aiProvider, {
        captions: orderedSubtitles.map((subtitle) => ({
          startSeconds: subtitle.startUs / 1_000_000,
          endSeconds: (subtitle.startUs + subtitle.durationUs) / 1_000_000,
          text: subtitle.text
        })),
        requestedCount: chapterCount,
        timelineDurationSeconds: durationUs / 1_000_000
      }, browserApiKey(), requestController.signal, (progress) => setAiMessage(progress.message));
      const nextChapters = result.chapters.map((chapter) => ({
        id: crypto.randomUUID(),
        title: chapter.title,
        startUs: orderedSubtitles[chapter.captionIndex].startUs
      }));
      setChapters(nextChapters);
      setChapterCount(Math.max(2, Math.min(6, nextChapters.length)));
      setEnabled(true);
      setAiMessage(`已根据 ${orderedSubtitles.length} 条字幕生成 ${nextChapters.length} 个章节`);
    } catch (exception) {
      if (!requestController.signal.aborted) setAiError(exception instanceof Error ? exception.message : String(exception || "AI 分章失败"));
    } finally {
      setAiWorking(false);
      setAiController(null);
    }
  }

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen) aiController?.abort();
    onOpenChange(nextOpen);
  }

  function openSettings() {
    aiController?.abort();
    onOpenChange(false);
    onNeedSettings();
  }

  function customize(patch: Partial<Omit<ChapterAppearance, "preset">>) {
    setAppearance((current) => ({ ...current, ...patch, preset: "custom" }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    updateChapterProgress({ enabled, chapters, ...appearance });
    onOpenChange(false);
  }

  return <Dialog.Root open={open} onOpenChange={changeOpen}>
    <Dialog.Portal>
      <Dialog.Overlay className="dialog-overlay" />
      <Dialog.Content className="dialog-content chapter-dialog" aria-describedby="chapter-description">
        <Dialog.Close className="icon-button dialog-close" aria-label="关闭"><X size={18} /></Dialog.Close>
        <div className="dialog-title-row"><ListTree size={18} /><div><Dialog.Title>章节进度</Dialog.Title><Dialog.Description id="chapter-description">选择常用样式并按时间字幕分段，也可以自定义外观和章节内容。</Dialog.Description></div></div>
        <form aria-busy={aiWorking} onSubmit={submit}>
          <label className="check-row"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /><span>在视频中显示章节进度</span></label>

          <section className="chapter-section" aria-labelledby="chapter-preset-title">
            <div className="chapter-section-heading"><div><strong id="chapter-preset-title">主题样式</strong><span>当前：{presetName}</span></div></div>
            <div className="chapter-preset-grid">
              {CHAPTER_PROGRESS_PRESETS.map((preset) => <button
                key={preset.id}
                type="button"
                className={appearance.preset === preset.id ? "active" : undefined}
                aria-label={preset.name}
                aria-pressed={appearance.preset === preset.id}
                onClick={() => applyPreset(preset)}
              >
                <span className={`chapter-preset-preview style-${preset.style} position-${preset.position}`} style={{ "--preview-bg": preset.backgroundColor, "--preview-opacity": preset.backgroundOpacity, "--preview-accent": preset.activeColor, "--preview-inactive": preset.inactiveColor, "--preview-text": preset.textColor } as React.CSSProperties}><i /><i /><i /></span>
                <span><strong>{preset.name}</strong><small>{preset.description}</small></span>
                {appearance.preset === preset.id && <Check size={14} aria-hidden />}
              </button>)}
              <button type="button" className={appearance.preset === "custom" ? "active" : undefined} aria-label="自定义" aria-pressed={appearance.preset === "custom"} onClick={() => setAppearance((current) => ({ ...current, preset: "custom" }))}>
                <span className="chapter-preset-preview custom"><SlidersHorizontal size={16} /></span>
                <span><strong>自定义</strong><small>从当前样式继续精细调整</small></span>
                {appearance.preset === "custom" && <Check size={14} aria-hidden />}
              </button>
            </div>
          </section>

          <section className="chapter-section" aria-labelledby="chapter-content-title">
            <div className="chapter-section-heading"><strong id="chapter-content-title">章节内容</strong></div>
            <div className="chapter-auto-row">
              <label><span>章节数量</span><select aria-label="章节数量" value={chapterCount} disabled={aiWorking} onChange={(event) => setChapterCount(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count} 段</option>)}</select></label>
              <div className="chapter-auto-actions">
                <button className="button secondary" type="button" disabled={aiWorking} onClick={generateChapters}><WandSparkles size={14} />按字幕分段</button>
                <button className="button primary" type="button" disabled={!subtitles.length} aria-label={aiWorking ? "停止 AI 分章" : "AI 智能分章"} onClick={() => aiWorking ? aiController?.abort() : void generateAiChapters()}>{aiWorking ? <Square size={12} fill="currentColor" /> : <Sparkles size={14} />}{aiWorking ? "停止分章" : "AI 智能分章"}</button>
              </div>
            </div>
            <div className="chapter-ai-status"><span>{subtitles.length ? `已检测到 ${subtitles.length} 条时间字幕` : "未检测到时间字幕"}</span>{aiMessage && <span role="status">{aiWorking && <LoaderCircle className="spin" size={12} />}{aiMessage}</span>}</div>
            {aiError && <div className="error-callout chapter-ai-error" role="alert"><span>{aiError}</span>{aiError.includes("配置") || aiError.includes("API Key") ? <button type="button" onClick={openSettings}>打开配置</button> : null}</div>}
            <div className="chapter-list" aria-label="章节列表">
              {chapters.map((chapter, index) => <div className="chapter-row" key={chapter.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <label><span className="visually-hidden">章节 {index + 1} 标题</span><input aria-label={`章节 ${index + 1} 标题`} value={chapter.title} maxLength={24} disabled={aiWorking} onChange={(event) => patchChapter(chapter.id, { title: event.target.value })} /></label>
                <label className="chapter-time"><span className="visually-hidden">章节 {index + 1} 开始时间</span><input aria-label={`章节 ${index + 1} 开始时间`} type="number" min={0} max={durationUs / 1_000_000} step="any" value={Number((chapter.startUs / 1_000_000).toFixed(3))} disabled={aiWorking} onChange={(event) => patchChapter(chapter.id, { startUs: Math.round(Number(event.target.value) * 1_000_000) })} /><i>s</i></label>
                <button type="button" aria-label={`删除章节 ${index + 1}`} title="删除章节" disabled={aiWorking} onClick={() => setChapters((current) => current.filter((item) => item.id !== chapter.id))}><Trash2 size={14} /></button>
              </div>)}
              {!chapters.length && <p className="chapter-empty">暂无章节</p>}
            </div>
            <button className="chapter-add" type="button" disabled={aiWorking || chapters.length >= 6} onClick={() => setChapters((current) => [...current, { id: crypto.randomUUID(), title: `章节 ${current.length + 1}`, startUs: Math.round(durationUs * current.length / Math.max(1, current.length + 1)) }].sort((left, right) => left.startUs - right.startUs))}><Plus size={14} />添加章节</button>
          </section>

          <section className="chapter-section" aria-labelledby="chapter-custom-title">
            <div className="chapter-section-heading"><strong id="chapter-custom-title">自定义外观</strong><span>修改后自动切换为自定义</span></div>
            <div className="chapter-custom-grid">
              <label><span>显示位置</span><select aria-label="显示位置" value={appearance.position} onChange={(event) => customize({ position: event.target.value as ChapterAppearance["position"] })}><option value="top">顶部</option><option value="bottom">底部</option></select></label>
              <label><span>进度样式</span><select aria-label="进度样式" value={appearance.style} onChange={(event) => customize({ style: event.target.value as ChapterAppearance["style"] })}><option value="segments">分段</option><option value="line">极简线</option><option value="steps">步骤点</option><option value="labels">章节标签</option></select></label>
              <label><span>高度</span><span className="chapter-number-input"><input aria-label="章节高度" type="number" min={28} max={120} step={1} value={appearance.height} onChange={(event) => customize({ height: Number(event.target.value) })} /><i>px</i></span></label>
              <label className="check-row chapter-title-toggle"><input type="checkbox" aria-label="显示章节标题" checked={appearance.showTitles} onChange={(event) => customize({ showTitles: event.target.checked })} /><span>显示章节标题</span></label>
              <label><span>背景</span><input aria-label="背景颜色" type="color" value={appearance.backgroundColor} onChange={(event) => customize({ backgroundColor: event.target.value })} /></label>
              <label><span>当前章节</span><input aria-label="当前章节颜色" type="color" value={appearance.activeColor} onChange={(event) => customize({ activeColor: event.target.value })} /></label>
              <label><span>未激活</span><input aria-label="未激活颜色" type="color" value={appearance.inactiveColor} onChange={(event) => customize({ inactiveColor: event.target.value })} /></label>
              <label><span>文字</span><input aria-label="文字颜色" type="color" value={appearance.textColor} onChange={(event) => customize({ textColor: event.target.value })} /></label>
              <label className="chapter-opacity"><span>背景透明度 <output>{Math.round(appearance.backgroundOpacity * 100)}%</output></span><input aria-label="背景透明度" type="range" min={0} max={1} step={0.05} value={appearance.backgroundOpacity} onChange={(event) => customize({ backgroundOpacity: Number(event.target.value) })} /></label>
            </div>
          </section>

          <div className="dialog-actions"><Dialog.Close className="button secondary" type="button">取消</Dialog.Close><button className="button primary" type="submit" disabled={aiWorking}>应用</button></div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
