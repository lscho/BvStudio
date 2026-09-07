import { invoke } from "@tauri-apps/api/core";
import { isDesktopRuntime } from "@/services/runtime";

export interface CompositionFrameSink {
  begin: () => Promise<string>;
  append: (sequenceId: string, index: number, data: string) => Promise<void>;
  release: (sequenceId: string) => Promise<void>;
}

export const desktopCompositionFrames: CompositionFrameSink = {
  begin() {
    if (!isDesktopRuntime()) throw new Error("动效导出需要在桌面客户端运行");
    return invoke<string>("begin_composition_frames");
  },
  append: (sequenceId, index, data) => invoke("append_composition_frame", { sequenceId, index, data }),
  release: (sequenceId) => invoke("release_composition_frames", { sequenceId })
};
