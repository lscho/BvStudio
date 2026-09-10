import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, LoaderCircle, Play, Plus, Search, Square } from "lucide-react";
import {
  canUseSound,
  FREE_MUSIC_TRACKS,
  FREE_SOUNDS_PER_CATEGORY,
  MUSIC_SOUND_CATEGORY,
  SOUND_CATEGORY_ORDER,
  soundCategory,
  soundDisplayName,
  soundTier,
  soundTierMap
} from "@/domain/soundAccess";
import { loadShotcraftAudio, previewShotcraftAudio, SHOTCRAFT_AUDIO, stopShotcraftAudioPreview } from "@/services/shotcraftAudio";
import { useEditorStore } from "@/stores/editorStore";

// 档位只由目录顺序决定：搜索与分类筛选不会改变某个音效的免费/Pro 状态。
const SOUND_TIERS = soundTierMap(SHOTCRAFT_AUDIO);

interface Props {
  isPro: boolean;
  onNeedLicense?: () => void;
}

export function ShotcraftAudioLibrary({ isPro, onNeedLicense }: Props) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState<string>();
  const request = useRef<AbortController | null>(null);
  const addAudio = useEditorStore((state) => state.addAudio);
  useEffect(() => () => { request.current?.abort(); request.current = null; stopShotcraftAudioPreview(); }, []);
  const groups = useMemo(() => {
    const text = query.trim().toLowerCase();
    return SOUND_CATEGORY_ORDER.map((category) => ({
      category,
      sounds: SHOTCRAFT_AUDIO.filter((item) => soundCategory(item.category) === category
        && (!text || `${soundDisplayName(item)} ${category}`.toLowerCase().includes(text)))
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
          <summary><span>{group.category}</span><small>{group.sounds.length}</small><ChevronDown size={14} /></summary>
          <div className="effect-group-items">
            {group.sounds.map((sound) => {
              const displayName = soundDisplayName(sound);
              const locked = !canUseSound(soundTier(sound, SOUND_TIERS), isPro);
              const lockHint = group.category === MUSIC_SOUND_CATEGORY ? `音乐分类第 ${FREE_MUSIC_TRACKS + 1} 首起需要 Pro 会员` : `每个分类第 ${FREE_SOUNDS_PER_CATEGORY + 1} 个起需要 Pro 会员`;
              return <div className={`sound-row ${locked ? "locked" : ""}`} key={sound.id}>
                <button type="button" aria-label={`试听 ${displayName}`} title={playing === sound.id ? "停止试听" : locked ? `${lockHint}，可先试听` : "试听"} disabled={Boolean(busy)} onClick={() => { if (playing === sound.id) { stopShotcraftAudioPreview(); setPlaying(undefined); } else void run(sound.id, "preview"); }}>{busy === sound.id ? <LoaderCircle size={13} className="spin" /> : playing === sound.id ? <Square size={13} /> : <Play size={13} />}</button>
                <span><strong>{displayName}</strong><small>{group.category} · {(sound.durationUs / 1_000_000).toFixed(2)} 秒</small></span>
                <button className={locked ? "pro-locked" : ""} type="button" aria-label={locked ? `${displayName} 需要 Pro 会员` : `添加 ${displayName}`} title={locked ? `${lockHint}，点击兑换` : "添加到播放头"} disabled={!locked && Boolean(busy)} onClick={() => { if (locked) { onNeedLicense?.(); return; } void run(sound.id, "add"); }}>{locked ? "PRO" : <Plus size={14} />}</button>
              </div>;
            })}
          </div>
        </details>
      ))}
    </div> : <p className="empty-copy align-left">没有匹配的音效</p>}
  </section>;
}
