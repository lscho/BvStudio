import { memo, useEffect, useRef, useState } from "react";
import { Pause, Play, SkipBack } from "lucide-react";
import { AssetPanel } from "@/components/AssetPanel";
import { InspectorPanel } from "@/components/InspectorPanel";
import { PreviewCanvas } from "@/components/PreviewCanvas";
import { Timeline, formatTime } from "@/components/TimelineEditor";
import { useEditorStore } from "@/stores/editorStore";
import { previewFrameIntervalMs } from "@/domain/playback";

interface Props {
  onGenerate: () => void;
  onMatchEffects: () => void;
  onImport: () => void;
  onTranscribe: (assetId: string) => void;
  onExtractAudio: (assetId: string) => void;
  onExportAudio: (assetId: string) => void;
  onRelink: (assetId: string) => void;
  onCreateAudio: () => void;
  onManageEffects: () => void;
}

const StableAssetPanel = memo(AssetPanel);
const StablePreviewCanvas = memo(PreviewCanvas);
const StableInspectorPanel = memo(InspectorPanel);
const StableTimeline = memo(Timeline);

export function EditorWorkspace({ onGenerate, onMatchEffects, onImport, onTranscribe, onExtractAudio, onExportAudio, onRelink, onCreateAudio, onManageEffects }: Props) {
  const [playing, setPlaying] = useState(false);
  const durationUs = useEditorStore((state) => state.project.durationUs);
  const setPlayhead = useEditorStore((state) => state.setPlayhead);
  const previewRequest = useEditorStore((state) => state.previewRequest);
  const animationFrame = useRef<number | null>(null);
  const previewEndUs = useRef<number | null>(null);
  const playbackAnchor = useRef({ timeMs: 0, playheadUs: 0, lastCommitMs: 0 });

  function togglePlayback() {
    previewEndUs.current = null;
    setPlaying((current) => !current);
  }

  useEffect(() => {
    if (!previewRequest) return;
    previewEndUs.current = Math.min(durationUs, previewRequest.endUs);
    setPlayhead(Math.min(durationUs, previewRequest.startUs));
    setPlaying(true);
  }, [durationUs, previewRequest, setPlayhead]);

  useEffect(() => {
    if (!playing) return;
    const startedAt = performance.now();
    playbackAnchor.current = { timeMs: startedAt, playheadUs: useEditorStore.getState().playheadUs, lastCommitMs: startedAt };
    const intervalMs = previewFrameIntervalMs(useEditorStore.getState().project.canvas.fpsNumerator, useEditorStore.getState().project.canvas.fpsDenominator);
    const tick = (now: number) => {
      const nextPlayheadUs = playbackAnchor.current.playheadUs + (now - playbackAnchor.current.timeMs) * 1000;
      const playbackEndUs = previewEndUs.current ?? durationUs;
      if (nextPlayheadUs >= playbackEndUs) {
        setPlayhead(previewEndUs.current === null ? 0 : playbackEndUs);
        previewEndUs.current = null;
        setPlaying(false);
        return;
      }
      if (now - playbackAnchor.current.lastCommitMs >= intervalMs) {
        playbackAnchor.current.lastCommitMs = now;
        setPlayhead(nextPlayheadUs);
      }
      animationFrame.current = requestAnimationFrame(tick);
    };
    animationFrame.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current);
    };
  }, [durationUs, playing, setPlayhead]);

  return (
    <main className="editor-workspace">
      <div className="editor-main"><StableAssetPanel onImport={onImport} onGenerate={onGenerate} onMatchEffects={onMatchEffects} onTranscribe={onTranscribe} onExtractAudio={onExtractAudio} onExportAudio={onExportAudio} onRelink={onRelink} onCreateAudio={onCreateAudio} onManageEffects={onManageEffects} /><div className="preview-column"><StablePreviewCanvas onImport={onImport} onGenerate={onGenerate} playing={playing} /><div className="transport"><button type="button" aria-label="回到开头" onClick={() => { previewEndUs.current = null; setPlaying(false); setPlayhead(0); }}><SkipBack size={17} /></button><button className="play-button" type="button" aria-label={playing ? "暂停" : "播放"} onClick={togglePlayback}>{playing ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}</button><TransportTimecode durationUs={durationUs} /></div></div><StableInspectorPanel /></div>
      <StableTimeline />
    </main>
  );
}

function TransportTimecode({ durationUs }: { durationUs: number }) {
  const playheadUs = useEditorStore((state) => state.playheadUs);
  return <><span>{formatTime(playheadUs)}</span><span className="duration">/ {formatTime(durationUs)}</span></>;
}
