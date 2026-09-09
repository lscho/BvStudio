import { afterEach, expect, it, vi } from "vitest";
import { loadShotcraftAudio, previewShotcraftAudio, stopShotcraftAudioPreview } from "@/services/shotcraftAudio";
import catalog from "@/domain/shotcraftLibrary/audioCatalog.json";

afterEach(() => { stopShotcraftAudioPreview(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("拒绝缺失或校验不一致的音频素材", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]))));
  await expect(loadShotcraftAudio(catalog[0].id)).rejects.toThrow("素材未准备");
  await expect(loadShotcraftAudio(catalog[0].id)).rejects.toThrow("版本不一致");
});

it("试听结束复位，取消会停止已开始的音频", async () => {
  const item = catalog[1];
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]))));
  vi.spyOn(crypto.subtle, "digest").mockResolvedValue(Uint8Array.from(item.sha256.match(/../gu)!, (byte) => parseInt(byte, 16)).buffer);
  vi.stubGlobal("URL", class extends URL { static createObjectURL() { return "blob:audio-test"; } });
  const instances: AudioProbe[] = [];
  class AudioProbe extends EventTarget {
    play = vi.fn().mockResolvedValue(undefined);
    pause = vi.fn();
    constructor() { super(); instances.push(this); }
  }
  vi.stubGlobal("Audio", AudioProbe);
  const ended = vi.fn();
  await previewShotcraftAudio(item.id, undefined, ended);
  instances[0].dispatchEvent(new Event("ended"));
  expect(ended).toHaveBeenCalledOnce();
  expect(instances[0].pause).toHaveBeenCalledOnce();
  const controller = new AbortController();
  await previewShotcraftAudio(item.id, controller.signal);
  controller.abort();
  expect(instances[1].pause).toHaveBeenCalledOnce();
});
