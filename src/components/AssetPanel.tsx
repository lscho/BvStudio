import * as Tabs from "@radix-ui/react-tabs";
import { AudioLines, AudioWaveform, Captions, ChevronDown, Download, FileVideo2, ImageIcon, Layers3, Link2, Music2, PackageOpen, Plus, Sparkles, TriangleAlert } from "lucide-react";
import type { EffectCategory, EffectDefinition } from "@/domain/effects";
import { localMediaUrl } from "@/services/media";
import { useEditorStore } from "@/stores/editorStore";
import { useEffectLibraryStore } from "@/stores/effectLibraryStore";

interface Props {
  onImport: () => void;
  onGenerate: () => void;
  onTranscribe: (assetId: string) => void;
  onExtractAudio: (assetId: string) => void;
  onExportAudio: (assetId: string) => void;
  onRelink: (assetId: string) => void;
  onCreateAudio: () => void;
  onManageEffects: () => void;
}

export function AssetPanel({ onImport, onGenerate, onTranscribe, onExtractAudio, onExportAudio, onRelink, onCreateAudio, onManageEffects }: Props) {
  const assets = useEditorStore((state) => state.project.assets);
  const addEffect = useEditorStore((state) => state.addEffect);
  const placeAsset = useEditorStore((state) => state.placeAsset);
  const effects = useEffectLibraryStore((state) => state.effects);
  const effectGroups = (["标题", "强调", "卡片", "标注", "布局", "场景"] satisfies EffectCategory[])
    .map((category) => ({ category, effects: effects.filter((effect) => effect.category === category) }))
    .filter((group) => group.effects.length > 0);
  return (
    <aside className="asset-panel panel-border">
      <Tabs.Root defaultValue={assets.length ? "media" : "effects"} className="panel-tabs">
        <Tabs.List aria-label="资源类型"><Tabs.Trigger value="media">媒体</Tabs.Trigger><Tabs.Trigger value="effects">动效</Tabs.Trigger><Tabs.Trigger value="script">脚本</Tabs.Trigger></Tabs.List>
        <Tabs.Content value="media" className="panel-content">
          <button className="wide-action" type="button" onClick={onImport}><FileVideo2 size={16} />导入视频、音频或贴图</button>
          <div className="asset-list">{assets.length ? assets.map((asset) => <div className={`asset-row ${asset.missing ? "missing" : ""}`} key={asset.id}>{asset.kind === "image" && asset.objectUrl && !asset.missing ? <img src={asset.objectUrl} alt="" /> : asset.thumbnailPath && !asset.missing ? <img src={localMediaUrl(asset.thumbnailPath)} alt="" /> : <span className="asset-placeholder">{asset.missing ? <TriangleAlert size={16} /> : asset.kind === "audio" ? <Music2 size={16} /> : asset.kind === "image" ? <ImageIcon size={16} /> : <FileVideo2 size={16} />}</span>}<span><strong>{asset.name}</strong><small>{asset.missing ? "素材已丢失" : asset.kind === "audio" ? "音频素材" : asset.kind === "image" ? `贴图${asset.width && asset.height ? ` · ${asset.width} × ${asset.height}` : ""}` : asset.width && asset.height ? `${asset.width} × ${asset.height}${asset.proxyHeight ? ` · ${asset.proxyHeight}p 代理` : ""}` : "视频素材"}</small></span><span className="asset-actions">{asset.missing && <button type="button" aria-label={`重新定位 ${asset.name}`} title="重新定位素材" onClick={() => onRelink(asset.id)}><Link2 size={14} /></button>}<button type="button" aria-label={`将 ${asset.name} 加入时间线`} title="在播放头加入可用视频图层" disabled={asset.missing} onClick={() => placeAsset(asset.id)}><Plus size={14} /></button>{asset.kind === "video" && <button type="button" aria-label={`将 ${asset.name} 作为叠加视频`} title="作为画中画加入" disabled={asset.missing} onClick={() => placeAsset(asset.id, "overlay")}><Layers3 size={14} /></button>}{asset.kind !== "image" && <button type="button" aria-label={`提取 ${asset.name} 的字幕`} title="本地提取字幕" disabled={!asset.sourcePath || asset.missing || !asset.hasAudio} onClick={() => onTranscribe(asset.id)}><Captions size={14} /></button>}{asset.kind === "video" && <><button type="button" aria-label={`分离 ${asset.name} 的音频到音轨`} title="分离音频到音轨" disabled={!asset.sourcePath || asset.missing || !asset.hasAudio} onClick={() => onExtractAudio(asset.id)}><AudioWaveform size={14} /></button><button type="button" aria-label={`导出 ${asset.name} 的音频`} title="导出音频文件" disabled={!asset.sourcePath || asset.missing || !asset.hasAudio} onClick={() => onExportAudio(asset.id)}><Download size={14} /></button></>}</span></div>) : <p className="empty-copy">还没有素材</p>}</div>
        </Tabs.Content>
        <Tabs.Content value="effects" className="panel-content effect-list">
          <div className="effect-library-toolbar"><button className="wide-action" type="button" onClick={onManageEffects}><PackageOpen size={15} />管理动效包</button></div>
          <div className="effect-groups">
            {effectGroups.map((group) => (
              <details key={group.category} className="effect-group" open>
                <summary><span>{group.category}</span><small>{group.effects.length}</small><ChevronDown size={14} /></summary>
                <div className="effect-group-items">
                  {group.effects.map((effect) => <button type="button" key={effect.id} onClick={() => addEffect(effect.id)}><EffectThumbnail effect={effect} /><span><strong>{effect.name}</strong><small>{effect.description}</small></span><Plus size={15} /></button>)}
                </div>
              </details>
            ))}
          </div>
        </Tabs.Content>
        <Tabs.Content value="script" className="panel-content">
          <button className="wide-action ai-action" type="button" onClick={onGenerate}><Sparkles size={16} />生成 AI 内容</button>
          <button className="wide-action audio-action" type="button" onClick={onCreateAudio}><AudioLines size={16} />配音与录音</button>
          <p className="empty-copy align-left">AI 内容会以复合片段加入当前播放头，双击后可编辑内部场景。</p>
        </Tabs.Content>
      </Tabs.Root>
    </aside>
  );
}

function EffectThumbnail({ effect }: { effect: EffectDefinition }) {
  const label = effect.recipe.layout === "number"
    ? effect.defaultText.match(/[\d.%+\-]+/)?.[0] ?? "42%"
    : effect.defaultText.slice(0, 8);
  return (
    <span
      className={`effect-swatch recipe-${effect.recipe.layout} ${effect.kind === "scene" ? "scene-swatch" : ""}`}
      style={{ "--swatch-accent": effect.defaultAccentColor, "--swatch-text": effect.defaultColor } as React.CSSProperties}
      aria-hidden="true"
    >
      <i>{label}</i>
    </span>
  );
}
