import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Play, Plus, Search, Square } from "lucide-react";
import { Select } from "@/components/Select";
import { loadShotcraftAudio, previewShotcraftAudio, SHOTCRAFT_AUDIO, stopShotcraftAudioPreview } from "@/services/shotcraftAudio";
import { useEditorStore } from "@/stores/editorStore";

const categories: Record<string, string> = { bgm: "音乐", transition: "转场", impact: "冲击", riser: "渐强", camera: "相机", ui: "交互", text: "文字", paper: "纸张", film: "胶片", light: "光效", data: "数据", scifi: "科幻", mech: "机械", glass: "玻璃", fluid: "流体", crowd: "人群", counter: "计数" };
export function ShotcraftAudioLibrary() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState<string>();
  const request = useRef<AbortController | null>(null);
  const addAudio = useEditorStore((state) => state.addAudio);
  useEffect(() => () => { request.current?.abort(); request.current = null; stopShotcraftAudioPreview(); }, []);
  const sounds = SHOTCRAFT_AUDIO.filter((item) => (category === "all" || item.category === category) && `${item.name} ${categories[item.category]}`.toLowerCase().includes(query.toLowerCase()));
  async function run(id: string, mode: "preview" | "add") {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(id); setError("");
    try {
      if (mode === "preview") { setPlaying(undefined); await previewShotcraftAudio(id, controller.signal, () => setPlaying(undefined)); controller.signal.throwIfAborted(); setPlaying(id); }
      else { const asset = await loadShotcraftAudio(id, controller.signal); controller.signal.throwIfAborted(); addAudio(asset, SHOTCRAFT_AUDIO.find((item) => item.id === id)?.kind === "music" ? "music" : "sound"); }
    } catch (exception) { if (!controller.signal.aborted) setError(exception instanceof Error ? exception.message : "音频读取失败，请重试"); }
    finally { if (request.current === controller) { setBusy(undefined); request.current = null; } }
  }
  return <section className="sound-group shotcraft-audio-library" aria-label="Shotcraft 音频库">
    <h3>Shotcraft · {SHOTCRAFT_AUDIO.length}</h3>
    <label className="effect-search"><Search size={14} /><input type="search" aria-label="搜索 Shotcraft 音频" placeholder="搜索音频" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    <Select label="Shotcraft 音频分类" value={category} onChange={setCategory} options={[{ value: "all", label: "全部分类" }, ...Object.entries(categories).map(([value, label]) => ({ value, label }))]} />
    {error && <p role="alert" className="composition-validation">{error}</p>}
    {sounds.map((sound) => <div className="sound-row" key={sound.id}>
      <button type="button" aria-label={`试听 ${sound.name}`} title={playing === sound.id ? "停止试听" : "试听"} disabled={Boolean(busy)} onClick={() => { if (playing === sound.id) { stopShotcraftAudioPreview(); setPlaying(undefined); } else void run(sound.id, "preview"); }}>{busy === sound.id ? <LoaderCircle size={13} className="spin" /> : playing === sound.id ? <Square size={13} /> : <Play size={13} />}</button>
      <span><strong>{sound.name}</strong><small>{categories[sound.category]} · {(sound.durationUs / 1_000_000).toFixed(2)} 秒</small></span>
      <button type="button" aria-label={`添加 ${sound.name}`} title="添加到播放头" disabled={Boolean(busy)} onClick={() => void run(sound.id, "add")}><Plus size={14} /></button>
    </div>)}
    {!sounds.length && <p className="empty-copy">没有匹配的音频</p>}
  </section>;
}
