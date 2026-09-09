import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Clapperboard, LoaderCircle, Square, X } from "lucide-react";
import { Select } from "@/components/Select";
import type { MediaAsset } from "@/domain/project";
import type { MusicAnalysis } from "@/domain/musicBeats";
import { compileShotcraftSequence, type ShotcraftPlan } from "@/domain/shotcraftPlan";
import { shotcraftShot } from "@/domain/shotcraft";
import { generateShotcraftPlan } from "@/services/ai/shotcraft";
import { hasApiKey } from "@/services/ai/provider";
import { analyseMusicAsset } from "@/services/musicBeats";
import { loadShotcraftAudio, SHOTCRAFT_AUDIO } from "@/services/shotcraftAudio";
import type { PersistedSettings } from "@/services/storage";
import { useEditorStore } from "@/stores/editorStore";

interface Props { open: boolean; settings: PersistedSettings; onOpenChange: (open: boolean) => void; onNeedSettings: () => void }
export function ShotcraftPlannerDialog({ open, settings, onOpenChange, onNeedSettings }: Props) {
  const assets = useEditorStore((state) => state.project.assets);
  const playheadUs = useEditorStore((state) => state.playheadUs);
  const addSequence = useEditorStore((state) => state.addShotcraftSequence);
  const [brief, setBrief] = useState("");
  const [duration, setDuration] = useState(30);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [musicId, setMusicId] = useState("none");
  const [musicOffset, setMusicOffset] = useState(0);
  const [musicVolume, setMusicVolume] = useState(0.22);
  const [beatSync, setBeatSync] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [useVision, setUseVision] = useState(true);
  const [analysis, setAnalysis] = useState<MusicAnalysis>();
  const [plan, setPlan] = useState<ShotcraftPlan>();
  const [preparedAssets, setPreparedAssets] = useState<MediaAsset[]>([]);
  const [compiled, setCompiled] = useState<ReturnType<typeof compileShotcraftSequence>>();
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => { if (!open) { controller.current?.abort(); controller.current = null; setWorking(false); } }, [open]);
  useEffect(() => { setPlan(undefined); setCompiled(undefined); setPreparedAssets([]); setError(""); }, [brief, duration, selectedImages, musicId, musicOffset, beatSync, soundEnabled, useVision, assets]);
  useEffect(() => { setAnalysis(undefined); }, [musicId]);
  const images = assets.filter((asset) => asset.kind === "image" && !asset.missing);
  const musicOptions = [{ value: "none", label: "不使用音乐" }, ...assets.filter((asset) => asset.kind === "audio" && !asset.missing).map((asset) => ({ value: asset.id, label: asset.name })), ...SHOTCRAFT_AUDIO.filter((asset) => asset.kind === "music" && !assets.some((item) => item.id === asset.id)).map((asset) => ({ value: asset.id, label: asset.name }))];
  const options = { startUs: playheadUs, musicAssetId: musicId === "none" ? undefined : musicId, musicSourceInUs: Math.round(musicOffset * 1_000_000), musicVolume, beatSync: beatSync && musicId !== "none", analysis, soundEnabled };
  async function generate(event: React.FormEvent) {
    event.preventDefault();
    if (controller.current) return;
    const request = new AbortController(); controller.current = request;
    setWorking(true); setError(""); setPlan(undefined); setStatus("正在准备素材");
    try {
      if (!brief.trim()) throw new Error("请填写视频内容与镜头要求");
      if (!settings.aiProvider.model || !(await hasApiKey())) throw new Error("请先配置模型与 API Key");
      if (!Number.isFinite(duration) || duration < 3 || duration > 600 || !Number.isFinite(musicOffset) || musicOffset < 0) throw new Error("目标时长应为 3–600 秒，音乐起点不得为负数");
      const prepared: MediaAsset[] = [];
      const music = musicId === "none" ? undefined : assets.find((asset) => asset.id === musicId && !asset.missing) ?? await loadShotcraftAudio(musicId, request.signal);
      let measured = analysis;
      if (music) {
        prepared.push(music);
        if (music.durationUs - options.musicSourceInUs < duration * 1_000_000) throw new Error("音乐剩余长度不足，请降低目标时长或更换音乐");
        if (beatSync && !measured) { setStatus("正在本地分析音乐拍点与能量"); measured = await analyseMusicAsset(music, request.signal); request.signal.throwIfAborted(); setAnalysis(measured); }
      }
      const selected = images.filter((asset) => selectedImages.includes(asset.id));
      const result = await generateShotcraftPlan(settings.aiProvider, { brief: brief.trim(), durationSeconds: duration, assets: selected, analysis: music && beatSync ? measured : undefined, musicSourceInUs: options.musicSourceInUs, useVision, soundEnabled }, request.signal, (progress) => { if (mounted.current && !request.signal.aborted) setStatus(progress.message); });
      if (soundEnabled) {
        const soundIds = [...new Set(result.data.scenes.flatMap((scene) => scene.sounds.map((sound) => sound.soundId)))];
        for (const id of soundIds) { setStatus(`正在准备动作音效 ${prepared.length}/${soundIds.length}`); prepared.push(assets.find((asset) => asset.id === id && !asset.missing) ?? await loadShotcraftAudio(id, request.signal)); }
      }
      request.signal.throwIfAborted();
      const available = [...prepared, ...assets.filter((asset) => !prepared.some((item) => item.id === asset.id))];
      const resultPlan = compileShotcraftSequence(result.data, available, { ...options, analysis: measured }, () => crypto.randomUUID());
      setPreparedAssets(prepared); setCompiled(resultPlan); setPlan(result.data); setStatus("分镜已准备");
    } catch (exception) { if (mounted.current && controller.current === request) setError(request.signal.aborted ? "已停止编排" : exception instanceof Error ? exception.message : "镜头编排失败，请重试"); }
    finally { if (mounted.current && controller.current === request) { setWorking(false); controller.current = null; } }
  }
  function apply() {
    if (!plan) return;
    try { addSequence(plan, preparedAssets, options); onOpenChange(false); }
    catch (exception) { setError(exception instanceof Error ? exception.message : "加入时间线失败，请重新生成"); }
  }
  return <Dialog.Root open={open} onOpenChange={(next) => { if (!next) controller.current?.abort(); onOpenChange(next); }}><Dialog.Portal>
    <Dialog.Overlay className="dialog-overlay" />
    <Dialog.Content className="dialog-content shotcraft-planner" aria-describedby="shotcraft-planner-description">
      <Dialog.Close type="button" className="icon-button dialog-close" aria-label="关闭镜头编排"><X size={18} /></Dialog.Close>
      <Dialog.Title>AI 镜头编排</Dialog.Title>
      <Dialog.Description id="shotcraft-planner-description">选择素材和音乐，生成镜头、转场与动作音效。加入后可在时间线逐段编辑。</Dialog.Description>
      <form className="settings-form" onSubmit={generate}>
        <fieldset disabled={working}>
          <label><span>视频内容与镜头要求</span><textarea rows={3} value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="例如：用 30 秒展示产品，从标题开场到页面巡览，重点突出中央功能卡片" /></label>
          <div className="form-grid"><label><span>目标时长（秒）</span><input aria-label="镜头目标时长" type="number" min={3} max={600} value={duration} onChange={(event) => setDuration(event.target.valueAsNumber)} /></label><label><span>背景音乐</span><Select label="编排背景音乐" value={musicId} options={musicOptions} onChange={setMusicId} /></label></div>
          {musicId !== "none" && <div className="form-grid"><label><span>音乐源起点（秒）</span><input type="number" min={0} step={0.1} value={musicOffset} onChange={(event) => setMusicOffset(event.target.valueAsNumber)} /></label><label><span>音乐音量</span><input aria-label="编排音乐音量" type="range" min={0} max={0.6} step={0.01} value={musicVolume} onChange={(event) => setMusicVolume(event.target.valueAsNumber)} /></label></div>}
          <div className="shotcraft-planner-options"><label><input type="checkbox" checked={beatSync} disabled={musicId === "none"} onChange={(event) => setBeatSync(event.target.checked)} />音乐卡点</label><label><input type="checkbox" checked={soundEnabled} onChange={(event) => setSoundEnabled(event.target.checked)} />编排动作音效</label><label><input type="checkbox" checked={useVision} onChange={(event) => setUseVision(event.target.checked)} />让 AI 识别所选图片</label></div>
          <span>图片素材 · 最多 12 张</span>
          <div className="shotcraft-planner-assets">{images.length ? images.map((asset) => <label key={asset.id} title={asset.name}><input type="checkbox" checked={selectedImages.includes(asset.id)} disabled={!selectedImages.includes(asset.id) && selectedImages.length >= 12} onChange={(event) => setSelectedImages((ids) => event.target.checked ? [...ids, asset.id] : ids.filter((id) => id !== asset.id))} /><span>{asset.name}</span></label>) : <p>先导入图片可生成截图镜头，也可直接编排文字与图形。</p>}</div>
        </fieldset>
        {analysis && musicId !== "none" && beatSync && <p role="status">{analysis.bpm.toFixed(2)} BPM · {analysis.reliableGrid ? "节拍网格通过验证" : "网格不稳定，按实际鼓点编排"}</p>}
        {working && <p className="shotcraft-planner-status" role="status"><LoaderCircle className="spin" size={16} />{status}</p>}
        {error && <div className="error-callout" role="alert">{error}{error.includes("配置") && <button type="button" onClick={onNeedSettings}>打开模型配置</button>}</div>}
        {plan && compiled && <div className="shotcraft-plan-review"><strong>{plan.title} · {(compiled.durationUs / 1_000_000).toFixed(2)} 秒</strong><ol>{plan.scenes.map((scene, index) => <li key={index}><div><b>{shotcraftShot(scene.shotId)?.name}</b><span>{((compiled.tracks[0].clips[index]?.durationUs ?? 0) / 1_000_000).toFixed(2)} 秒</span></div><p>{scene.reason}</p></li>)}</ol>{compiled.warnings.length > 0 && <p role="status">{compiled.warnings.join("；")}</p>}</div>}
        <div className="dialog-actions"><span className="muted">起点 {(playheadUs / 1_000_000).toFixed(2)} 秒 · 加入新轨道</span>{working ? <button type="button" className="button secondary" onClick={() => controller.current?.abort()}><Square size={14} />停止</button> : <button type="submit" className="button secondary"><Clapperboard size={16} />{plan ? "重新编排" : "生成分镜"}</button>}<button type="button" className="button primary" disabled={working || !plan} onClick={apply}>加入时间线</button></div>
      </form>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
