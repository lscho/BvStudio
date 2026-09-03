import * as Tabs from "@radix-ui/react-tabs";
import { useMemo, useState } from "react";
import { AudioLines, AudioWaveform, BadgePercent, Captions, ChartNoAxesColumnIncreasing, ChartPie, ChartSpline, ChevronDown, Download, FileVideo2, ImageIcon, Layers3, Link2, Music2, PackageOpen, Plus, Search, SlidersHorizontal, Sparkles, TriangleAlert, WandSparkles, X } from "lucide-react";
import { SubtitleStyleDialog } from "@/components/SubtitleStyleDialog";
import type { EffectCategory, EffectDefinition } from "@/domain/effects";
import type { SubtitleClip } from "@/domain/project";
import { displaySubtitleText } from "@/domain/videoDecorations";
import { localMediaUrl } from "@/services/media";
import { useEditorStore } from "@/stores/editorStore";
import { useEffectLibraryStore } from "@/stores/effectLibraryStore";

interface Props {
  onImport: () => void;
  onGenerate: () => void;
  onMatchEffects: () => void;
  onTranscribe: (assetId: string) => void;
  onExtractAudio: (assetId: string) => void;
  onExportAudio: (assetId: string) => void;
  onRelink: (assetId: string) => void;
  onCreateAudio: () => void;
  onManageEffects: () => void;
}

export function AssetPanel({ onImport, onGenerate, onMatchEffects, onTranscribe, onExtractAudio, onExportAudio, onRelink, onCreateAudio, onManageEffects }: Props) {
  const [subtitleStyleOpen, setSubtitleStyleOpen] = useState(false);
  const [effectQuery, setEffectQuery] = useState("");
  const project = useEditorStore((state) => state.project);
  const assets = project.assets;
  const selectedClipIds = useEditorStore((state) => state.selectedClipIds);
  const addEffect = useEditorStore((state) => state.addEffect);
  const placeAsset = useEditorStore((state) => state.placeAsset);
  const subtitles = useMemo(() => project.tracks.flatMap((track) => track.clips).filter((clip): clip is SubtitleClip => clip.kind === "subtitle").sort((left, right) => left.startUs - right.startUs), [project]);
  const effects = useEffectLibraryStore((state) => state.effects);
  const filteredEffects = useMemo(() => {
    const query = effectQuery.trim().toLocaleLowerCase("zh-CN");
    if (!query) return effects;
    return effects.filter((effect) => `${effect.name} ${effect.description} ${effect.category} ${effect.tags.join(" ")}`.toLocaleLowerCase("zh-CN").includes(query));
  }, [effectQuery, effects]);
  const effectGroups = useMemo(() => (["场景", "标题", "强调", "卡片", "标注", "数据", "布局"] satisfies EffectCategory[])
    .map((category) => ({ category, effects: filteredEffects.filter((effect) => effect.category === category) }))
    .filter((group) => group.effects.length > 0), [filteredEffects]);
  return (
    <aside className="asset-panel panel-border">
      <Tabs.Root defaultValue={assets.length ? "media" : "effects"} className="panel-tabs">
        <Tabs.List aria-label="资源类型"><Tabs.Trigger value="media">媒体</Tabs.Trigger><Tabs.Trigger value="effects">动效</Tabs.Trigger><Tabs.Trigger value="subtitles">字幕</Tabs.Trigger></Tabs.List>
        <Tabs.Content value="media" className="panel-content" tabIndex={-1}>
          <button className="wide-action" type="button" onClick={onImport}><FileVideo2 size={16} />导入视频、音频或贴图</button>
          <div className="asset-list">{assets.length ? assets.map((asset) => <div className={`asset-row ${asset.missing ? "missing" : ""}`} key={asset.id}>{asset.kind === "image" && asset.objectUrl && !asset.missing ? <img src={asset.objectUrl} alt="" /> : asset.thumbnailPath && !asset.missing ? <img src={localMediaUrl(asset.thumbnailPath)} alt="" /> : <span className="asset-placeholder">{asset.missing ? <TriangleAlert size={16} /> : asset.kind === "audio" ? <Music2 size={16} /> : asset.kind === "image" ? <ImageIcon size={16} /> : <FileVideo2 size={16} />}</span>}<span><strong>{asset.name}</strong><small>{asset.missing ? "素材已丢失" : asset.kind === "audio" ? "音频素材" : asset.kind === "image" ? `贴图${asset.width && asset.height ? ` · ${asset.width} × ${asset.height}` : ""}` : asset.width && asset.height ? `${asset.width} × ${asset.height}${asset.proxyHeight ? ` · ${asset.proxyHeight}p 代理` : ""}` : "视频素材"}</small></span><span className="asset-actions">{asset.missing && <button type="button" aria-label={`重新定位 ${asset.name}`} title="重新定位素材" onClick={() => onRelink(asset.id)}><Link2 size={14} /></button>}<button type="button" aria-label={`将 ${asset.name} 加入时间线`} title="在播放头加入新的可用图层" disabled={asset.missing} onClick={() => placeAsset(asset.id)}><Plus size={14} /></button>{asset.kind !== "image" && <button type="button" aria-label={`提取 ${asset.name} 的字幕`} title="云端提取字幕" disabled={!asset.sourcePath || asset.missing || !asset.hasAudio} onClick={() => onTranscribe(asset.id)}><Captions size={14} /></button>}{asset.kind === "video" && <><button type="button" aria-label={`分离 ${asset.name} 的音频到音轨`} title="分离音频到音轨" disabled={!asset.sourcePath || asset.missing || !asset.hasAudio} onClick={() => onExtractAudio(asset.id)}><AudioWaveform size={14} /></button><button type="button" aria-label={`导出 ${asset.name} 的音频`} title="导出音频文件" disabled={!asset.sourcePath || asset.missing || !asset.hasAudio} onClick={() => onExportAudio(asset.id)}><Download size={14} /></button></>}</span></div>) : <p className="empty-copy">还没有素材</p>}</div>
        </Tabs.Content>
        <Tabs.Content value="effects" className="panel-content effect-list" tabIndex={-1}>
          <div className="effect-library-toolbar">
            <label className="effect-search"><Search size={14} aria-hidden="true" /><input type="search" aria-label="搜索动效" placeholder="搜索名称、用途或标签" value={effectQuery} onChange={(event) => setEffectQuery(event.target.value)} />{effectQuery && <button type="button" aria-label="清除动效搜索" title="清除搜索" onClick={() => setEffectQuery("")}><X size={13} /></button>}</label>
            <button className="effect-package-button" type="button" aria-label="管理动效包" title="管理动效包" onClick={onManageEffects}><PackageOpen size={15} /></button>
            {effectQuery && <small className="effect-match-count">{filteredEffects.length} 个匹配</small>}
          </div>
          {effectGroups.length ? <div className="effect-groups">
            {effectGroups.map((group) => (
              <details key={group.category} className="effect-group" open>
                <summary><span>{group.category}</span><small>{group.effects.length}</small><ChevronDown size={14} /></summary>
                <div className="effect-group-items">
                  {group.effects.map((effect) => <button type="button" key={effect.id} onClick={() => addEffect(effect.id)}><EffectThumbnail effect={effect} /><span><strong>{effect.name}</strong><small>{effect.description}</small></span><Plus size={15} /></button>)}
                </div>
              </details>
            ))}
          </div> : <p className="empty-copy align-left">没有匹配的动效</p>}
        </Tabs.Content>
        <Tabs.Content value="subtitles" className="panel-content subtitles-panel" tabIndex={-1}>
          <section className="subtitle-library">
            <header><span className="subtitle-library-title"><Captions size={15} /><strong>时间字幕</strong></span><span className="subtitle-library-tools"><small>{subtitles.length}</small><button type="button" aria-label="设置全局字幕样式" title="设置全局字幕样式" disabled={!subtitles.length} onClick={() => setSubtitleStyleOpen(true)}><SlidersHorizontal size={15} /></button></span></header>
            {subtitles.length ? subtitles.map((subtitle, index) => <SubtitleEntry key={subtitle.id} subtitle={subtitle} subtitles={subtitles} index={index} selected={selectedClipIds.includes(subtitle.id)} />) : <p className="empty-copy align-left">还没有时间字幕</p>}
          </section>
          <div className="subtitle-actions" aria-label="字幕操作">
            <button type="button" onClick={onGenerate}><Sparkles size={15} />生成</button>
            <button type="button" title="按连续场景自动匹配 A-roll、B-roll 与多层动效" disabled={!subtitles.length} onClick={onMatchEffects}><WandSparkles size={15} />匹配</button>
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

function EffectThumbnail({ effect }: { effect: EffectDefinition }) {
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
      style={{ "--swatch-accent": effect.defaultAccentColor, "--swatch-text": effect.defaultColor } as React.CSSProperties}
      aria-hidden="true"
    >
      <i>{effect.kind === "scene" || effect.recipe.sceneBackground ? <Layers3 size={18} /> : chartIcon ?? label}</i>
    </span>
  );
}
