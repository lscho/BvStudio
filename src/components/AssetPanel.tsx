import * as Tabs from "@radix-ui/react-tabs";
import { useMemo, useState } from "react";
import { AudioLines, AudioWaveform, BadgePercent, Captions, ChartNoAxesColumnIncreasing, ChartPie, ChartSpline, Check, ChevronDown, Download, FileText, FileVideo2, History, ImageIcon, Layers3, Link2, Music2, PackageOpen, Play, Plus, Search, SlidersHorizontal, Sparkles, TriangleAlert, WandSparkles, X } from "lucide-react";
import { SubtitleStyleDialog } from "@/components/SubtitleStyleDialog";
import type { EffectCategory, CompositionDefinition } from "@/domain/effects";
import { MOTION_ACCENT_COLOR_PRESETS, motionThemeAccentColor, motionThemeUsesAccentColor, motionThemeWithAccentColor } from "@/domain/motionTheme";
import type { GeneratedBlock, SubtitleClip } from "@/domain/project";
import { displaySubtitleText } from "@/domain/videoDecorations";
import { localMediaUrl } from "@/services/media";
import { useEditorStore } from "@/stores/editorStore";
import { useEffectLibraryStore } from "@/stores/effectLibraryStore";
import { BUILTIN_SOUND_EFFECTS, type BuiltinSoundCategory, type BuiltinSoundEffectId } from "@/domain/soundEffects";

interface Props {
  onImport: () => void;
  onGenerate: () => void;
  onMatchEffects: () => void;
  onReviewMotionMatching?: () => void;
  onMatchSounds?: () => void;
  matching?: boolean;
  onTranscribe: (assetId: string) => void;
  onExtractAudio: (assetId: string) => void;
  onExportAudio: (assetId: string) => void;
  onRelink: (assetId: string) => void;
  onCreateAudio: () => void;
  onManageEffects: () => void;
  previewingEffectId?: string | null;
  onPreviewEffect?: (compositionId: string | null) => void;
  onPreviewBuiltinSound?: (soundId: BuiltinSoundEffectId) => void;
  onAddBuiltinSound?: (soundId: BuiltinSoundEffectId) => void;
}

export function AssetPanel({ onImport, onGenerate, onMatchEffects, onReviewMotionMatching, onMatchSounds, matching, onTranscribe, onExtractAudio, onExportAudio, onRelink, onCreateAudio, onManageEffects, previewingEffectId, onPreviewEffect, onPreviewBuiltinSound, onAddBuiltinSound }: Props) {
  const [subtitleStyleOpen, setSubtitleStyleOpen] = useState(false);
  const [scriptsOpen, setScriptsOpen] = useState(false);
  const [effectQuery, setEffectQuery] = useState("");
  const project = useEditorStore((state) => state.project);
  const assets = project.assets;
  const scripts = useMemo(() => project.tracks.flatMap(track => track.clips).filter((clip): clip is GeneratedBlock => clip.kind === "generated").sort((a, b) => a.startUs - b.startUs), [project]);
  const selectedClipIds = useEditorStore((state) => state.selectedClipIds);
  const addComposition = useEditorStore((state) => state.addComposition);
  const updateMotionTheme = useEditorStore((state) => state.updateMotionTheme);
  const placeAsset = useEditorStore((state) => state.placeAsset);
  const motionAccentColor = motionThemeAccentColor(project.motionTheme);
  const subtitles = useMemo(() => project.tracks.flatMap((track) => track.clips).filter((clip): clip is SubtitleClip => clip.kind === "subtitle").sort((left, right) => left.startUs - right.startUs), [project]);
  const effects = useEffectLibraryStore((state) => state.effects);
  const filteredEffects = useMemo(() => {
    const query = effectQuery.trim().toLocaleLowerCase("zh-CN");
    if (!query) return effects;
    return effects.filter((effect) => `${effect.name} ${effect.description} ${effect.category} ${effect.tags.join(" ")}`.toLocaleLowerCase("zh-CN").includes(query));
  }, [effectQuery, effects]);
  const effectGroups = useMemo(() => (["背景", "展示", "场景", "标题", "强调", "卡片", "标注", "数据", "布局"] satisfies EffectCategory[])
    .map((category) => ({ category, effects: filteredEffects.filter((effect) => effect.category === category) }))
    .filter((group) => group.effects.length > 0), [filteredEffects]);
  const soundGroups = (["转场", "强调", "氛围"] satisfies BuiltinSoundCategory[]).map((category) => ({
    category,
    sounds: BUILTIN_SOUND_EFFECTS.filter((sound) => sound.category === category)
  }));
  return (
    <aside className="asset-panel panel-border">
      <Tabs.Root defaultValue={assets.length ? "media" : "effects"} className="panel-tabs">
        <Tabs.List aria-label="资源类型"><Tabs.Trigger value="media">媒体</Tabs.Trigger><Tabs.Trigger value="effects">动效</Tabs.Trigger><Tabs.Trigger value="sounds">音效</Tabs.Trigger><Tabs.Trigger value="subtitles">字幕</Tabs.Trigger></Tabs.List>
        <Tabs.Content value="media" className="panel-content" tabIndex={-1}>
          <button className="wide-action" type="button" onClick={onImport}><FileVideo2 size={16} />导入视频、音频或贴图</button>
          <div className="asset-list">{assets.length ? assets.map((asset) => <div className={`asset-row ${asset.missing ? "missing" : ""}`} key={asset.id} draggable={(asset.kind === "image" || asset.kind === "video") && !asset.missing} onDragStart={(event) => event.dataTransfer.setData("application/x-bvideo-asset", asset.id)}>{asset.kind === "image" && asset.objectUrl && !asset.missing ? <img src={asset.objectUrl} alt="" /> : asset.thumbnailPath && !asset.missing ? <img src={localMediaUrl(asset.thumbnailPath)} alt="" /> : <span className="asset-placeholder">{asset.missing ? <TriangleAlert size={16} /> : asset.kind === "audio" ? <Music2 size={16} /> : asset.kind === "image" ? <ImageIcon size={16} /> : <FileVideo2 size={16} />}</span>}<span><strong>{asset.name}</strong><small>{asset.missing ? "素材已丢失" : asset.kind === "audio" ? "音频素材" : asset.kind === "image" ? `贴图${asset.width && asset.height ? ` · ${asset.width} × ${asset.height}` : ""}` : asset.width && asset.height ? `${asset.width} × ${asset.height}${asset.proxyHeight ? ` · ${asset.proxyHeight}p 代理` : ""}` : "视频素材"}</small></span><span className="asset-actions">{asset.missing && <button type="button" aria-label={`重新定位 ${asset.name}`} title="重新定位素材" onClick={() => onRelink(asset.id)}><Link2 size={14} /></button>}<button type="button" aria-label={`将 ${asset.name} 加入时间线`} title="接在选中素材末尾，未选中时放在播放头" disabled={asset.missing} onClick={() => placeAsset(asset.id)}><Plus size={14} /></button>{asset.kind !== "image" && <button type="button" aria-label={`提取 ${asset.name} 的字幕`} title="云端提取字幕" disabled={!asset.sourcePath || asset.missing || !asset.hasAudio} onClick={() => onTranscribe(asset.id)}><Captions size={14} /></button>}{asset.kind === "video" && <><button type="button" aria-label={`分离 ${asset.name} 的音频到音轨`} title="分离音频到音轨" disabled={!asset.sourcePath || asset.missing || !asset.hasAudio} onClick={() => onExtractAudio(asset.id)}><AudioWaveform size={14} /></button><button type="button" aria-label={`导出 ${asset.name} 的音频`} title="导出音频文件" disabled={!asset.sourcePath || asset.missing || !asset.hasAudio} onClick={() => onExportAudio(asset.id)}><Download size={14} /></button></>}</span></div>) : <p className="empty-copy">还没有素材</p>}</div>
        </Tabs.Content>
        <Tabs.Content value="effects" className="panel-content asset-action-panel" tabIndex={-1}>
          <div className="asset-panel-scroll effect-list">
          <section className="effect-theme-picker" aria-labelledby="effect-theme-picker-title">
            <header><strong id="effect-theme-picker-title">主题色</strong><small>{MOTION_ACCENT_COLOR_PRESETS.find((preset) => motionThemeUsesAccentColor(project.motionTheme, preset.color))?.label ?? "混合配色"}</small></header>
            <div role="radiogroup" aria-label="动效主题色">
              {MOTION_ACCENT_COLOR_PRESETS.map((preset) => {
                const selected = motionThemeUsesAccentColor(project.motionTheme, preset.color);
                return <button key={preset.id} type="button" role="radio" aria-checked={selected} aria-label={preset.label} title={preset.label} style={{ "--theme-color": preset.color } as React.CSSProperties} onClick={() => updateMotionTheme(motionThemeWithAccentColor(project.motionTheme, preset.color))}>{selected && <Check size={12} aria-hidden="true" />}</button>;
              })}
            </div>
          </section>
          <div className="effect-library-toolbar">
            <label className="effect-search"><Search size={14} aria-hidden="true" /><input type="search" aria-label="搜索动效" placeholder="搜索名称、用途或标签" value={effectQuery} onChange={(event) => setEffectQuery(event.target.value)} />{effectQuery && <button type="button" aria-label="清除动效搜索" title="清除搜索" onClick={() => setEffectQuery("")}><X size={13} /></button>}</label>
            <button className="effect-package-button" type="button" aria-label="管理动效包" title="管理动效包" onClick={onManageEffects}><PackageOpen size={15} /></button>
            {effectQuery && <small className="effect-match-count">{filteredEffects.length} 个匹配</small>}
          </div>
          {effectGroups.length ? <div className="effect-groups">
            {effectGroups.map((group) => (
              <details key={group.category} className="effect-group">
                <summary><span>{group.category}</span><small>{group.effects.length}</small><ChevronDown size={14} /></summary>
                <div className="effect-group-items">
                  {group.effects.map((effect) => {
                    const previewing = previewingEffectId === effect.id;
                    return <div className={`effect-library-item ${previewing ? "previewing" : ""}`} key={effect.id}>
                      <button className="effect-preview-button" type="button" aria-label={`预览 ${effect.name}`} aria-pressed={previewing} title="在画布中预览" onClick={() => onPreviewEffect?.(effect.id)}>
                        <EffectThumbnail effect={effect} accentColor={motionAccentColor} />
                        <span><strong>{effect.name}</strong><small>{effect.description}</small></span>
                        <Play size={13} fill="currentColor" aria-hidden="true" />
                      </button>
                      <button className="effect-add-button" type="button" aria-label={`添加 ${effect.name} 到时间线`} title="添加到播放头" onClick={() => { onPreviewEffect?.(null); addComposition(effect.id); }}><Plus size={14} /></button>
                    </div>;
                  })}
                </div>
              </details>
            ))}
          </div> : <p className="empty-copy align-left">没有匹配的动效</p>}
          </div>
          <div className="asset-panel-actions motion-actions" aria-label="动效操作">
            <button className="asset-panel-icon-action" type="button" aria-label="查看动效匹配记录" title="查看动效匹配记录" onClick={onReviewMotionMatching}><History size={15} /></button>
            <button type="button" title="按字幕匹配场景、动效与运镜" disabled={!subtitles.length || matching} onClick={onMatchEffects}><WandSparkles size={15} />匹配</button>
          </div>
        </Tabs.Content>
        <Tabs.Content value="sounds" className="panel-content asset-action-panel" tabIndex={-1}>
          <div className="asset-panel-scroll sound-library">
          <header><AudioWaveform size={15} aria-hidden="true" /><span><strong>内置音效</strong><small>添加到当前播放头</small></span></header>
          {soundGroups.map((group) => <section key={group.category} className="sound-group" aria-labelledby={`sound-group-${group.category}`}>
            <h3 id={`sound-group-${group.category}`}>{group.category}</h3>
            {group.sounds.map((sound) => <div className="sound-row" key={sound.id}>
              <button type="button" aria-label={`试听 ${sound.name}`} title="试听音效" onClick={() => onPreviewBuiltinSound?.(sound.id)}><Play size={13} fill="currentColor" /></button>
              <span><strong>{sound.name}</strong><small>{sound.description} · {(sound.durationUs / 1_000_000).toFixed(2)} 秒</small></span>
              <button type="button" aria-label={`添加 ${sound.name}`} title="添加到播放头" onClick={() => onAddBuiltinSound?.(sound.id)}><Plus size={14} /></button>
            </div>)}
          </section>)}
          </div>
          <div className="asset-panel-actions" aria-label="音效操作">
            <button type="button" title="按字幕单独匹配音效" disabled={!subtitles.length || matching || !onMatchSounds} onClick={onMatchSounds}><WandSparkles size={15} />匹配</button>
          </div>
        </Tabs.Content>
        <Tabs.Content value="subtitles" className="panel-content subtitles-panel" tabIndex={-1}>
          <section className="subtitle-library">
            <header><span className="subtitle-library-title"><Captions size={15} /><strong>时间字幕</strong></span><span className="subtitle-library-tools"><small>{subtitles.length}</small><button type="button" aria-label="脚本记录" title="脚本记录" aria-expanded={scriptsOpen} onClick={() => setScriptsOpen(!scriptsOpen)}><FileText size={15} /></button><button type="button" aria-label="设置全局字幕样式" title="设置全局字幕样式" disabled={!subtitles.length} onClick={() => setSubtitleStyleOpen(true)}><SlidersHorizontal size={15} /></button></span></header>
            {scriptsOpen && <section className="subtitle-scripts" aria-label="脚本记录">
              {scripts.length ? scripts.map(script => <button type="button" key={script.id} aria-label={`编辑脚本 ${script.label}`} aria-pressed={selectedClipIds.includes(script.id)} title={script.label} onClick={() => { useEditorStore.getState().selectClip(script.id); useEditorStore.getState().setPlayhead(script.startUs); }}>
                <FileText size={13} aria-hidden="true" /><span><strong>{script.label}</strong><small>{formatCaptionTime(script.startUs)} · {subtitles.filter(subtitle => subtitle.sourceBlockId === script.id).length} 条字幕</small></span>
              </button>) : <p className="empty-copy align-left">还没有脚本记录</p>}
            </section>}
            {subtitles.length ? subtitles.map((subtitle, index) => <SubtitleEntry key={subtitle.id} subtitle={subtitle} subtitles={subtitles} index={index} selected={selectedClipIds.includes(subtitle.id)} />) : <p className="empty-copy align-left">还没有时间字幕</p>}
          </section>
          <div className="asset-panel-actions subtitle-actions" aria-label="字幕操作">
            <button type="button" onClick={onGenerate}><Sparkles size={15} />生成</button>
            <button type="button" onClick={onCreateAudio}><AudioLines size={15} />配音</button>
          </div>
        </Tabs.Content>
      </Tabs.Root>
      <SubtitleStyleDialog open={subtitleStyleOpen} onOpenChange={setSubtitleStyleOpen} subtitles={subtitles} />
    </aside>
  );
}

function SubtitleEntry({ subtitle, subtitles, index, selected }: { subtitle: SubtitleClip; subtitles: readonly SubtitleClip[]; index: number; selected: boolean }) {
  const active = useEditorStore((state) => state.playheadUs >= subtitle.startUs && state.playheadUs < subtitle.startUs + subtitle.durationUs);
  const range = `${formatCaptionTime(subtitle.startUs)} → ${formatCaptionTime(subtitle.startUs + subtitle.durationUs)}`;
  return <button className={`subtitle-entry ${selected ? "selected" : ""} ${active ? "active" : ""}`} type="button" aria-label={`定位字幕 ${range} ${subtitle.text}`} onClick={(event) => {
    const state = useEditorStore.getState();
    const anchorIndex = subtitles.findIndex((candidate) => candidate.id === state.selectedClipId);
    if (event.shiftKey && anchorIndex >= 0) {
      const from = Math.min(anchorIndex, index);
      const to = Math.max(anchorIndex, index);
      const rangeIds = subtitles.slice(from, to + 1).map((candidate) => candidate.id);
      state.selectClip(rangeIds[0]);
      rangeIds.slice(1).forEach((id) => useEditorStore.getState().selectClip(id, true));
    } else {
      state.selectClip(subtitle.id, event.metaKey || event.ctrlKey);
    }
    state.setPlayhead(subtitle.startUs);
  }}>
    <span><b>{String(index + 1).padStart(2, "0")}</b><time>{range}</time></span>
    <p>{displaySubtitleText(subtitle.text)}</p>
  </button>;
}

function formatCaptionTime(timeUs: number) {
  const milliseconds = Math.max(0, Math.round(timeUs / 1_000));
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.floor(milliseconds % 60_000 / 1_000);
  const remainder = milliseconds % 1_000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(remainder).padStart(3, "0")}`;
}

function EffectThumbnail({ effect, accentColor }: { effect: CompositionDefinition; accentColor: string }) {
  const chartKind = effect.recipe.chart?.kind;
  const label = effect.recipe.layout === "number"
    ? effect.defaultText.match(/[\d.%+\-]+/)?.[0] ?? "42%"
    : effect.defaultText.slice(0, 8);
  const chartIcon = chartKind === "counter" ? <BadgePercent size={18} />
    : chartKind === "bar" ? <ChartNoAxesColumnIncreasing size={18} />
      : chartKind === "donut" ? <ChartPie size={18} />
        : chartKind === "line" ? <ChartSpline size={18} />
          : null;
  return (
    <span
      className={`effect-swatch recipe-${effect.recipe.layout} ${chartKind ? `chart-swatch chart-${chartKind}` : ""} ${effect.kind === "scene" || effect.recipe.sceneBackground ? "scene-swatch" : ""}`}
      style={{ "--swatch-accent": accentColor, "--swatch-text": effect.defaultColor } as React.CSSProperties}
      aria-hidden="true"
    >
      <i>{(effect.renderer === "three" || effect.renderer === "canvas") || effect.kind === "scene" || effect.recipe.sceneBackground ? <Layers3 size={18} /> : chartIcon ?? label}</i>
    </span>
  );
}
