import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AudioWaveform, Check, Cloud, Gauge, KeyRound, LoaderCircle, PlugZap, X } from "lucide-react";
import { browserApiKey, hasApiKey, providerEndpoint, saveApiKey, verifyProviderConfiguration, type AiProtocol } from "@/services/ai/provider";
import { Select } from "@/components/Select";
import { DEFAULT_SETTINGS, type PersistedSettings } from "@/services/storage";
import { getMediaToolStatus, type MediaToolStatus, type VideoEncoder } from "@/services/media";
import { isDesktopRuntime } from "@/services/runtime";
import { hasSpeechApiKey, MIMO_TTS_MODELS, MIMO_TTS_VOICES, saveSpeechApiKey, validateCloudSpeechTtsConfig, verifyCloudSpeech } from "@/services/cloudSpeech";

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

const protocolOptions = Object.entries(protocolLabels).map(([value, label]) => ({ value, label }));

const encoderOptions: { value: VideoEncoder | "auto" | "software"; label: string }[] = [
  { value: "auto", label: "自动选择" },
  { value: "software", label: "软件编码 (libx264)" }
];

const asrLanguageOptions = [
  { value: "auto", label: "自动检测" },
  { value: "zh", label: "中文与中文方言" },
  { value: "en", label: "英文" }
];

export function AiSettingsDialog({ open, settings, onOpenChange, onSave }: Props) {
  const [section, setSection] = useState<"provider" | "media" | "speech">("provider");
  const [draft, setDraft] = useState(settings.aiProvider);
  const [speechDraft, setSpeechDraft] = useState(settings.cloudSpeech ?? DEFAULT_SETTINGS.cloudSpeech);
  const [mediaDraft, setMediaDraft] = useState(settings.media ?? DEFAULT_SETTINGS.media);
  const [apiKey, setApiKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [speechApiKey, setSpeechApiKey] = useState("");
  const [speechKeySaved, setSpeechKeySaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [speechStatus, setSpeechStatus] = useState<string | null>(null);
  const [checkingSpeech, setCheckingSpeech] = useState(false);
  const [mediaStatus, setMediaStatus] = useState<MediaToolStatus | null>(null);
  const [providerModels, setProviderModels] = useState<string[]>([]);
  const [providerStatus, setProviderStatus] = useState<string | null>(null);
  const [checkingProvider, setCheckingProvider] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(settings.aiProvider);
    setSpeechDraft(settings.cloudSpeech ?? DEFAULT_SETTINGS.cloudSpeech);
    setMediaDraft(settings.media ?? DEFAULT_SETTINGS.media);
    setApiKey("");
    setSpeechApiKey("");
    setError("");
    setSpeechStatus(null);
    setProviderModels([]);
    setProviderStatus(null);
    setSection("provider");
    void hasApiKey().then(setKeySaved);
    void hasSpeechApiKey().then(setSpeechKeySaved);
    if (isDesktopRuntime()) void getMediaToolStatus().then(setMediaStatus).catch(() => setMediaStatus(null));
  }, [open, settings.aiProvider, settings.cloudSpeech, settings.media]);

  function changeProtocol(protocol: AiProtocol) {
    setProviderModels([]);
    setProviderStatus(null);
    setDraft((value) => ({
      ...value,
      protocol,
      baseUrl: protocol === "anthropic" ? "https://api.anthropic.com" : "https://api.openai.com"
    }));
  }

  async function checkSpeech() {
    setCheckingSpeech(true);
    setSpeechStatus(null);
    try {
      if (speechApiKey.trim()) {
        await saveSpeechApiKey(speechApiKey.trim());
        setSpeechKeySaved(true);
      } else if (!speechKeySaved) {
        throw new Error("请先填写云端语音 API Key");
      }
      setSpeechStatus(await verifyCloudSpeech(speechDraft, speechApiKey.trim()));
    } catch (exception) {
      setSpeechStatus(exception instanceof Error ? exception.message : "云端语音配置检查失败");
    } finally {
      setCheckingSpeech(false);
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
      validateCloudSpeechTtsConfig(speechDraft);
      if (apiKey.trim()) {
        await saveApiKey(apiKey);
        setKeySaved(true);
      }
      if (speechApiKey.trim()) {
        await saveSpeechApiKey(speechApiKey);
        setSpeechKeySaved(true);
      }
      if (draft.model.trim() && !keySaved && !apiKey.trim()) throw new Error("配置云端模型时必须填写 API Key");
      if (!speechKeySaved && !speechApiKey.trim()) throw new Error("配置云端语音时必须填写 API Key");
      await onSave({
        ...settings,
        aiProvider: { ...draft, baseUrl: draft.baseUrl.trim(), model: draft.model.trim() },
        cloudSpeech: {
          ...speechDraft,
          baseUrl: speechDraft.baseUrl.trim(),
          ttsModel: speechDraft.ttsModel.trim(),
          ttsVoice: speechDraft.ttsVoice.trim(),
          ttsStyle: speechDraft.ttsStyle.trim(),
          asrModel: speechDraft.asrModel.trim()
        },
        media: mediaDraft
      });
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
          <div className="settings-dialog-header">
            <span className="eyebrow">PREFERENCES</span>
            <Dialog.Title>客户端设置</Dialog.Title>
            <Dialog.Description id="ai-settings-description">文案模型、云端语音与媒体能力统一在当前客户端配置。</Dialog.Description>
          </div>
          <form className="settings-form" onSubmit={submit}>
            <div className="settings-layout">
              <nav className="settings-nav" aria-label="设置分组">
                <button type="button" className={section === "provider" ? "active" : ""} onClick={() => setSection("provider")}><Cloud size={17} /><span><strong>云端模型</strong><small>协议、模型与凭证</small></span></button>
                <button type="button" className={section === "speech" ? "active" : ""} onClick={() => setSection("speech")}><AudioWaveform size={17} /><span><strong>云端语音</strong><small>MiMo TTS 与 ASR</small></span></button>
                <button type="button" className={section === "media" ? "active" : ""} onClick={() => setSection("media")}><Gauge size={17} /><span><strong>媒体与导出</strong><small>FFmpeg 与代理</small></span></button>
              </nav>
              <section className="settings-pane">
                {section === "provider" && <div className="settings-section-panel">
                  <div className="settings-pane-heading"><h3>云端大模型</h3><p>兼容 OpenAI 与 Anthropic 协议，API Key 保存在应用数据目录的凭证文件中。</p></div>
                  <label><span>协议</span><Select label="协议" value={draft.protocol} onChange={(value) => changeProtocol(value as AiProtocol)} options={protocolOptions} /></label>
                  <label><span>Base URL</span><input value={draft.baseUrl} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} placeholder="https://api.openai.com 或 https://opencode.ai/zen/v1" /><small>请求端点：{draft.baseUrl.trim() ? providerEndpoint(draft) : "-"}</small></label>
                  <label><span>模型</span><input list="provider-model-options" value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} placeholder="选择或手动输入模型 ID" /><datalist id="provider-model-options">{providerModels.map((model) => <option key={model} value={model} />)}</datalist></label>
                  <label><span>API Key</span><div className="secret-input"><KeyRound size={15} /><input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={keySaved ? "已保存在本地凭证目录，留空则不修改" : "输入 API Key"} /></div></label>
                  {keySaved && <p className="success-text"><Check size={14} />已保存凭证</p>}
                  <div className="inline-check"><button className="button secondary" type="button" disabled={checkingProvider} onClick={() => void checkProvider()}>{checkingProvider ? <LoaderCircle className="spin" size={14} /> : <PlugZap size={14} />}{checkingProvider ? "检测中" : "检测模型配置"}</button>{providerStatus && <small>{providerStatus}</small>}</div>
                  <div className="form-grid"><label><span>输入价格（美元/百万 Token）</span><input type="number" min={0} step="0.01" value={draft.inputCostPerMillion} onChange={(event) => setDraft({ ...draft, inputCostPerMillion: Math.max(0, Number(event.target.value)) })} /></label><label><span>输出价格（美元/百万 Token）</span><input type="number" min={0} step="0.01" value={draft.outputCostPerMillion} onChange={(event) => setDraft({ ...draft, outputCostPerMillion: Math.max(0, Number(event.target.value)) })} /></label></div>
                </div>}
                {section === "media" && <div className="settings-section-panel">
                  <div className="settings-pane-heading"><h3>媒体与导出</h3><p>{mediaStatus?.ready ? `${mediaStatus.bundled ? "内置" : "系统"} FFmpeg · 推荐 ${mediaStatus.recommendedEncoder}` : mediaStatus?.message ?? "桌面客户端中检测媒体引擎"}</p></div>
                  <label><span>视频编码器</span><Select label="视频编码器" value={mediaDraft.encoder} onChange={(value) => setMediaDraft({ ...mediaDraft, encoder: value as typeof mediaDraft.encoder })} options={[...encoderOptions, ...(["videotoolbox", "nvenc", "qsv"] as VideoEncoder[]).filter((encoder) => mediaStatus?.availableEncoders.includes(encoder) || mediaDraft.encoder === encoder).map((encoder) => ({ value: encoder, label: encoder === "videotoolbox" ? "Apple VideoToolbox" : encoder === "nvenc" ? "NVIDIA NVENC" : "Intel Quick Sync" }))]} /></label>
                  <div className="form-grid"><label className="check-row"><input type="checkbox" checked={mediaDraft.proxyEnabled} onChange={(event) => setMediaDraft({ ...mediaDraft, proxyEnabled: event.target.checked })} /><span>自动生成代理媒体</span></label><label><span>代理分辨率</span><Select label="代理分辨率" value={String(mediaDraft.proxyHeight)} disabled={!mediaDraft.proxyEnabled} onChange={(value) => setMediaDraft({ ...mediaDraft, proxyHeight: Number(value) as 540 | 720 })} options={[{ value: "540", label: "540p" }, { value: "720", label: "720p" }]} /></label></div>
                </div>}
                {section === "speech" && <div className="settings-section-panel">
                  <div className="settings-pane-heading"><h3>MiMo 云端语音</h3><p>TTS 与 ASR 共用一把独立凭证；保存在应用数据目录，不写入工程文件。</p></div>
                  <label><span>Base URL</span><input value={speechDraft.baseUrl} onChange={(event) => setSpeechDraft({ ...speechDraft, baseUrl: event.target.value })} placeholder="https://api.xiaomimimo.com/v1" /></label>
                  <div className="form-grid"><label><span>TTS 模型</span><Select label="TTS 模型" value={speechDraft.ttsModel} onChange={(value) => setSpeechDraft({ ...speechDraft, ttsModel: value })} options={[...MIMO_TTS_MODELS]} /></label><label><span>预置音色</span><Select label="预置音色" value={speechDraft.ttsVoice} disabled={speechDraft.ttsModel === "mimo-v2.5-tts-voicedesign"} onChange={(value) => setSpeechDraft({ ...speechDraft, ttsVoice: value })} options={[...MIMO_TTS_VOICES]} /></label></div>
                  <label><span>{speechDraft.ttsModel === "mimo-v2.5-tts-voicedesign" ? "音色设计描述" : "发音风格指令"}</span><textarea rows={4} value={speechDraft.ttsStyle} onChange={(event) => setSpeechDraft({ ...speechDraft, ttsStyle: event.target.value })} placeholder="自然、清晰、适合知识讲解，语速适中" /></label>
                  <div className="form-grid"><label><span>ASR 模型</span><input value={speechDraft.asrModel} onChange={(event) => setSpeechDraft({ ...speechDraft, asrModel: event.target.value })} placeholder="mimo-v2.5-asr" /></label><label><span>识别语言</span><Select label="识别语言" value={speechDraft.asrLanguage} onChange={(value) => setSpeechDraft({ ...speechDraft, asrLanguage: value as typeof speechDraft.asrLanguage })} options={asrLanguageOptions} /></label></div>
                  <label><span>语音 API Key</span><div className="secret-input"><KeyRound size={15} /><input type="password" autoComplete="off" value={speechApiKey} onChange={(event) => setSpeechApiKey(event.target.value)} placeholder={speechKeySaved ? "已保存在本地凭证目录，留空则不修改" : "输入 MiMo API Key"} /></div></label>
                  {speechKeySaved && <p className="success-text"><Check size={14} />TTS 与 ASR 凭证已保存</p>}
                  <div className="inline-check"><button className="button secondary" type="button" disabled={checkingSpeech} onClick={() => void checkSpeech()}>{checkingSpeech ? <LoaderCircle className="spin" size={14} /> : <PlugZap size={14} />}{checkingSpeech ? "检测中" : "检测云端语音"}</button>{speechStatus && <small>{speechStatus}</small>}</div>
                </div>}
              </section>
            </div>
            <div className="settings-footer">{error ? <p className="error-text" role="alert">{error}</p> : <span />}<div className="dialog-actions"><Dialog.Close className="button secondary" type="button">取消</Dialog.Close><button className="button primary" type="submit" disabled={saving}>{saving ? "保存中" : "保存配置"}</button></div></div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
