import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ListTree, Plus, Trash2, WandSparkles, X } from "lucide-react";
import { contentEndUs, type ChapterMarker } from "@/domain/project";
import { autoChapterMarkers } from "@/domain/videoDecorations";
import { useEditorStore } from "@/stores/editorStore";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChapterProgressDialog({ open, onOpenChange }: Props) {
  const project = useEditorStore((state) => state.project);
  const updateChapterProgress = useEditorStore((state) => state.updateChapterProgress);
  const [enabled, setEnabled] = useState(false);
  const [chapterCount, setChapterCount] = useState(4);
  const [chapters, setChapters] = useState<ChapterMarker[]>([]);
  const [backgroundColor, setBackgroundColor] = useState("#111316");
  const [activeColor, setActiveColor] = useState("#ffb84d");
  const [textColor, setTextColor] = useState("#ffffff");
  const [height, setHeight] = useState(52);
  const subtitles = useMemo(() => project.tracks.flatMap((track) => track.clips).filter((clip) => clip.kind === "subtitle"), [project.tracks]);
  const durationUs = Math.max(contentEndUs(project), subtitles.at(-1)?.startUs ?? 0, 1_000_000);

  useEffect(() => {
    if (!open) return;
    setEnabled(project.chapterProgress.enabled);
    setChapters(structuredClone(project.chapterProgress.chapters));
    setChapterCount(Math.max(2, Math.min(6, project.chapterProgress.chapters.length || 4)));
    setBackgroundColor(project.chapterProgress.backgroundColor);
    setActiveColor(project.chapterProgress.activeColor);
    setTextColor(project.chapterProgress.textColor);
    setHeight(project.chapterProgress.height);
  }, [open, project.chapterProgress]);

  function generateChapters() {
    setChapters(autoChapterMarkers(subtitles, durationUs, chapterCount));
    setEnabled(true);
  }

  function patchChapter(id: string, patch: Partial<ChapterMarker>) {
    setChapters((current) => current.map((chapter) => chapter.id === id ? { ...chapter, ...patch } : chapter).sort((left, right) => left.startUs - right.startUs));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    updateChapterProgress({ enabled, chapters, backgroundColor, activeColor, textColor, height });
    onOpenChange(false);
  }

  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="dialog-overlay" />
      <Dialog.Content className="dialog-content chapter-dialog" aria-describedby="chapter-description">
        <Dialog.Close className="icon-button dialog-close" aria-label="关闭"><X size={18} /></Dialog.Close>
        <div className="dialog-title-row"><ListTree size={18} /><div><Dialog.Title>顶部章节进度</Dialog.Title><Dialog.Description id="chapter-description">按时间字幕自动分段，也可以手动修改章节标题与起点。</Dialog.Description></div></div>
        <form onSubmit={submit}>
          <label className="check-row"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /><span>在视频顶部显示章节进度</span></label>
          <div className="chapter-auto-row">
            <label><span>章节数量</span><select aria-label="章节数量" value={chapterCount} onChange={(event) => setChapterCount(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count} 段</option>)}</select></label>
            <button className="button secondary" type="button" onClick={generateChapters}><WandSparkles size={14} />按字幕分段</button>
          </div>
          <div className="chapter-list" aria-label="章节列表">
            {chapters.map((chapter, index) => <div className="chapter-row" key={chapter.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <label><span className="visually-hidden">章节 {index + 1} 标题</span><input aria-label={`章节 ${index + 1} 标题`} value={chapter.title} maxLength={24} onChange={(event) => patchChapter(chapter.id, { title: event.target.value })} /></label>
              <label className="chapter-time"><span className="visually-hidden">章节 {index + 1} 开始时间</span><input aria-label={`章节 ${index + 1} 开始时间`} type="number" min={0} max={durationUs / 1_000_000} step="any" value={Number((chapter.startUs / 1_000_000).toFixed(3))} onChange={(event) => patchChapter(chapter.id, { startUs: Math.round(Number(event.target.value) * 1_000_000) })} /><i>s</i></label>
              <button type="button" aria-label={`删除章节 ${index + 1}`} title="删除章节" onClick={() => setChapters((current) => current.filter((item) => item.id !== chapter.id))}><Trash2 size={14} /></button>
            </div>)}
            {!chapters.length && <p className="chapter-empty">暂无章节</p>}
          </div>
          <button className="chapter-add" type="button" disabled={chapters.length >= 6} onClick={() => setChapters((current) => [...current, { id: crypto.randomUUID(), title: `章节 ${current.length + 1}`, startUs: Math.round(durationUs * current.length / Math.max(1, current.length + 1)) }].sort((left, right) => left.startUs - right.startUs))}><Plus size={14} />添加章节</button>
          <div className="chapter-appearance">
            <label><span>背景</span><input type="color" value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} /></label>
            <label><span>当前章节</span><input type="color" value={activeColor} onChange={(event) => setActiveColor(event.target.value)} /></label>
            <label><span>文字</span><input type="color" value={textColor} onChange={(event) => setTextColor(event.target.value)} /></label>
            <label><span>高度</span><input type="number" min={28} max={120} step={1} value={height} onChange={(event) => setHeight(Number(event.target.value))} /><i>px</i></label>
          </div>
          <div className="dialog-actions"><Dialog.Close className="button secondary" type="button">取消</Dialog.Close><button className="button primary" type="submit">应用</button></div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
