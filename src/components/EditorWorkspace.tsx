import { useEffect, useRef, useState } from "react";
import { Pause, Play, SkipBack } from "lucide-react";
import { AssetPanel } from "@/components/AssetPanel";
import { InspectorPanel } from "@/components/InspectorPanel";
import { PreviewCanvas } from "@/components/PreviewCanvas";
import { Timeline, formatTime } from "@/components/TimelineEditor";
import { useEditorStore } from "@/stores/editorStore";

interface Props {
  onGenerate: () => void;
  onImport: () => void;
  onTranscribe: (assetId: string) => void;
  onExtractAudio: (assetId: string) => void;
  onExportAudio: (assetId: string) => void;
  onRelink: (assetId: string) => void;
  onCreateAudio: () => void;
  onManageEffects: () => void;
}

export function EditorWorkspace({ onGenerate, onImport, onTranscribe, onExtractAudio, onExportAudio, onRelink, onCreateAudio, onManageEffects }: Props) {
  const [playing, setPlaying] = useState(false);
  const playheadUs = useEditorStore((state) => state.playheadUs);
  const durationUs = useEditorStore((state) => state.project.durationUs);
  const setPlayhead = useEditorStore((state) => state.setPlayhead);
  const animationFrame = useRef<number | null>(null);
  const previousTime = useRef(0);

  useEffect(() => {
    if (!playing) return;
    previousTime.current = performance.now();
    const tick = (now: number) => {
      const deltaUs = (now - previousTime.current) * 1000;
      previousTime.current = now;
      const current = useEditorStore.getState().playheadUs;
      if (current + deltaUs >= durationUs) {
        setPlayhead(0);
        setPlaying(false);
        return;
      }
      setPlayhead(current + deltaUs);
      animationFrame.current = requestAnimationFrame(tick);
    };
    animationFrame.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current);
    };
  }, [durationUs, playing, setPlayhead]);

  return (
    <main className="editor-workspace">
      <div className="editor-main"><AssetPanel onImport={onImport} onGenerate={onGenerate} onTranscribe={onTranscribe} onExtractAudio={onExtractAudio} onExportAudio={onExportAudio} onRelink={onRelink} onCreateAudio={onCreateAudio} onManageEffects={onManageEffects} /><div className="preview-column"><PreviewCanvas onImport={onImport} onGenerate={onGenerate} playing={playing} /><div className="transport"><button type="button" aria-label="回到开头" onClick={() => setPlayhead(0)}><SkipBack size={17} /></button><button className="play-button" type="button" aria-label={playing ? "暂停" : "播放"} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}</button><span>{formatTime(playheadUs)}</span><span className="duration">/ {formatTime(durationUs)}</span></div></div><InspectorPanel /></div>
      <Timeline />
    </main>
  );
}
