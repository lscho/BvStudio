import { useEffect, useState, useSyncExternalStore } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Sparkles, Square, X } from "lucide-react";
import type { InsertMode } from "@/domain/project";
import { browserApiKey, generateVideoPlan, getAiSessionUsage, hasApiKey, subscribeAiSessionUsage } from "@/services/ai/provider";
import type { PersistedSettings } from "@/services/storage";
import { useEditorStore } from "@/stores/editorStore";
import { isDesktopRuntime } from "@/services/runtime";

interface Props {
  open: boolean;
  settings: PersistedSettings;
  onOpenChange: (open: boolean) => void;
  onNeedSettings: () => void;
  onCreateNarration: (text: string, startUs: number) => Promise<void>;
}

export function AiGenerateDialog({ open, settings, onOpenChange, onNeedSettings, onCreateNarration }: Props) {
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState(30);
  const [style, setStyle] = useState("专业清晰");
  const [mode, setMode] = useState<InsertMode>("insert");
  const [createVoice, setCreateVoice] = useState(isDesktopRuntime());
  const [matchMaterials, setMatchMaterials] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [controller, setController] = useState<AbortController | null>(null);
  const usage = useSyncExternalStore(subscribeAiSessionUsage, getAiSessionUsage, getAiSessionUsage);
  const addGeneratedPlan = useEditorStore((state) => state.addGeneratedPlan);
  const assets = useEditorStore((state) => state.project.assets);
  const playheadUs = useEditorStore((state) => state.playheadUs);
  const rangeStartUs = useEditorStore((state) => state.rangeStartUs);
  const rangeEndUs = useEditorStore((state) => state.rangeEndUs);
  const range = rangeStartUs !== null && rangeEndUs !== null && rangeStartUs !== rangeEndUs
    ? { startUs: Math.min(rangeStartUs, rangeEndUs), durationUs: Math.abs(rangeEndUs - rangeStartUs) }
    : null;

  useEffect(() => {
    if (open) setError("");
  }, [open]);

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
    setError("");
    try {
      if (!(await hasApiKey())) throw new Error("请先配置 API Key");
      const requestedDuration = range && mode !== "insert" ? range.durationUs / 1_000_000 : duration;
      const targetStartUs = range?.startUs ?? playheadUs;
      const result = await generateVideoPlan(settings.aiProvider, {
        topic: topic.trim(),
        durationSeconds: requestedDuration,
        style,
        materials: matchMaterials ? assets.filter((asset) => asset.kind === "video" && !asset.missing).slice(0, 40).map((asset) => ({
          id: asset.id,
          name: asset.name,
          durationSeconds: asset.durationUs / 1_000_000,
          width: asset.width,
          height: asset.height
        })) : []
      }, browserApiKey(), requestController.signal);
      const plan = result.plan;
      addGeneratedPlan(plan, topic.trim(), mode, { startUs: targetStartUs, durationUs: range && mode !== "insert" ? range.durationUs : undefined });
      onOpenChange(false);
      if (createVoice && plan.narration.trim()) void onCreateNarration(plan.narration, targetStartUs);
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
          <Dialog.Description id="generate-description">在当前播放头生成文章、口播、分镜和动效，可继续手动调整。</Dialog.Description>
          <form className="settings-form" onSubmit={submit}>
            <label><span>主题与要求</span><textarea rows={5} value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="例如：用 45 秒介绍为什么团队需要设计系统" /></label>
            <div className="form-grid"><label><span>目标时长</span><span className="number-input-suffix"><input type="number" min={1} max={600} step={0.5} value={range && mode !== "insert" ? Number((range.durationUs / 1_000_000).toFixed(3)) : duration} disabled={Boolean(range && mode !== "insert")} onChange={(event) => setDuration(Number(event.target.value))} /><i>秒</i></span></label><label><span>表达风格</span><select value={style} onChange={(event) => setStyle(event.target.value)}><option>专业清晰</option><option>轻快活泼</option><option>知识讲解</option><option>克制简洁</option></select></label></div>
            <fieldset><legend>加入时间线</legend><div className="segmented-control">{(["insert", "replace", "overlay"] as InsertMode[]).map((value) => <button key={value} className={mode === value ? "active" : ""} type="button" onClick={() => setMode(value)}>{value === "insert" ? "顺序插入" : value === "replace" ? "替换区间" : "叠加区间"}</button>)}</div></fieldset>
            {range && <p className="range-callout">使用时间选区 · 起点 {(range.startUs / 1_000_000).toFixed(2)}s · 时长 {(range.durationUs / 1_000_000).toFixed(2)}s{mode === "insert" ? "（选区仅确定插入位置）" : ""}</p>}
            <label className="check-row"><input type="checkbox" checked={matchMaterials} onChange={(event) => setMatchMaterials(event.target.checked)} /><span>自动匹配已导入的视频素材（{assets.filter((asset) => asset.kind === "video" && !asset.missing).length}）</span></label>
            <label className="check-row"><input type="checkbox" checked={createVoice} disabled={!isDesktopRuntime()} onChange={(event) => setCreateVoice(event.target.checked)} /><span>同时生成系统配音</span></label>
            <p className="provider-summary">{settings.aiProvider.protocol} · {settings.aiProvider.model || "未配置模型"}</p>
            {usage.requests > 0 && <p className="usage-summary">本次会话 {usage.requests} 次 · {usage.inputTokens.toLocaleString()} 输入 / {usage.outputTokens.toLocaleString()} 输出 Token · 估算 ${usage.estimatedCostUsd.toFixed(4)}</p>}
            {error && <div className="error-callout" role="alert"><span>{error}</span>{error.includes("配置") || error.includes("API Key") ? <button type="button" onClick={onNeedSettings}>打开配置</button> : null}</div>}
            <div className="dialog-actions">{working ? <button className="button secondary" type="button" onClick={cancelGeneration}><Square size={13} fill="currentColor" />停止生成</button> : <Dialog.Close className="button secondary" type="button">取消</Dialog.Close>}<button className="button primary" type="submit" disabled={working}><Sparkles size={16} />{working ? "正在生成" : "生成片段"}</button></div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
