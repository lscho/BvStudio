import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { Captions, Check, FileText, FileUp, LoaderCircle, Sparkles, Square, X } from "lucide-react";
import { Select } from "@/components/Select";
import { timedTextSegments } from "@/domain/captions";
import { parseSrtDocument } from "@/domain/srt";
import { browserApiKey, generateScriptCopy, getAiSessionUsage, hasApiKey, subscribeAiSessionUsage } from "@/services/ai/provider";
import type { PersistedSettings } from "@/services/storage";
import { useEditorStore } from "@/stores/editorStore";

interface Props {
  open: boolean;
  settings: PersistedSettings;
  onOpenChange: (open: boolean) => void;
  onNeedSettings: () => void;
}

type ScriptSource = "ai" | "manual";
type SrtPlacement = "timeline" | "playhead";

const STYLE_OPTIONS = ["专业清晰", "轻快活泼", "知识讲解", "克制简洁"].map((style) => ({ value: style, label: style }));

function formatElapsedTime(seconds: number) {
  if (seconds < 60) return `${seconds} 秒`;
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}

function formatCueTime(seconds: number) {
  const totalSeconds = Math.max(0, seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${remainder.toFixed(3).padStart(6, "0")}`;
}

export function AiGenerateDialog({ open, settings, onOpenChange, onNeedSettings }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState("script");
  const [source, setSource] = useState<ScriptSource>("ai");
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState(30);
  const [style, setStyle] = useState("专业清晰");
  const [copyTitle, setCopyTitle] = useState("");
  const [article, setArticle] = useState("");
  const [script, setScript] = useState("");
  const [srtFileName, setSrtFileName] = useState("");
  const [srtCues, setSrtCues] = useState<ReturnType<typeof parseSrtDocument>>([]);
  const [srtPlacement, setSrtPlacement] = useState<SrtPlacement>("timeline");
  const [working, setWorking] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [generationMessage, setGenerationMessage] = useState("正在连接模型服务");
  const [error, setError] = useState("");
  const [controller, setController] = useState<AbortController | null>(null);
  const usage = useSyncExternalStore(subscribeAiSessionUsage, getAiSessionUsage, getAiSessionUsage);
  const addGeneratedPlan = useEditorStore((state) => state.addGeneratedPlan);
  const addSubtitleSegments = useEditorStore((state) => state.addSubtitleSegments);
  const subtitleTrackLocked = useEditorStore((state) => state.project.tracks.some((track) => track.kind === "subtitle" && track.locked));
  const playheadUs = useEditorStore((state) => state.playheadUs);
  const rangeStartUs = useEditorStore((state) => state.rangeStartUs);
  const rangeEndUs = useEditorStore((state) => state.rangeEndUs);
  const range = rangeStartUs !== null && rangeEndUs !== null && rangeStartUs !== rangeEndUs
    ? { startUs: Math.min(rangeStartUs, rangeEndUs), durationUs: Math.abs(rangeEndUs - rangeStartUs) }
    : null;
  const targetDurationUs = range?.durationUs ?? Math.round(duration * 1_000_000);
  const captionPreview = useMemo(() => timedTextSegments(script, targetDurationUs), [script, targetDurationUs]);

  useEffect(() => {
    if (open) setError("");
  }, [open]);

  useEffect(() => {
    if (!working) return;
    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1_000));
    }, 1_000);
    return () => window.clearInterval(intervalId);
  }, [working]);

  async function generateCopy() {
    if (!topic.trim()) {
      setError("请输入主题或内容要求");
      return;
    }
    if (!settings.aiProvider.model) {
      setError("请先配置模型和 API Key");
      return;
    }
    const requestController = new AbortController();
    setController(requestController);
    setWorking(true);
    setElapsedSeconds(0);
    setGenerationMessage("正在连接模型服务");
    setError("");
    try {
      if (!(await hasApiKey())) throw new Error("请先配置 API Key");
      const result = await generateScriptCopy(settings.aiProvider, {
        topic: topic.trim(),
        durationSeconds: targetDurationUs / 1_000_000,
        style
      }, browserApiKey(), requestController.signal, (progress) => setGenerationMessage(progress.message));
      setCopyTitle(result.script.title);
      setArticle(result.script.article);
      setScript(result.script.narration);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : String(exception || "文案生成失败"));
    } finally {
      setWorking(false);
      setController(null);
    }
  }

  function createCaptions(event: React.FormEvent) {
    event.preventDefault();
    const narration = script.trim();
    if (subtitleTrackLocked) {
      setError("字幕轨已锁定，请解锁后再生成");
      return;
    }
    if (!narration) {
      setError("请先生成或输入文案");
      return;
    }
    if (!Number.isFinite(targetDurationUs) || targetDurationUs <= 0) {
      setError("目标时长必须大于 0 秒");
      return;
    }
    const captions = timedTextSegments(narration, targetDurationUs);
    if (!captions.length) {
      setError("文案无法生成有效字幕，请检查内容和目标时长");
      return;
    }
    const title = source === "ai" ? copyTitle.trim() || topic.trim().slice(0, 80) || "AI 字幕文案" : "手动字幕文案";
    addGeneratedPlan({
      title,
      article: source === "ai" ? article.trim() || narration : narration,
      narration,
      captions,
      matches: [],
      scenes: []
    }, source === "ai" ? topic.trim() : "手动输入文案", "overlay", {
      startUs: range?.startUs ?? playheadUs,
      durationUs: targetDurationUs
    });
    onOpenChange(false);
  }

  async function readSrtFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    try {
      const cues = parseSrtDocument(await file.text());
      setSrtFileName(file.name);
      setSrtCues(cues);
    } catch (exception) {
      setSrtFileName("");
      setSrtCues([]);
      setError(exception instanceof Error ? exception.message : "SRT 解析失败，请检查文件格式");
    }
  }

  function importSrt() {
    if (!srtCues.length) {
      setError("请先选择有效的 SRT 文件");
      return;
    }
    const importedIds = addSubtitleSegments(srtCues, srtPlacement === "timeline" ? 0 : playheadUs);
    if (!importedIds.length) {
      setError("字幕轨已锁定，请解锁后再导入");
      return;
    }
    onOpenChange(false);
  }

  function changeOpen(next: boolean) {
    if (!next) controller?.abort();
    onOpenChange(next);
  }

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content generate-dialog subtitle-create-dialog" aria-describedby="generate-description">
          <Dialog.Close className="icon-button dialog-close" aria-label="关闭"><X size={18} /></Dialog.Close>
          <div className="dialog-title-row"><Captions size={19} /><div><Dialog.Title>生成字幕</Dialog.Title><Dialog.Description id="generate-description">先准备可编辑文案，再生成时间字幕；也可直接导入 SRT。</Dialog.Description></div></div>
          <Tabs.Root className="subtitle-create-tabs" value={activeTab} onValueChange={(value) => { setActiveTab(value); setError(""); }}>
            <input ref={fileInput} className="visually-hidden" type="file" accept=".srt,application/x-subrip,text/plain" onChange={(event) => void readSrtFile(event)} />
            <Tabs.List aria-label="字幕生成方式"><Tabs.Trigger value="script"><FileText size={14} />从文案生成</Tabs.Trigger><Tabs.Trigger value="srt"><FileUp size={14} />导入 SRT</Tabs.Trigger></Tabs.List>
            <Tabs.Content value="script" className="subtitle-create-pane" tabIndex={-1}>
              <form className="settings-form subtitle-create-form" aria-busy={working} onSubmit={createCaptions}>
                <fieldset className="subtitle-step" disabled={working}>
                  <legend><b>1</b><span><strong>准备文案</strong><small>AI 生成后仍可修改，也可完全手动输入</small></span></legend>
                  <div className="segmented-control dual subtitle-source-switch" aria-label="文案来源">
                    <button type="button" className={source === "ai" ? "active" : ""} aria-pressed={source === "ai"} onClick={() => setSource("ai")}><Sparkles size={13} />AI 生成</button>
                    <button type="button" className={source === "manual" ? "active" : ""} aria-pressed={source === "manual"} onClick={() => setSource("manual")}><FileText size={13} />手动输入</button>
                  </div>
                  {source === "ai" && <div className="subtitle-ai-inputs">
                    <label><span>主题与要求</span><textarea aria-label="主题与要求" rows={2} maxLength={4_000} value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="例如：用 45 秒介绍为什么团队需要设计系统" /></label>
                    <div className="form-grid"><label><span>表达风格</span><Select label="表达风格" value={style} onChange={setStyle} options={STYLE_OPTIONS} /></label><button className="button secondary subtitle-copy-button" type="button" onClick={() => void generateCopy()}><Sparkles size={15} />{script ? "重新生成文案" : "生成文案"}</button></div>
                  </div>}
                  <label><span className="subtitle-field-heading"><span>字幕文案</span><small>{script.length.toLocaleString()} / 8,000</small></span><textarea aria-label="字幕文案" rows={4} maxLength={8_000} value={script} onChange={(event) => setScript(event.target.value)} placeholder="在这里输入要显示的完整文案，每句话会自动拆成时间字幕。" /></label>
                </fieldset>
                <fieldset className={`subtitle-step ${script.trim() ? "ready" : ""}`} disabled={working}>
                  <legend><b>{script.trim() ? <Check size={13} /> : "2"}</b><span><strong>生成时间字幕</strong><small>按句意断句，并在目标时长内连续排布</small></span></legend>
                  <div className="form-grid"><label><span>目标时长</span><span className="number-input-suffix"><input aria-label="目标时长" type="number" min={1} max={3_600} step={0.5} value={range ? Number((range.durationUs / 1_000_000).toFixed(3)) : duration} disabled={Boolean(range)} onChange={(event) => setDuration(event.target.valueAsNumber)} /><i>秒</i></span></label><div className="subtitle-estimate" aria-live="polite"><small>预计生成</small><strong>{captionPreview.length} 条字幕</strong></div></div>
                  {range ? <p className="range-callout">使用时间选区 · 起点 {(range.startUs / 1_000_000).toFixed(2)}s · 时长 {(range.durationUs / 1_000_000).toFixed(2)}s</p> : <p className="subtitle-placement-note">字幕从播放头 {(playheadUs / 1_000_000).toFixed(2)}s 开始，不改变已有视频。</p>}
                </fieldset>
                {working && <div className="generation-status" role="status" aria-live="polite"><LoaderCircle className="spin" size={18} /><span><strong>{generationMessage}</strong><small>已等待 {formatElapsedTime(elapsedSeconds)}，可以停止后调整要求</small></span><span className="generation-status-track" aria-hidden="true"><i /></span></div>}
                {error && <div className="error-callout" role="alert"><span>{error}</span>{error.includes("配置") || error.includes("API Key") ? <button type="button" onClick={onNeedSettings}>打开配置</button> : null}</div>}
                {usage.requests > 0 && <p className="usage-summary">本次会话 {usage.requests} 次 · {usage.inputTokens.toLocaleString()} 输入 / {usage.outputTokens.toLocaleString()} 输出 Token · 估算 ${usage.estimatedCostUsd.toFixed(4)}</p>}
                <div className="dialog-actions">{working ? <button className="button secondary" type="button" onClick={() => controller?.abort()}><Square size={13} fill="currentColor" />停止生成</button> : <Dialog.Close className="button secondary" type="button">取消</Dialog.Close>}<button className="button primary" type="submit" disabled={working || !script.trim()}><Captions size={16} />从文案生成字幕</button></div>
              </form>
            </Tabs.Content>
            <Tabs.Content value="srt" className="subtitle-create-pane" tabIndex={-1}>
              <div className="srt-import-pane">
                <button className={`srt-file-picker ${srtCues.length ? "loaded" : ""}`} type="button" onClick={() => fileInput.current?.click()}>
                  {srtCues.length ? <Check size={20} /> : <FileUp size={20} />}
                  <span><strong>{srtFileName || "选择 SRT 文件"}</strong><small>{srtCues.length ? `已读取 ${srtCues.length} 条字幕` : "支持标准 HH:MM:SS,mmm 时间码和 UTF-8 文本"}</small></span>
                  <i>{srtCues.length ? "更换" : "浏览"}</i>
                </button>
                {srtCues.length > 0 && <section className="srt-preview" aria-label="SRT 字幕预览"><header><strong>导入预览</strong><small>{formatCueTime(srtCues[0].startSeconds)} — {formatCueTime(srtCues.at(-1)!.endSeconds)}</small></header>{srtCues.slice(0, 3).map((cue, index) => <div key={`${cue.startSeconds}-${index}`}><time>{formatCueTime(cue.startSeconds)}</time><p>{cue.text}</p></div>)}{srtCues.length > 3 && <small>另有 {srtCues.length - 3} 条字幕</small>}</section>}
                <fieldset><legend>时间定位</legend><div className="segmented-control dual"><button type="button" className={srtPlacement === "timeline" ? "active" : ""} onClick={() => setSrtPlacement("timeline")}>沿用文件时间码</button><button type="button" className={srtPlacement === "playhead" ? "active" : ""} onClick={() => setSrtPlacement("playhead")}>从播放头开始</button></div><p className="subtitle-placement-note">{srtPlacement === "timeline" ? "SRT 的 00:00:00 对齐时间线起点。" : `SRT 的 00:00:00 对齐播放头 ${(playheadUs / 1_000_000).toFixed(2)}s。`}</p></fieldset>
                {error && <div className="error-callout" role="alert"><span>{error}</span></div>}
                <div className="dialog-actions"><Dialog.Close className="button secondary" type="button">取消</Dialog.Close><button className="button primary" type="button" disabled={!srtCues.length} onClick={importSrt}><FileUp size={16} />导入字幕</button></div>
              </div>
            </Tabs.Content>
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
