import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AudioLines, Clapperboard, LoaderCircle, Square, X } from "lucide-react";
import { Select } from "@/components/Select";
import { compositionById } from "@/domain/effects";
import type { MusicAnalysis } from "@/domain/musicBeats";
import type { MediaAsset } from "@/domain/project";
import { parseStoryboardCues, type StoryboardOptions } from "@/domain/storyboard";
import { analyseMusicAsset } from "@/services/musicBeats";
import { canUseShotcraftAudio, loadShotcraftAudio, shotcraftAudioForAccess } from "@/services/shotcraftAudio";
import type { AiMotionMatch, AiMotionSelection, AiTimedScript } from "@/services/ai/schema";

export interface SubtitleStoryboardRequest {
  storyboard: StoryboardOptions;
  materialAssetIds: string[];
  useVision: boolean;
  soundEnabled: boolean;
  musicAssetId?: string;
  musicSourceInUs: number;
  musicVolume: number;
  beatSync: boolean;
  analysis?: MusicAnalysis;
}

export interface SubtitleStoryboardPreview {
  subtitleIds: string[];
  captions: AiTimedScript["captions"];
  selection: AiMotionSelection;
  matches: AiMotionMatch[];
  preparedAssets: MediaAsset[];
  projectUpdatedAt: string;
}

interface Props {
  open: boolean;
  assets: readonly MediaAsset[];
  onOpenChange: (open: boolean) => void;
  onGenerate: (request: SubtitleStoryboardRequest, signal: AbortSignal, onProgress: (message: string) => void) => Promise<SubtitleStoryboardPreview>;
  onApply: (preview: SubtitleStoryboardPreview, request: SubtitleStoryboardRequest) => void;
  onNeedSettings: () => void;
  subtitleCount: number;
  durationSeconds: number;
  isPro?: boolean;
}

export function SubtitleStoryboardDialog({ open, assets, onOpenChange, onGenerate, onApply, onNeedSettings, subtitleCount, durationSeconds, isPro = false }: Props) {
  const [mode, setMode] = useState<StoryboardOptions["mode"]>("auto");
  const [prompt, setPrompt] = useState("");
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [musicId, setMusicId] = useState("none");
  const [musicOffset, setMusicOffset] = useState(0);
  const [musicVolume, setMusicVolume] = useState(0.22);
  const [beatSync, setBeatSync] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [useVision, setUseVision] = useState(true);
  const [analysis, setAnalysis] = useState<MusicAnalysis>();
  const [preview, setPreview] = useState<SubtitleStoryboardPreview>();
  const [previewRequest, setPreviewRequest] = useState<SubtitleStoryboardRequest>();
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const visualAssets = assets.filter((asset) => (asset.kind === "image" || asset.kind === "video") && !asset.missing);
  const selectedImageCount = visualAssets.filter((asset) => asset.kind === "image" && selectedAssets.includes(asset.id)).length;
  const musicOptions = [{ value: "none", label: "不使用音乐" }, ...assets.filter((asset) => asset.kind === "audio" && !asset.missing && (!asset.id.startsWith("shotcraft-audio:") || canUseShotcraftAudio(asset.id, isPro))).map((asset) => ({ value: asset.id, label: asset.name })), ...shotcraftAudioForAccess(isPro).filter((asset) => asset.kind === "music" && !assets.some((item) => item.id === asset.id)).map((asset) => ({ value: asset.id, label: asset.name }))];

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => {
    if (!open) {
      controller.current?.abort();
      controller.current = null;
      setWorking(false);
      setPreview(undefined);
      setPreviewRequest(undefined);
      setStatus("");
      setError("");
      return;
    }
    setSelectedAssets((current) => current.length
      ? current.filter((id) => visualAssets.some((asset) => asset.id === id))
      : visualAssets.filter((asset, index, all) => asset.kind !== "image" || all.slice(0, index).filter((candidate) => candidate.kind === "image").length < 12).slice(0, 24).map((asset) => asset.id));
  }, [open, assets]);
  useEffect(() => { setAnalysis(undefined); }, [musicId]);
  useEffect(() => { setPreview(undefined); setPreviewRequest(undefined); setError(""); }, [mode, prompt, selectedAssets, musicId, musicOffset, musicVolume, beatSync, soundEnabled, useVision, isPro]);

  async function selectedMusic(signal: AbortSignal) {
    if (musicId === "none") return undefined;
    if (musicId.startsWith("shotcraft-audio:") && !canUseShotcraftAudio(musicId, isPro)) throw new Error("当前会员无权使用所选音乐，请更换音乐或升级 Pro");
    return assets.find((asset) => asset.id === musicId && asset.kind === "audio" && !asset.missing) ?? loadShotcraftAudio(musicId, signal);
  }

  async function analyse() {
    if (controller.current || musicId === "none") return;
    const request = new AbortController(); controller.current = request;
    setWorking(true); setError(""); setStatus("正在本地分析音乐拍点与能量");
    try {
      const music = await selectedMusic(request.signal);
      if (!music) throw new Error("请选择背景音乐");
      const measured = await analyseMusicAsset(music, request.signal);
      request.signal.throwIfAborted();
      if (mounted.current && controller.current === request) setAnalysis(measured);
    } catch (exception) {
      if (mounted.current && controller.current === request) setError(request.signal.aborted ? "已停止分析" : exception instanceof Error ? exception.message : "音乐分析失败，请重试");
    } finally {
      if (mounted.current && controller.current === request) { setWorking(false); controller.current = null; }
    }
  }

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    if (controller.current) return;
    const active = new AbortController(); controller.current = active;
    setWorking(true); setError(""); setPreview(undefined); setStatus("正在检查字幕与素材");
    try {
      const cues = parseStoryboardCues(prompt, durationSeconds);
      if (mode !== "auto" && cues.some((cue) => cue.role !== mode)) throw new Error("时间要求与纯模式冲突，请调整模式或要求");
      if (!Number.isFinite(musicOffset) || musicOffset < 0 || !Number.isFinite(musicVolume) || musicVolume < 0 || musicVolume > 1) throw new Error("音乐起点或音量无效");
      if (useVision && selectedImageCount > 12) throw new Error("图片识别最多选择 12 张图片");
      const music = await selectedMusic(active.signal);
      let measured = analysis;
      if (music && beatSync && !measured) {
        setStatus("正在本地分析音乐拍点与能量");
        measured = await analyseMusicAsset(music, active.signal);
        active.signal.throwIfAborted();
        if (mounted.current) setAnalysis(measured);
      }
      const request: SubtitleStoryboardRequest = { storyboard: { mode, prompt: prompt.trim() }, materialAssetIds: selectedAssets, useVision, soundEnabled, musicAssetId: music?.id, musicSourceInUs: Math.round(musicOffset * 1_000_000), musicVolume, beatSync: Boolean(music && beatSync), analysis: measured };
      const result = await onGenerate(request, active.signal, setStatus);
      active.signal.throwIfAborted();
      if (mounted.current && controller.current === active) { setPreview(result); setPreviewRequest(request); setStatus("整套分镜已准备"); }
    } catch (exception) {
      if (mounted.current && controller.current === active) setError(active.signal.aborted ? "已停止编排" : exception instanceof Error ? exception.message : "镜头编排失败，请重试");
    } finally {
      if (mounted.current && controller.current === active) { setWorking(false); controller.current = null; }
    }
  }

  function apply() {
    if (!preview || !previewRequest) return;
    try { onApply(preview, previewRequest); onOpenChange(false); }
    catch (exception) { setError(exception instanceof Error ? exception.message : "应用整套编排失败，请重新生成"); }
  }

  return <Dialog.Root open={open} onOpenChange={(next) => { if (!next) controller.current?.abort(); onOpenChange(next); }}><Dialog.Portal>
    <Dialog.Overlay className="dialog-overlay" />
    <Dialog.Content className="dialog-content shotcraft-planner" aria-describedby="subtitle-storyboard-description">
      <Dialog.Close type="button" className="icon-button dialog-close" aria-label="关闭 AI 视频编排"><X size={18} /></Dialog.Close>
      <Dialog.Title>AI 视频编排</Dialog.Title>
      <Dialog.Description id="subtitle-storyboard-description">用同一份字幕语义统一生成 A-roll / B-roll、动效、转场、音乐卡点与动作音效。</Dialog.Description>
      <form className="settings-form" onSubmit={generate}>
        <fieldset disabled={working}>
          <label><span>画面模式</span><Select label="分镜画面模式" value={mode} options={[{ value: "auto", label: "自动混合 A-roll / B-roll" }, { value: "a-roll", label: "纯 A-roll · 口播为主" }, { value: "b-roll", label: "纯 B-roll · 补充画面" }]} onChange={(value) => { if (value === "auto" || value === "a-roll" || value === "b-roll") setMode(value); }} /></label>
          <label><span>分镜要求</span><textarea aria-label="分镜要求" rows={4} maxLength={4000} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="例如：0-5秒 A-roll 保留口播；5-12秒 B-roll 用产品截图解释痛点。" /></label>
          <div className="form-grid"><label><span>背景音乐</span><Select label="编排背景音乐" value={musicId} options={musicOptions} onChange={setMusicId} /></label><label><span>音乐源起点（秒）</span><input aria-label="音乐源起点" type="number" min={0} step={0.1} disabled={musicId === "none"} value={musicOffset} onChange={(event) => setMusicOffset(event.target.valueAsNumber)} /></label></div>
          {musicId !== "none" && <label><span>音乐音量</span><input aria-label="编排音乐音量" type="range" min={0} max={0.6} step={0.01} value={musicVolume} onChange={(event) => setMusicVolume(event.target.valueAsNumber)} /></label>}
          <div className="shotcraft-planner-options"><label><input type="checkbox" checked={beatSync} disabled={musicId === "none"} onChange={(event) => setBeatSync(event.target.checked)} />音乐卡点</label><label><input type="checkbox" checked={soundEnabled} onChange={(event) => setSoundEnabled(event.target.checked)} />编排动作音效</label><label><input type="checkbox" checked={useVision} disabled={!visualAssets.some((asset) => asset.kind === "image")} onChange={(event) => setUseVision(event.target.checked)} />识别所选图片</label></div>
          <span>参与匹配的素材</span>
          <div className="shotcraft-planner-assets">{visualAssets.length ? visualAssets.map((asset) => <label key={asset.id} title={asset.name}><input type="checkbox" checked={selectedAssets.includes(asset.id)} disabled={!selectedAssets.includes(asset.id) && (selectedAssets.length >= 24 || (useVision && asset.kind === "image" && selectedImageCount >= 12))} onChange={(event) => setSelectedAssets((ids) => event.target.checked ? [...ids, asset.id] : ids.filter((id) => id !== asset.id))} /><span>{asset.kind === "image" ? "图片" : "视频"} · {asset.name}</span></label>) : <p>没有可用图片或视频，将使用文字与图形镜头。</p>}</div>
        </fieldset>
        {musicId !== "none" && <button type="button" className="button secondary" disabled={working} onClick={analyse}><AudioLines size={16} />分析拍点</button>}
        {analysis && musicId !== "none" && <p role="status">{analysis.bpm.toFixed(2)} BPM · {analysis.reliableGrid ? "节拍网格通过验证" : "网格不稳定，按实际鼓点编排"} · {analysis.hits.length} 个瞬态</p>}
        {working && <p className="shotcraft-planner-status" role="status"><LoaderCircle className="spin" size={16} />{status}</p>}
        {error && <div className="error-callout" role="alert">{error}{error.includes("配置") && <button type="button" onClick={onNeedSettings}>打开模型配置</button>}</div>}
        {!subtitleCount && <p role="status">请先识别或导入字幕；选中部分字幕可只编排所选段落。</p>}
        {preview && <div className="shotcraft-plan-review"><strong>{preview.selection.segments.length} 个语义段 · {preview.matches.length} 个镜头动作</strong><ol>{preview.selection.segments.map((segment) => { const start = preview.captions[segment.startCaptionIndex]?.startSeconds ?? 0; const end = preview.captions[segment.endCaptionIndex]?.endSeconds ?? start; const match = preview.matches.find((candidate) => candidate.captionIndex >= segment.startCaptionIndex && candidate.captionIndex <= segment.endCaptionIndex && (candidate.primaryEffectId || candidate.videoLayers.length)); return <li key={segment.segmentId}><div><b>{segment.roll === "a-roll" ? "A-roll" : "B-roll"} · {segment.title}</b><span>{start.toFixed(1)}–{end.toFixed(1)} 秒</span></div><p>{match?.primaryEffectId ? compositionById(match.primaryEffectId).name : match?.videoLayers.length ? "素材镜头" : "保留原画面"}{match?.soundEffectId || match?.shotcraftSounds?.length ? " · 含动作音效" : ""}</p></li>; })}</ol></div>}
        <div className="dialog-actions"><span className="muted">{subtitleCount} 条字幕 · 先预览再应用</span>{working ? <button type="button" className="button secondary" onClick={() => controller.current?.abort()}><Square size={14} />停止</button> : <button type="submit" className="button secondary" disabled={!subtitleCount}><Clapperboard size={16} />{preview ? "重新编排" : "生成整套分镜"}</button>}<button type="button" className="button primary" disabled={working || !preview} onClick={apply}>应用整套编排</button></div>
      </form>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
