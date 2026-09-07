import { open } from "@tauri-apps/plugin-dialog";
import { localMediaUrl } from "@/services/media";
import { isDesktopRuntime } from "@/services/runtime";
import type { MediaAsset } from "@/domain/project";
import type { CompositionSlot } from "@/domain/compositions";
import { loadCompositionVideo, releaseCompositionVideo } from "@/services/compositionVideo";

export async function importCompositionImages(files?: FileList | File[], maximum = 12, kind: CompositionSlot["kind"] = "image"): Promise<MediaAsset[]> {
  const quantity = kind === "image" ? "张图片" : kind === "video" ? "个视频" : "个素材";
  let inputs: { name: string; url: string; path?: string; video: boolean }[];
  if (files) {
    if (files.length > maximum) throw new Error(`当前素材槽最多还能添加 ${maximum} ${quantity}`);
    if (Array.from(files).some((file) => kind === "image" ? !/^image\//u.test(file.type) : kind === "video" ? !/^video\//u.test(file.type) : !/^image\//u.test(file.type) && !/^video\//u.test(file.type))) throw new Error(kind === "image" ? "请选择 PNG、JPEG 或 WebP 图片" : kind === "video" ? "请选择 MP4、MOV 或 WebM 视频" : "请选择图片或视频文件");
    inputs = Array.from(files).map((file) => ({ name: file.name, url: URL.createObjectURL(file), video: /^video\//u.test(file.type) }));
  } else {
    if (!isDesktopRuntime()) return [];
    const imageExtensions = ["png", "jpg", "jpeg", "webp", "bmp"];
    const videoExtensions = ["mp4", "mov", "webm", "m4v"];
    const selected = await open({ multiple: maximum > 1, directory: false, filters: [{ name: kind === "image" ? "图片" : kind === "video" ? "视频" : "图片或视频", extensions: kind === "image" ? imageExtensions : kind === "video" ? videoExtensions : [...imageExtensions, ...videoExtensions] }] });
    const paths = selected ? Array.isArray(selected) ? selected : [selected] : [];
    if (paths.length > maximum) throw new Error(`当前素材槽最多还能添加 ${maximum} ${quantity}`);
    inputs = paths.map((path) => ({ name: path.split(/[\\/]/u).at(-1) ?? "素材", url: localMediaUrl(path), path, video: /\.(mp4|mov|webm|m4v)$/iu.test(path) }));
  }
  try {
    const assets: MediaAsset[] = [];
    for (const input of inputs) {
      if (input.video) {
        const video = await loadCompositionVideo(input.url);
        assets.push({ id: crypto.randomUUID(), name: input.name, kind: "video", durationUs: Math.round(video.duration * 1_000_000), sourcePath: input.path, objectUrl: input.url, width: video.videoWidth, height: video.videoHeight, hasAudio: false, missing: false });
        releaseCompositionVideo(video);
        continue;
      }
      const image = new Image();
      image.src = input.url;
      await image.decode();
      if (!image.naturalWidth || !image.naturalHeight) throw new Error("图片尺寸无效");
      assets.push({ id: crypto.randomUUID(), name: input.name, kind: "image", durationUs: 5_000_000, sourcePath: input.path, objectUrl: input.url, width: image.naturalWidth, height: image.naturalHeight, hasAudio: false, missing: false });
    }
    return assets;
  } catch {
    inputs.filter((input) => !input.path).forEach((input) => URL.revokeObjectURL(input.url));
    throw new Error(kind === "image" ? "图片无法读取，请重新选择 PNG、JPEG 或 WebP 文件" : kind === "video" ? "视频无法读取，请选择 H.264 MP4、MOV 或 WebM 视频" : "素材无法读取，请选择图片或 H.264 MP4 / WebM 视频");
  }
}
