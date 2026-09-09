import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, LoaderCircle, Play, Plus, Search, Square } from "lucide-react";
import { loadShotcraftAudio, previewShotcraftAudio, SHOTCRAFT_AUDIO, stopShotcraftAudioPreview } from "@/services/shotcraftAudio";
import { useEditorStore } from "@/stores/editorStore";

const categoryLabels: Record<string, string> = { transition: "转场", impact: "冲击", riser: "渐强", camera: "相机", ui: "交互", text: "文字", paper: "纸张", film: "胶片", light: "光效", data: "数据", scifi: "科幻", mech: "机械", glass: "玻璃", fluid: "流体", crowd: "人群", counter: "计数", bgm: "音乐" };
const categoryOrder = ["transition", "impact", "riser", "camera", "ui", "text", "paper", "film", "light", "data", "scifi", "mech", "glass", "fluid", "crowd", "counter", "bgm"];
const orderedCategories = [...categoryOrder, ...new Set(SHOTCRAFT_AUDIO.map((item) => item.category).filter((category) => !categoryOrder.includes(category)))];

export function ShotcraftAudioLibrary() {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState<string>();
  const request = useRef<AbortController | null>(null);
  const addAudio = useEditorStore((state) => state.addAudio);
  useEffect(() => () => { request.current?.abort(); request.current = null; stopShotcraftAudioPreview(); }, []);
  const groups = useMemo(() => {
    const text = query.trim().toLowerCase();
    return orderedCategories.map((category) => ({
      category,
      sounds: SHOTCRAFT_AUDIO.filter((item) => item.category === category
        && (!text || `${item.name} ${categoryLabels[item.category] ?? ""}`.toLowerCase().includes(text)))
    })).filter((group) => group.sounds.length > 0);
  }, [query]);
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
  return <section className="sound-group shotcraft-audio-library" aria-label="Shotcraft 音效库">
    <label className="effect-search"><Search size={14} aria-hidden="true" /><input type="search" aria-label="搜索 Shotcraft 音效" placeholder="搜索音效或分类" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    {error && <p role="alert" className="composition-validation">{error}</p>}
    {groups.length ? <div className="effect-groups">
      {groups.map((group) => (
        <details className="effect-group" key={group.category}>
          <summary><span>{categoryLabels[group.category] ?? group.category}</span><small>{group.sounds.length}</small><ChevronDown size={14} /></summary>
          <div className="effect-group-items">
            {group.sounds.map((sound) => <div className="sound-row" key={sound.id}>
              <button type="button" aria-label={`试听 ${sound.name}`} title={playing === sound.id ? "停止试听" : "试听"} disabled={Boolean(busy)} onClick={() => { if (playing === sound.id) { stopShotcraftAudioPreview(); setPlaying(undefined); } else void run(sound.id, "preview"); }}>{busy === sound.id ? <LoaderCircle size={13} className="spin" /> : playing === sound.id ? <Square size={13} /> : <Play size={13} />}</button>
              <span><strong>{sound.name}</strong><small>{categoryLabels[sound.category] ?? sound.category} · {(sound.durationUs / 1_000_000).toFixed(2)} 秒</small></span>
              <button type="button" aria-label={`添加 ${sound.name}`} title="添加到播放头" disabled={Boolean(busy)} onClick={() => void run(sound.id, "add")}><Plus size={14} /></button>
            </div>)}
          </div>
        </details>
      ))}
    </div> : <p className="empty-copy align-left">没有匹配的音效</p>}
  </section>;
}
