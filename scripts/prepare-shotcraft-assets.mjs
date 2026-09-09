import { readFile, mkdir, copyFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export async function prepareShotcraftAssets(source, destination, catalog) {
  if (!source) throw new Error("请提供本地 video-shotcraft 目录：npm run prepare:shotcraft-assets -- <目录>");
  if (!Array.isArray(catalog) || catalog.length > 200) throw new Error("音频清单无效");
  for (const item of catalog) {
    if (!item || typeof item.file !== "string" || !/^(?:sfx\/[a-z]+|bgm)\/[a-z0-9-]+\.mp3$/u.test(item.file) || !/^[a-f0-9]{64}$/u.test(item.sha256)) throw new Error("音频清单路径或校验值无效");
    const input = join(resolve(source), "assets/audio", item.file);
    await access(input);
    const bytes = await readFile(input);
    if (createHash("sha256").update(bytes).digest("hex") !== item.sha256) throw new Error(`音频与迁移版本不一致：${item.file}`);
  }
  for (const item of catalog) {
    const target = join(destination, item.file);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(resolve(source), "assets/audio", item.file), target);
  }
  return catalog.length;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const catalog = JSON.parse(await readFile(join(root, "src/domain/shotcraftLibrary/audioCatalog.json"), "utf8"));
  const count = await prepareShotcraftAssets(process.argv[2] || process.env.SHOTCRAFT_SOURCE, join(root, "public/shotcraft-audio"), catalog);
  console.log(`已准备 ${count} 个 Shotcraft 音频素材。二进制不加入 Git。`);
}
