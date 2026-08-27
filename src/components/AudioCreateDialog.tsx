import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { AudioLines, LoaderCircle, Mic, Square, Volume2, X } from "lucide-react";
import { isDesktopRuntime } from "@/services/runtime";
import { listSystemVoices, preferredRecordingMimeType, saveRecordedAudio, synthesizeSpeech, type SystemVoice } from "@/services/audio";
import type { AudioRole } from "@/domain/project";

export interface CreatedAudioSource {
  path?: string;
  blob?: Blob;
  name: string;
  role: AudioRole;
}

interface Props {
  open: boolean;
  defaultText: string;
  onOpenChange: (open: boolean) => void;
  onCreated: (source: CreatedAudioSource) => Promise<void>;
}

export function AudioCreateDialog({ open, defaultText, onOpenChange, onCreated }: Props) {
  const [text, setText] = useState(defaultText);
  const [voices, setVoices] = useState<SystemVoice[]>([]);
  const [voice, setVoice] = useState("");
  const [rate, setRate] = useState(190);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!open) return;
    setText(defaultText);
    setError("");
    if (isDesktopRuntime()) void listSystemVoices().then(setVoices).catch(() => setVoices([]));
  }, [defaultText, open]);

  useEffect(() => {
    if (!recording) return;
    const startedAt = Date.now() - elapsed * 1_000;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1_000)), 250);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => () => {
    recorderRef.current?.state !== "inactive" && recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function createSpeech() {
    if (!text.trim()) { setError("请输入配音文字"); return; }
    setBusy(true);
    setError("");
    try {
      const path = await synthesizeSpeech(text.trim(), voice, rate);
      await onCreated({ path, name: "AI 配音", role: "voice" });
      onOpenChange(false);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "配音生成失败");
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("当前环境不支持麦克风录音");
      return;
    }
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const mimeType = preferredRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onerror = () => setError("录音过程中发生错误");
      recorder.start(500);
      setElapsed(0);
      setRecording(true);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "无法访问麦克风");
    }
  }

  async function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    setBusy(true);
    setRecording(false);
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        recorder.onerror = () => reject(new Error("录音过程中发生错误"));
        recorder.onstop = () => resolve(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
        recorder.stop();
      });
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const source = isDesktopRuntime()
        ? { path: await saveRecordedAudio(blob), name: "麦克风录音", role: "voice" as const }
        : { blob, name: "麦克风录音", role: "voice" as const };
      await onCreated(source);
      onOpenChange(false);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "录音保存失败");
    } finally {
      recorderRef.current = null;
      streamRef.current = null;
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(value) => { if (!recording && !busy) onOpenChange(value); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content audio-dialog" aria-describedby="audio-description">
          <Dialog.Close className="icon-button dialog-close" aria-label="关闭" disabled={recording || busy}><X size={18} /></Dialog.Close>
          <Dialog.Title>配音与录音</Dialog.Title>
          <Dialog.Description id="audio-description">创建的人声会加入当前播放头。</Dialog.Description>
          <Tabs.Root defaultValue="tts" className="audio-tabs">
            <Tabs.List aria-label="音频创建方式"><Tabs.Trigger value="tts"><Volume2 size={15} />系统配音</Tabs.Trigger><Tabs.Trigger value="record"><Mic size={15} />麦克风</Tabs.Trigger></Tabs.List>
            <Tabs.Content value="tts" className="audio-tab-content">
              <label><span>配音文字</span><textarea rows={7} value={text} onChange={(event) => setText(event.target.value)} /></label>
              <div className="two-column"><label><span>系统声音</span><select value={voice} onChange={(event) => setVoice(event.target.value)}><option value="">系统默认</option>{voices.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.language}</option>)}</select></label><label className="range-field"><span>语速<output>{rate}</output></span><input type="range" min={80} max={350} step={5} value={rate} onChange={(event) => setRate(Number(event.target.value))} /></label></div>
              <button className="button primary" type="button" disabled={busy || !isDesktopRuntime()} onClick={() => void createSpeech()}>{busy ? <LoaderCircle className="spin" size={15} /> : <AudioLines size={15} />}生成并加入</button>
            </Tabs.Content>
            <Tabs.Content value="record" className="audio-tab-content record-pane">
              <div className={`record-status ${recording ? "active" : ""}`}><span /><strong>{recording ? "正在录音" : "麦克风就绪"}</strong><time>{String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}</time></div>
              {recording ? <button className="button primary record-stop" type="button" onClick={() => void stopRecording()}><Square size={14} fill="currentColor" />停止并加入</button> : <button className="button primary" type="button" disabled={busy} onClick={() => void startRecording()}><Mic size={15} />开始录音</button>}
            </Tabs.Content>
          </Tabs.Root>
          {error && <p className="error-text" role="alert">{error}</p>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
