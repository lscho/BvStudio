import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Cpu, Gauge, KeyRound, LoaderCircle, PlugZap, X } from "lucide-react";
import { browserApiKey, hasApiKey, MAX_MODEL_OUTPUT_TOKENS, providerEndpoint, saveApiKey, verifyProviderConfiguration, type AiProtocol } from "@/services/ai/provider";
import { DEFAULT_SETTINGS, type PersistedSettings } from "@/services/storage";
import { getAsrRuntimeStatus } from "@/services/asr";
import { AsrModelManager } from "@/components/AsrModelManager";
import { getMediaToolStatus, type MediaToolStatus, type VideoEncoder } from "@/services/media";
import { isDesktopRuntime } from "@/services/runtime";

interface Props {
  open: boolean;
  settings: PersistedSettings;
  onOpenChange: (open: boolean) => void;
  onSave: (settings: PersistedSettings) => Promise<void>;
}

const protocolLabels: Record<AiProtocol, string> = {
  "openai-responses": "OpenAI Responses",
  "openai-chat": "OpenAI Chat Completions",
  anthropic: "Anthropic Messages"
};

export function AiSettingsDialog({ open, settings, onOpenChange, onSave }: Props) {
  const [draft, setDraft] = useState(settings.aiProvider);
  const [asrDraft, setAsrDraft] = useState(settings.localAsr ?? DEFAULT_SETTINGS.localAsr);
  const [mediaDraft, setMediaDraft] = useState(settings.media ?? DEFAULT_SETTINGS.media);
  const [apiKey, setApiKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [asrStatus, setAsrStatus] = useState<string | null>(null);
  const [checkingAsr, setCheckingAsr] = useState(false);
  const [mediaStatus, setMediaStatus] = useState<MediaToolStatus | null>(null);
  const [providerModels, setProviderModels] = useState<string[]>([]);
  const [providerStatus, setProviderStatus] = useState<string | null>(null);
  const [checkingProvider, setCheckingProvider] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(settings.aiProvider);
    setAsrDraft(settings.localAsr ?? DEFAULT_SETTINGS.localAsr);
    setMediaDraft(settings.media ?? DEFAULT_SETTINGS.media);
    setApiKey("");
    setError("");
    setAsrStatus(null);
    setProviderModels([]);
    setProviderStatus(null);
    void hasApiKey().then(setKeySaved);
    if (isDesktopRuntime()) void getMediaToolStatus().then(setMediaStatus).catch(() => setMediaStatus(null));
  }, [open, settings.aiProvider, settings.localAsr, settings.media]);

  function changeProtocol(protocol: AiProtocol) {
    setProviderModels([]);
    setProviderStatus(null);
    setDraft((value) => ({
      ...value,
      protocol,
      baseUrl: protocol === "anthropic" ? "https://api.anthropic.com" : "https://api.openai.com"
    }));
  }

  async function checkAsr() {
    setCheckingAsr(true);
    try {
      const status = await getAsrRuntimeStatus(asrDraft.pythonPath.trim() || "python3");
      setAsrStatus(status.message);
    } catch (exception) {
      setAsrStatus(exception instanceof Error ? exception.message : "本地环境检查失败");
    } finally {
      setCheckingAsr(false);
    }
  }

  async function checkProvider() {
    if (!draft.baseUrl.trim()) {
      setError("请先填写 Base URL");
      return;
    }
    setCheckingProvider(true);
    setProviderStatus(null);
    setError("");
    try {
      if (apiKey.trim()) {
        await saveApiKey(apiKey.trim());
        setKeySaved(true);
      } else if (!keySaved) {
        throw new Error("请先填写 API Key");
      }
      const result = await verifyProviderConfiguration(draft, isDesktopRuntime() ? undefined : apiKey.trim() || browserApiKey());
      setProviderModels(result.models);
      setProviderStatus(result.message);
      if (!draft.model.trim() && result.models.length === 1) setDraft((value) => ({ ...value, model: result.models[0] }));
    } catch (exception) {
      setProviderStatus(exception instanceof Error ? exception.message : String(exception));
    } finally {
      setCheckingProvider(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (draft.model.trim() && !draft.baseUrl.trim()) {
      setError("配置云端模型时必须填写 Base URL");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (apiKey.trim()) {
        await saveApiKey(apiKey);
        setKeySaved(true);
      }
      if (draft.model.trim() && !keySaved && !apiKey.trim()) throw new Error("配置云端模型时必须填写 API Key");
      await onSave({ ...settings, aiProvider: { ...draft, baseUrl: draft.baseUrl.trim(), model: draft.model.trim() }, localAsr: { ...asrDraft, pythonPath: asrDraft.pythonPath.trim(), modelPath: asrDraft.modelPath.trim(), alignerPath: asrDraft.alignerPath.trim(), language: asrDraft.language.trim() }, media: mediaDraft });
      onOpenChange(false);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : String(exception || "保存失败"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content settings-dialog" aria-describedby="ai-settings-description">
          <Dialog.Close className="icon-button dialog-close" aria-label="关闭"><X size={18} /></Dialog.Close>
          <span className="eyebrow">MODEL PROVIDER</span>
          <Dialog.Title>云端大模型</Dialog.Title>
          <Dialog.Description id="ai-settings-description">配置保存在当前客户端，API Key 在桌面端写入系统钥匙串。</Dialog.Description>
          <form className="settings-form" onSubmit={submit}>
            <label><span>协议</span><select value={draft.protocol} onChange={(event) => changeProtocol(event.target.value as AiProtocol)}>{Object.entries(protocolLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>Base URL</span><input value={draft.baseUrl} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} placeholder="https://api.openai.com 或 https://opencode.ai/zen/v1" /><small>请求端点：{draft.baseUrl.trim() ? providerEndpoint(draft) : "-"}</small></label>
            <label><span>模型</span><input list="provider-model-options" value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} placeholder="选择或手动输入模型 ID" /><datalist id="provider-model-options">{providerModels.map((model) => <option key={model} value={model} />)}</datalist></label>
            <label><span>最大输出 Token</span><input type="number" min={1} max={MAX_MODEL_OUTPUT_TOKENS} step={256} value={draft.maxTokens} onChange={(event) => setDraft({ ...draft, maxTokens: Number(event.target.value) })} /><small>这是单次输出上限，不是上下文长度；客户端允许最高 1,000,000，服务端仍会按模型能力限制。</small></label>
            <label><span>API Key</span><div className="secret-input"><KeyRound size={15} /><input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={keySaved ? "已保存在系统钥匙串，留空则不修改" : "输入 API Key"} /></div></label>
            {keySaved && <p className="success-text"><Check size={14} />已保存凭证</p>}
            <div className="inline-check"><button className="button secondary" type="button" disabled={checkingProvider} onClick={() => void checkProvider()}>{checkingProvider ? <LoaderCircle className="spin" size={14} /> : <PlugZap size={14} />}{checkingProvider ? "检测中" : "检测模型配置"}</button>{providerStatus && <small>{providerStatus}</small>}</div>
            <div className="form-grid"><label><span>输入价格（美元/百万 Token）</span><input type="number" min={0} step="0.01" value={draft.inputCostPerMillion} onChange={(event) => setDraft({ ...draft, inputCostPerMillion: Math.max(0, Number(event.target.value)) })} /></label><label><span>输出价格（美元/百万 Token）</span><input type="number" min={0} step="0.01" value={draft.outputCostPerMillion} onChange={(event) => setDraft({ ...draft, outputCostPerMillion: Math.max(0, Number(event.target.value)) })} /></label></div>
            <div className="settings-section-title"><Gauge size={15} /><span><strong>媒体与导出</strong><small>{mediaStatus?.ready ? `${mediaStatus.bundled ? "内置" : "系统"} FFmpeg · 推荐 ${mediaStatus.recommendedEncoder}` : mediaStatus?.message ?? "桌面客户端中检测媒体引擎"}</small></span></div>
            <label><span>视频编码器</span><select value={mediaDraft.encoder} onChange={(event) => setMediaDraft({ ...mediaDraft, encoder: event.target.value as typeof mediaDraft.encoder })}><option value="auto">自动选择</option><option value="software">软件编码 (libx264)</option>{(["videotoolbox", "nvenc", "qsv"] as VideoEncoder[]).filter((encoder) => mediaStatus?.availableEncoders.includes(encoder) || mediaDraft.encoder === encoder).map((encoder) => <option key={encoder} value={encoder}>{encoder === "videotoolbox" ? "Apple VideoToolbox" : encoder === "nvenc" ? "NVIDIA NVENC" : "Intel Quick Sync"}</option>)}</select></label>
            <div className="form-grid"><label className="check-row"><input type="checkbox" checked={mediaDraft.proxyEnabled} onChange={(event) => setMediaDraft({ ...mediaDraft, proxyEnabled: event.target.checked })} /><span>自动生成代理媒体</span></label><label><span>代理分辨率</span><select value={mediaDraft.proxyHeight} disabled={!mediaDraft.proxyEnabled} onChange={(event) => setMediaDraft({ ...mediaDraft, proxyHeight: Number(event.target.value) as 540 | 720 })}><option value={540}>540p</option><option value={720}>720p</option></select></label></div>
            <div className="settings-section-title"><Cpu size={15} /><span><strong>本地字幕模型</strong><small>Qwen3-ASR 在本机运行，音视频不会上传。</small></span></div>
            <label><span>Python 可执行文件</span><input value={asrDraft.pythonPath} onChange={(event) => setAsrDraft({ ...asrDraft, pythonPath: event.target.value })} placeholder="python3 或虚拟环境中的 python" /></label>
            <label><span>Qwen3-ASR 模型目录</span><input value={asrDraft.modelPath} onChange={(event) => setAsrDraft({ ...asrDraft, modelPath: event.target.value })} placeholder="本地 Qwen3-ASR-0.6B 目录" /></label>
            <label><span>Forced Aligner 目录（可选）</span><input value={asrDraft.alignerPath} onChange={(event) => setAsrDraft({ ...asrDraft, alignerPath: event.target.value })} placeholder="配置后生成词级时间戳" /></label>
            <div className="form-grid"><label><span>语言</span><input value={asrDraft.language} onChange={(event) => setAsrDraft({ ...asrDraft, language: event.target.value })} placeholder="Chinese；留空自动识别" /></label><label><span>计算设备</span><select value={asrDraft.device} onChange={(event) => setAsrDraft({ ...asrDraft, device: event.target.value as typeof asrDraft.device })}><option value="auto">自动</option><option value="mps">Apple GPU (MPS)</option><option value="cuda:0">NVIDIA GPU</option><option value="cpu">CPU</option></select></label></div>
            <AsrModelManager pythonPath={asrDraft.pythonPath} modelPath={asrDraft.modelPath} alignerPath={asrDraft.alignerPath} onChange={(patch) => setAsrDraft((value) => ({ ...value, ...patch }))} />
            <div className="inline-check"><button className="button secondary" type="button" disabled={checkingAsr} onClick={() => void checkAsr()}>{checkingAsr ? "检查中" : "检查本地环境"}</button>{asrStatus && <small>{asrStatus}</small>}</div>
            {error && <p className="error-text" role="alert">{error}</p>}
            <div className="dialog-actions"><Dialog.Close className="button secondary" type="button">取消</Dialog.Close><button className="button primary" type="submit" disabled={saving}>{saving ? "保存中" : "保存配置"}</button></div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
