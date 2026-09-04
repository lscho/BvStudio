import { useEffect, useState, useSyncExternalStore } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { LoaderCircle, Sparkles, Square, X } from "lucide-react";
import { Select } from "@/components/Select";
import type { InsertMode } from "@/domain/project";
import { browserApiKey, generateTimedScript, getAiSessionUsage, hasApiKey, subscribeAiSessionUsage } from "@/services/ai/provider";
import type { PersistedSettings } from "@/services/storage";
import { useEditorStore } from "@/stores/editorStore";

interface Props {
  open: boolean;
  settings: PersistedSettings;
  onOpenChange: (open: boolean) => void;
  onNeedSettings: () => void;
}

const STYLE_OPTIONS = ["专业清晰", "轻快活泼", "知识讲解", "克制简洁"].map((style) => ({ value: style, label: style }));

function formatElapsedTime(seconds: number) {
  if (seconds < 60) return `${seconds} 秒`;
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}

export function AiGenerateDialog({ open, settings, onOpenChange, onNeedSettings }: Props) {
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState(30);
  const [style, setStyle] = useState("专业清晰");
  const [mode, setMode] = useState<InsertMode>("insert");
  const [working, setWorking] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [generationMessage, setGenerationMessage] = useState("正在连接模型服务");
  const [error, setError] = useState("");
  const [controller, setController] = useState<AbortController | null>(null);
  const usage = useSyncExternalStore(subscribeAiSessionUsage, getAiSessionUsage, getAiSessionUsage);
  const addGeneratedPlan = useEditorStore((state) => state.addGeneratedPlan);
  const playheadUs = useEditorStore((state) => state.playheadUs);
  const rangeStartUs = useEditorStore((state) => state.rangeStartUs);
  const rangeEndUs = useEditorStore((state) => state.rangeEndUs);
  const range = rangeStartUs !== null && rangeEndUs !== null && rangeStartUs !== rangeEndUs
    ? { startUs: Math.min(rangeStartUs, rangeEndUs), durationUs: Math.abs(rangeEndUs - rangeStartUs) }
    : null;

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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
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
      const requestedDuration = range && mode !== "insert" ? range.durationUs / 1_000_000 : duration;
      const targetStartUs = range?.startUs ?? playheadUs;
      const result = await generateTimedScript(settings.aiProvider, {
        topic: topic.trim(),
        durationSeconds: requestedDuration,
        style
      }, browserApiKey(), requestController.signal, (progress) => setGenerationMessage(progress.message));
      const plan = { ...result.script, matches: [], scenes: [] };
      addGeneratedPlan(plan, topic.trim(), mode, { startUs: targetStartUs, durationUs: range && mode !== "insert" ? range.durationUs : undefined });
      onOpenChange(false);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : String(exception || "生成失败"));
    } finally {
      setWorking(false);
      setController(null);
    }
  }

  function cancelGeneration() {
    controller?.abort();
  }

  function changeOpen(next: boolean) {
    if (!next) controller?.abort();
    onOpenChange(next);
  }

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content generate-dialog" aria-describedby="generate-description">
          <Dialog.Close className="icon-button dialog-close" aria-label="关闭"><X size={18} /></Dialog.Close>
          <span className="dialog-icon ai"><Sparkles size={21} /></span>
          <Dialog.Title>生成 AI 内容片段</Dialog.Title>
          <Dialog.Description id="generate-description">只生成文章、口播与时间字幕。完成后可在字幕列表中匹配画面与音效。</Dialog.Description>
          <form className="settings-form" aria-busy={working} onSubmit={submit}>
            <label><span>主题与要求</span><textarea rows={5} value={topic} disabled={working} onChange={(event) => setTopic(event.target.value)} placeholder="例如：用 45 秒介绍为什么团队需要设计系统" /></label>
            <div className="form-grid"><label><span>目标时长</span><span className="number-input-suffix"><input type="number" min={1} max={600} step={0.5} value={range && mode !== "insert" ? Number((range.durationUs / 1_000_000).toFixed(3)) : duration} disabled={working || Boolean(range && mode !== "insert")} onChange={(event) => setDuration(Number(event.target.value))} /><i>秒</i></span></label><label><span>表达风格</span><Select label="表达风格" value={style} disabled={working} onChange={setStyle} options={STYLE_OPTIONS} /></label></div>
            <fieldset disabled={working}><legend>加入时间线</legend><div className="segmented-control">{(["insert", "replace", "overlay"] as InsertMode[]).map((value) => <button key={value} className={mode === value ? "active" : ""} type="button" onClick={() => setMode(value)}>{value === "insert" ? "顺序插入" : value === "replace" ? "替换区间" : "叠加区间"}</button>)}</div></fieldset>
            {range && <p className="range-callout">使用时间选区 · 起点 {(range.startUs / 1_000_000).toFixed(2)}s · 时长 {(range.durationUs / 1_000_000).toFixed(2)}s{mode === "insert" ? "（选区仅确定插入位置）" : ""}</p>}
            <p className="provider-summary">{settings.aiProvider.protocol} · {settings.aiProvider.model || "未配置模型"}</p>
            {usage.requests > 0 && <p className="usage-summary">本次会话 {usage.requests} 次 · {usage.inputTokens.toLocaleString()} 输入 / {usage.outputTokens.toLocaleString()} 输出 Token · 估算 ${usage.estimatedCostUsd.toFixed(4)}</p>}
            {working && <div className="generation-status" role="status" aria-live="polite"><LoaderCircle className="spin" size={18} /><span><strong>{generationMessage}</strong><small>已等待 {formatElapsedTime(elapsedSeconds)}，可以停止后调整要求</small></span><span className="generation-status-track" aria-hidden="true"><i /></span></div>}
            {error && <div className="error-callout" role="alert"><span>{error}</span>{error.includes("配置") || error.includes("API Key") ? <button type="button" onClick={onNeedSettings}>打开配置</button> : null}</div>}
            <div className="dialog-actions">{working ? <button className="button secondary" type="button" onClick={cancelGeneration}><Square size={13} fill="currentColor" />停止生成</button> : <Dialog.Close className="button secondary" type="button">取消</Dialog.Close>}<button className="button primary" type="submit" disabled={working}>{working ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}{working ? "正在生成" : "生成片段"}</button></div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
