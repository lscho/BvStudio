import { Channel, invoke } from "@tauri-apps/api/core";
import type { LocalAsrConfig } from "@/services/storage";
import { timedTextSegments } from "@/domain/captions";

export interface AsrSegment {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export interface AsrTranscript {
  language: string;
  text: string;
  segments: AsrSegment[];
  device: string;
}

export interface AsrRuntimeStatus {
  ready: boolean;
  message: string;
}

export interface AsrModelInfo {
  repository: string;
  name: string;
  kind: "asr" | "aligner";
  recommended: boolean;
  installed: boolean;
  path: string;
  installedBytes: number;
}

export interface AsrJobEvent {
  jobId: string;
  phase: "manifest" | "downloading" | "verifying" | "runtime" | "ready";
  message: string;
  downloadedBytes: number;
  totalBytes: number;
  filesCompleted: number;
  filesTotal: number;
  currentFile?: string;
}

export interface AsrJob<T> {
  jobId: string;
  result: Promise<T>;
}

export interface AsrTranscriptionEvent {
  jobId: string;
  phase: "extracting" | "runtime" | "loading" | "transcribing" | "aligning" | "writing" | "ready";
  message: string;
  progress: number;
}

export function getAsrRuntimeStatus(pythonPath: string): Promise<AsrRuntimeStatus> {
  return invoke("asr_runtime_status", { pythonPath });
}

export function startMediaTranscription(path: string, config: LocalAsrConfig, onProgress: (event: AsrTranscriptionEvent) => void): AsrJob<AsrTranscript> {
  const jobId = crypto.randomUUID();
  const channel = new Channel<AsrTranscriptionEvent>();
  channel.onmessage = onProgress;
  return { jobId, result: invoke("transcribe_media", { path, config, jobId, onEvent: channel }) };
}

export function getAsrModelCatalog(): Promise<AsrModelInfo[]> {
  return invoke("asr_model_catalog");
}

function jobChannel(onProgress: (event: AsrJobEvent) => void) {
  const channel = new Channel<AsrJobEvent>();
  channel.onmessage = onProgress;
  return channel;
}

export function startAsrModelDownload(repository: string, onProgress: (event: AsrJobEvent) => void): AsrJob<string> {
  const jobId = crypto.randomUUID();
  return { jobId, result: invoke("download_asr_model", { repository, jobId, onEvent: jobChannel(onProgress) }) };
}

export function startAsrRuntimeInstall(pythonPath: string, onProgress: (event: AsrJobEvent) => void): AsrJob<string> {
  const jobId = crypto.randomUUID();
  return { jobId, result: invoke("install_asr_runtime", { pythonPath, jobId, onEvent: jobChannel(onProgress) }) };
}

export function cancelAsrJob(jobId: string): Promise<boolean> {
  return invoke("cancel_asr_job", { jobId });
}

export function removeAsrModel(repository: string): Promise<void> {
  return invoke("remove_asr_model", { repository });
}

export function fallbackSegments(text: string, durationUs: number): AsrSegment[] {
  return timedTextSegments(text, durationUs);
}

const SENTENCE_END = /[。！？!?；;.!](?:["'”’）》】」』]*)$/u;
const NO_SPACE_BEFORE = /^[,.;:!?%)}\]，。！？；：、）》】」』…'”’]/u;
const NO_SPACE_AFTER = /[(\[{（《【「『'“‘]$/u;
const ASCII_WORD = /[A-Za-z0-9]/u;
const CJK_CHARACTER = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const MAX_CUE_SECONDS = 5;
const LONG_PAUSE_SECONDS = 0.8;
const MAX_CUE_UNITS = 24;

function lastLexicalCharacter(text: string) {
  return Array.from(text).reverse().find((character) => /[\p{L}\p{N}]/u.test(character)) ?? "";
}

function joinCaptionText(current: string, next: string) {
  const left = current.trimEnd();
  const right = next.trimStart();
  if (!left) return right;
  if (!right) return left;
  if (NO_SPACE_BEFORE.test(right) || NO_SPACE_AFTER.test(left)) return `${left}${right}`;
  const previousWordCharacter = lastLexicalCharacter(left);
  return ASCII_WORD.test(previousWordCharacter) && ASCII_WORD.test(right[0]) ? `${left} ${right}` : `${left}${right}`;
}

function captionUnits(text: string) {
  return Array.from(text).reduce((total, character) => {
    if (/\s/u.test(character)) return total;
    return total + (CJK_CHARACTER.test(character) ? 1 : 0.5);
  }, 0);
}

function normalizedAlignedSegments(segments: AsrSegment[], durationSeconds: number) {
  return segments
    .map((segment) => {
      const startSeconds = Math.max(0, Number(segment.startSeconds));
      const endSeconds = Math.min(durationSeconds, Number(segment.endSeconds));
      return { startSeconds, endSeconds, text: String(segment.text ?? "").trim() };
    })
    .filter((segment) => Number.isFinite(segment.startSeconds)
      && Number.isFinite(segment.endSeconds)
      && segment.endSeconds > segment.startSeconds
      && Boolean(segment.text))
    .sort((left, right) => left.startSeconds - right.startSeconds || left.endSeconds - right.endSeconds);
}

/** Converts Qwen aligner word/character timestamps into readable subtitle cues. */
export function captionSegments(transcript: AsrTranscript, durationUs: number): AsrSegment[] {
  const durationSeconds = Number.isFinite(durationUs) && durationUs > 0 ? durationUs / 1_000_000 : Number.POSITIVE_INFINITY;
  const aligned = normalizedAlignedSegments(transcript.segments, durationSeconds);
  if (!aligned.length) return fallbackSegments(transcript.text, durationUs);

  const cues: AsrSegment[] = [];
  let cue: AsrSegment | null = null;
  const flush = () => {
    if (cue) cues.push(cue);
    cue = null;
  };

  for (const segment of aligned) {
    if (cue) {
      const gap = segment.startSeconds - cue.endSeconds;
      const joined = joinCaptionText(cue.text, segment.text);
      const joinedDuration = Math.max(cue.endSeconds, segment.endSeconds) - cue.startSeconds;
      if (gap >= LONG_PAUSE_SECONDS || joinedDuration > MAX_CUE_SECONDS || captionUnits(joined) > MAX_CUE_UNITS) flush();
    }

    if (!cue) {
      cue = { ...segment };
    } else {
      cue.text = joinCaptionText(cue.text, segment.text);
      cue.endSeconds = Math.max(cue.endSeconds, segment.endSeconds);
    }

    if (SENTENCE_END.test(cue.text)
      || cue.endSeconds - cue.startSeconds >= MAX_CUE_SECONDS
      || captionUnits(cue.text) >= MAX_CUE_UNITS) flush();
  }
  flush();
  return cues;
}
