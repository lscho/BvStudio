import { invoke } from "@tauri-apps/api/core";
import { isDesktopRuntime } from "@/services/runtime";

export interface CompositionFrameSink {
  begin: () => Promise<string>;
  append: (sequenceId: string, index: number, data: string) => Promise<void>;
  appendBatch?: (sequenceId: string, startIndex: number, data: string[]) => Promise<void>;
  release: (sequenceId: string) => Promise<void>;
}

const frameBatchSize = 4;
const frameBatchCharacters = 32 * 1024 * 1024;

export function createCompositionFrameAppender(sink: CompositionFrameSink, sequenceId: string) {
  let startIndex = 0;
  let characters = 0;
  let frames: string[] = [];
  const flush = async () => {
    if (!frames.length || !sink.appendBatch) return;
    const batch = frames;
    frames = [];
    characters = 0;
    await sink.appendBatch(sequenceId, startIndex, batch);
  };
  return {
    async append(index: number, data: string) {
      if (!sink.appendBatch) {
        await sink.append(sequenceId, index, data);
        return;
      }
      if (frames.length && (index !== startIndex + frames.length || frames.length >= frameBatchSize || characters + data.length > frameBatchCharacters)) await flush();
      if (!frames.length) startIndex = index;
      frames.push(data);
      characters += data.length;
      if (frames.length >= frameBatchSize) await flush();
    },
    flush
  };
}

export const desktopCompositionFrames: CompositionFrameSink = {
  begin() {
    if (!isDesktopRuntime()) throw new Error("动效导出需要在桌面客户端运行");
    return invoke<string>("begin_composition_frames");
  },
  append: (sequenceId, index, data) => invoke("append_composition_frame", { sequenceId, index, data }),
  appendBatch: (sequenceId, startIndex, data) => invoke("append_composition_frames", { sequenceId, startIndex, data }),
  release: (sequenceId) => invoke("release_composition_frames", { sequenceId })
};
