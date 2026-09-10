import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Select } from "@/components/Select";
import { parseStoryboardCues, type StoryboardOptions } from "@/domain/storyboard";

interface Props { open: boolean; onOpenChange: (open: boolean) => void; onGenerate: (options: StoryboardOptions) => void; subtitleCount: number; durationSeconds: number }

export function SubtitleStoryboardDialog({ open, onOpenChange, onGenerate, subtitleCount, durationSeconds }: Props) {
  const [mode, setMode] = useState<StoryboardOptions["mode"]>("auto");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal>
    <Dialog.Overlay className="dialog-overlay" />
    <Dialog.Content className="dialog-content shotcraft-planner" aria-describedby="subtitle-storyboard-description">
      <Dialog.Close type="button" className="icon-button dialog-close" aria-label="关闭字幕分镜"><X size={18} /></Dialog.Close>
      <Dialog.Title>按字幕编排镜头与动效</Dialog.Title>
      <Dialog.Description id="subtitle-storyboard-description">根据 {subtitleCount} 条字幕、素材和已有画面编排，保留原口播音轨。</Dialog.Description>
      <form className="settings-form" onSubmit={(event) => {
        event.preventDefault();
        try {
          const cues = parseStoryboardCues(prompt, durationSeconds);
          if (mode !== "auto" && cues.some((cue) => cue.role !== mode)) throw new Error("时间要求与纯模式冲突，请调整模式或要求");
          setError("");onGenerate({ mode, prompt: prompt.trim() });onOpenChange(false);
        } catch (exception) { setError(exception instanceof Error ? exception.message : "请检查分镜要求"); }
      }}>
        <label><span>画面模式</span><Select label="分镜画面模式" value={mode} options={[{ value: "auto", label: "自动混合 A-roll / B-roll" }, { value: "a-roll", label: "纯 A-roll · 口播为主" }, { value: "b-roll", label: "纯 B-roll · 补充画面" }]} onChange={(value) => { if (value === "auto" || value === "a-roll" || value === "b-roll") setMode(value); }} /></label>
        <label><span>分镜要求</span><textarea rows={5} maxLength={4000} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="例如：0-5秒 A-roll 保留口播；5-12秒 B-roll 用产品截图解释痛点。对比处用前后对比镜头，重点词与字幕一致。" /></label>
        <p className="muted">时间使用工程时间，按字幕中点归属并对齐字幕边界。纯 A-roll 需要时间线已有主叙事视频。</p>
        {error && <p role="alert" className="error-callout">{error}</p>}
        {!subtitleCount && <p role="status">请先识别或导入字幕；选中部分字幕可只编排所选段落。</p>}
        <div className="dialog-actions"><button type="button" className="button secondary" onClick={() => onOpenChange(false)}>取消</button><button type="submit" className="button primary" disabled={!subtitleCount}>按字幕生成分镜</button></div>
      </form>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
