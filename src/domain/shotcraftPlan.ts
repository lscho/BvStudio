import { z } from "zod";
import type { AudioClip, CompositionClip, EditorProject, MediaAsset, TimelineTrack } from "@/domain/project";
import { compositionById } from "@/domain/effects";
import { compositionBindingIssues, normalizeBindings } from "@/domain/compositions";
import { defaultShotcraftSettings, normalizeShotcraftSettings, SHOTCRAFT_SHOTS, SHOTCRAFT_TRANSITIONS, shotcraftEventTimeUs, shotcraftShot, shotcraftTransitionCutRatio } from "@/domain/shotcraft";
import { libraryShot } from "@/domain/shotcraftLibrary/catalog";
import audioCatalog from "@/domain/shotcraftLibrary/audioCatalog.json";
import anchorCatalog from "@/domain/shotcraftLibrary/anchors.json";
import { shotcraftImpactCount } from "@/domain/shotcraftLibrary/aiPolicy";
import { musicAnalysisSchema, musicCutPoints, type MusicAnalysis } from "@/domain/musicBeats";

interface ShotAnchor { key: string; frame: number; category: string }
export const SHOTCRAFT_ANCHORS: Readonly<Record<string, readonly ShotAnchor[]>> = anchorCatalog;
export const shotcraftPlanSchema = z.object({
  title: z.string().trim().min(1).max(80),
  scenes: z.array(z.object({
    shotId: z.enum(SHOTCRAFT_SHOTS.map((shot) => shot.id)),
    durationSeconds: z.number().min(1).max(30),
    text: z.string().max(2000),
    copy: z.array(z.object({ key: z.string().max(64), value: z.string().max(2000) }).strict()).max(48),
    bindings: z.array(z.object({ slotId: z.string().max(64), assetIds: z.array(z.string().max(256)).max(12) }).strict()).max(8),
    regions: z.array(z.object({ x: z.number().min(0).max(99), y: z.number().min(0).max(99), width: z.number().min(1).max(100), height: z.number().min(1).max(100) }).strict()).max(4),
    transition: z.enum(SHOTCRAFT_TRANSITIONS.map((item) => item.value)),
    sounds: z.array(z.object({ event: z.string().max(80), soundId: z.enum(audioCatalog.filter((sound) => sound.kind === "sound" && sound.autoEligible).map((sound) => sound.id)), volume: z.number().min(0).max(0.6) }).strict()).max(4),
    reason: z.string().max(400)
  }).strict()).min(1).max(40)
}).strict();
export type ShotcraftPlan = z.infer<typeof shotcraftPlanSchema>;
export function subtitleShotcraftScene(input: { compositionId: string; text: string; params?: readonly { key: string; value: string | number | boolean }[]; bindings?: readonly { slotId: string; assetIds: string[] }[]; durationSeconds: number; transition?: string; sounds?: readonly { event: string; soundId: string; volume: number }[] }): ShotcraftPlan["scenes"][number] {
  return { shotId: input.compositionId, durationSeconds: input.durationSeconds, text: input.text, copy: (libraryShot(input.compositionId)?.texts ?? []).map((field) => ({ key: field.key, value: String(input.params?.find((param) => param.key === field.key)?.value ?? "") })), bindings: [...(input.bindings ?? [])], regions: [], transition: input.transition ?? "none", sounds: [...(input.sounds ?? [])], reason: "依据字幕内容编排" } as ShotcraftPlan["scenes"][number];
}
export interface ShotcraftSequenceOptions { startUs: number; musicAssetId?: string; musicSourceInUs: number; musicVolume: number; beatSync: boolean; analysis?: MusicAnalysis; soundEnabled: boolean; fixedSceneDurations?: boolean; transitionFromClipId?: string }

export function validateShotcraftPlan(value: unknown, assets: readonly MediaAsset[]): ShotcraftPlan {
  const plan = shotcraftPlanSchema.parse(value);
  if (plan.scenes.reduce((duration, scene) => duration + scene.durationSeconds, 0) > 600) throw new Error("镜头计划超过 10 分钟，请减少内容后重试");
  const issues: { code: "custom"; path: (string | number)[]; message: string }[] = [];
  if (shotcraftImpactCount(plan.scenes) > 3) issues.push({ code: "custom", path: ["scenes"], message: "镜头内部冲击与闪白转场合计最多三处，请改用直接切换或平稳镜头" });
  for (const [index, scene] of plan.scenes.entries()) {
    const issue = (field: string, message: string) => issues.push({ code: "custom", path: ["scenes", index, field], message: `第 ${index + 1} 镜 ${scene.shotId}：${message}` });
    try { normalizeBindings(scene.bindings); }
    catch (error) { issue("bindings", error instanceof Error ? error.message : "素材槽无效"); }
    for (const message of compositionBindingIssues({ compositionId: scene.shotId, bindings: scene.bindings }, assets)) issue("bindings", message);
    const definition = libraryShot(scene.shotId);
    if (scene.shotId === "shotcraft-odometer-digit-roll" && !/^\d{2}\.\d{2}$/u.test(scene.copy.find((item) => item.key === "copy1")?.value ?? "")) issue("copy", "copy1 需要明确的两位整数和两位小数，例如 08.50");
    const keys = definition?.texts.map((field) => field.key) ?? [];
    const invalid = scene.copy.filter((field) => !keys.includes(field.key)).map((field) => field.key);
    const missing = keys.filter((key) => !scene.copy.some((field) => field.key === key));
    const duplicate = scene.copy.filter((field, i) => scene.copy.findIndex((other) => other.key === field.key) !== i).map((field) => field.key);
    if (invalid.length || missing.length || duplicate.length) {
      const details = [invalid.length ? `无效字段：${invalid.join(", ")}` : "", duplicate.length ? `重复字段：${duplicate.join(", ")}` : "", missing.length ? `缺少文案字段：${missing.join(", ")}` : ""].filter(Boolean);
      issue("copy", `${details.join("；")}。允许的文案字段：${keys.length ? `${keys.join(", ")}，每个恰好一次，不需要的文案填空字符串` : "无，copy 必须为 []"}`);
    }
    const defaults = defaultShotcraftSettings(scene.shotId);
    try { normalizeShotcraftSettings({ ...defaults, regions: scene.regions }, scene.shotId); }
    catch { issue("regions", `需要 ${defaults.regions.length} 个区域，x + width 与 y + height 均不得超过 100`); }
    const events = SHOTCRAFT_ANCHORS[scene.shotId]?.map((anchor) => anchor.key) ?? [];
    const invalidEvents = scene.sounds.filter((sound) => !events.includes(sound.event)).map((sound) => sound.event);
    if (invalidEvents.length) issue("sounds", `音效没有对应的镜头动作：${invalidEvents.join(", ")}；允许的 event：${events.join(", ") || "无，sounds 必须为 []"}`);
  }
  if (issues.length) throw new z.ZodError(issues);
  return plan;
}

function nearestInWindow(points: readonly number[], wanted: number, minimum: number, maximum: number) {
  let chosen: number | undefined, distance = Infinity;
  for (const point of points) { if (point < minimum) continue; if (point > maximum) break; if (Math.abs(point - wanted) < distance) { chosen = point; distance = Math.abs(point - wanted); } }
  return chosen;
}
export function compileShotcraftSequence(plan: ShotcraftPlan, assets: readonly MediaAsset[], options: ShotcraftSequenceOptions, newId: () => string) {
  validateShotcraftPlan(plan, assets);
  if (!Number.isSafeInteger(options.startUs) || options.startUs < 0 || !Number.isSafeInteger(options.musicSourceInUs) || options.musicSourceInUs < 0 || !Number.isFinite(options.musicVolume) || options.musicVolume < 0 || options.musicVolume > 1) throw new Error("镜头起点或音乐参数无效");
  const track: TimelineTrack = { id: newId(), kind: "composition", name: `镜头 · ${plan.title}`, locked: false, hidden: false, muted: false, clips: [] };
  const soundTrack: TimelineTrack = { id: newId(), kind: "audio", audioRole: "sound", name: `音效 · ${plan.title}`, locked: false, hidden: false, muted: false, clips: [] };
  const musicTrack: TimelineTrack = { id: newId(), kind: "audio", audioRole: "music", name: `音乐 · ${plan.title}`, locked: false, hidden: false, muted: false, clips: [] };
  const music = options.musicAssetId ? assets.find((asset) => asset.id === options.musicAssetId && asset.kind === "audio" && !asset.missing) : undefined;
  if (options.musicAssetId && !music) throw new Error("选中的音乐已经移除，请重新选择");
  const analysis = options.beatSync && options.analysis ? musicAnalysisSchema.parse(options.analysis) : undefined;
  if (analysis && music && Math.abs(analysis.durationUs - music.durationUs) > 150_000) throw new Error("音乐分析与素材时长不一致，请重新分析");
  if (options.beatSync && (!music || !analysis)) throw new Error("请先选择音乐并完成拍点分析");
  const points = analysis ? musicCutPoints(analysis).map((time) => time - options.musicSourceInUs).filter((time) => time >= 0) : [];
  if (analysis && points.length < 2) throw new Error("所选音乐片段没有足够拍点，请换一段音乐或关闭卡点");
  const warnings: string[] = [];
  const transitions = plan.scenes.map((scene, index) => (index > 0 || options.transitionFromClipId) && scene.transition !== "none" ? Math.min(800_000, Math.round(scene.durationSeconds * 250_000)) : 0);
  let cursor = 0, previous: CompositionClip | undefined, impactCount = 0, lastSoundUs = -Infinity;
  for (const [sceneIndex, scene] of plan.scenes.entries()) {
    const shot = shotcraftShot(scene.shotId)!;
    const definition = compositionById(scene.shotId);
    const requested = Math.round(scene.durationSeconds * 1_000_000);
    const next = plan.scenes[sceneIndex + 1];
    const nextCutOffset = next ? Math.round(transitions[sceneIndex + 1] * shotcraftTransitionCutRatio(next.transition)) : 0;
    const cut = analysis && !options.fixedSceneDurations ? nearestInWindow(points, cursor + requested + nextCutOffset, cursor + Math.max(1_000_000, requested * 0.75) + nextCutOffset, cursor + requested * 1.25 + nextCutOffset) : cursor + requested + nextCutOffset;
    if (cut === undefined) throw new Error(`第 ${sceneIndex + 1} 镜附近没有有效拍点，请调整时长、音乐起点或关闭卡点`);
    const end = cut - nextCutOffset;
    const durationUs = Math.round(end - cursor);
    const settings = defaultShotcraftSettings(scene.shotId);
    settings.regions = scene.regions;
    settings.leadInUs = transitions[sceneIndex];
    settings.holdUs = ["shotcraft-logo-shrink-wordmark-lockup", "shotcraft-timeline-travel"].includes(scene.shotId) ? 1_000_000 : 500_000;
    const motionDurationUs = durationUs - settings.leadInUs - settings.holdUs;
    if (motionDurationUs < 500_000) throw new Error("镜头时长不足以完成转场和阅读停留，请增加时长");
    const anchors = [...(SHOTCRAFT_ANCHORS[scene.shotId] ?? [])].sort((a, b) => a.frame - b.frame);
    const timeMap = [{ timeUs: 0, frame: 0 }];
    if (analysis) {
      for (const anchor of anchors) {
        if (anchor.frame <= 0 || anchor.frame >= shot.frames - 15) continue;
        const holdBefore = anchor.frame > shot.holdFrame ? settings.holdUs : 0;
        const wanted = cursor + settings.leadInUs + anchor.frame / shot.frames * motionDurationUs + holdBefore;
        const last = timeMap.at(-1)!;
        const matched = nearestInWindow(points, wanted, Math.max(cursor + settings.leadInUs + last.timeUs + holdBefore + 100_000, wanted - 200_000), Math.min(cursor + settings.leadInUs + motionDurationUs + holdBefore - 100_000, wanted + 200_000));
        if (matched === undefined) { if (anchor.key !== "settled") warnings.push(`第 ${sceneIndex + 1} 镜「${anchor.key}」附近无拍点，保留动作时序`); continue; }
        const timeUs = matched - cursor - settings.leadInUs - holdBefore;
        if (timeUs > last.timeUs && timeUs < motionDurationUs && anchor.frame > last.frame) timeMap.push({ timeUs: Math.round(timeUs), frame: anchor.frame });
      }
    }
    timeMap.push({ timeUs: motionDurationUs, frame: shot.frames }); settings.timeMap = timeMap;
    const transitionFromClipId = previous?.id ?? (sceneIndex === 0 ? options.transitionFromClipId : undefined);
    if (transitionFromClipId && scene.transition !== "none") settings.transition = { preset: scene.transition, durationUs: transitions[sceneIndex], fromClipId: transitionFromClipId };
    const clip: CompositionClip = {
      id: newId(), trackId: track.id, kind: "composition", label: shot.name, startUs: options.startUs + cursor, durationUs, locked: false,
      compositionId: shot.id, text: scene.text, params: { ...definition.defaultParams, ...Object.fromEntries(scene.copy.map((field) => [field.key, field.value])) },
      bindings: scene.bindings, color: definition.defaultColor, accentColor: definition.defaultAccentColor, fontSize: 64, speed: 1,
      sourceOffsetUs: 0, animationDurationUs: durationUs, transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }, recipe: structuredClone(definition.recipe),
      shotcraft: normalizeShotcraftSettings(settings, shot.id), zIndex: 220
    };
    track.clips.push(clip); previous = clip;
    if (options.soundEnabled) {
      for (const cue of [...scene.sounds].sort((a, b) => (anchors.find((anchor) => anchor.key === a.event)?.frame ?? 0) - (anchors.find((anchor) => anchor.key === b.event)?.frame ?? 0))) {
        const sound = assets.find((asset) => asset.id === cue.soundId && asset.kind === "audio" && !asset.missing);
        const info = audioCatalog.find((item) => item.id === cue.soundId);
        const anchor = anchors.find((item) => item.key === cue.event);
        if (!sound || !info || !anchor) throw new Error("音效素材尚未准备，请重新生成编排");
        if (info.category === "impact" && impactCount >= 3) continue;
        const eventUs = clip.startUs + shotcraftEventTimeUs(shot.id, anchor.frame, settings);
        if (eventUs - lastSoundUs < 400_000) continue;
        if (info.category === "impact") impactCount += 1;
        lastSoundUs = eventUs;
        const peakUs = info.sourcePeakUs ?? 0;
        const trimUs = info.sourceStartUs ?? 0;
        const sourceInUs = Math.max(trimUs, peakUs - (eventUs - options.startUs));
        const startUs = eventUs - (peakUs - sourceInUs);
        const sourceEndUs = Math.min(sound.durationUs, info.sourceEndUs ?? sound.durationUs, peakUs + 2_500_000);
        const audio: AudioClip = { id: newId(), trackId: soundTrack.id, kind: "audio", label: sound.name, startUs, durationUs: Math.max(0, sourceEndUs - sourceInUs), locked: false, assetId: sound.id, sourceInUs, playbackRate: 1, volume: cue.volume, fadeInUs: 5_000, fadeOutUs: 80_000, role: "sound" };
        if (audio.durationUs >= 50_000) { audio.fadeOutUs = Math.min(audio.fadeOutUs, audio.durationUs / 2); soundTrack.clips.push(audio); }
      }
    }
    cursor = end;
  }
  soundTrack.clips = soundTrack.clips.filter((clip) => clip.startUs < options.startUs + cursor).map((clip) => {
    const durationUs = Math.min(clip.durationUs, options.startUs + cursor - clip.startUs);
    return clip.kind === "audio" ? { ...clip, durationUs, fadeInUs: Math.min(clip.fadeInUs, Math.floor(durationUs / 2)), fadeOutUs: Math.min(clip.fadeOutUs, Math.floor(durationUs / 2)) } : clip;
  });
  if (music) {
    if (music.durationUs - options.musicSourceInUs < cursor) throw new Error("音乐剩余长度不足，请换一段更长的音乐或减少镜头");
    musicTrack.clips.push({ id: newId(), trackId: musicTrack.id, kind: "audio", label: music.name, startUs: options.startUs, durationUs: cursor, locked: false, assetId: music.id, sourceInUs: options.musicSourceInUs, playbackRate: 1, volume: options.musicVolume, fadeInUs: Math.min(500_000, Math.floor(cursor / 8)), fadeOutUs: Math.min(1_500_000, Math.floor(cursor / 4)), role: "music" });
  }
  return { tracks: [track, soundTrack, musicTrack].filter((item) => item.clips.length), durationUs: cursor, warnings };
}

export function appendShotcraftSequence(project: EditorProject, plan: ShotcraftPlan, extraAssets: readonly MediaAsset[], options: ShotcraftSequenceOptions, newId: () => string) {
  const assets = [...project.assets];
  for (const asset of extraAssets) {
    const index = assets.findIndex((item) => item.id === asset.id);
    if (index < 0) assets.push(asset);
    else if (assets[index].missing && !asset.missing) assets[index] = asset;
  }
  const result = compileShotcraftSequence(plan, assets, options, newId);
  project.assets = assets; project.tracks.push(...result.tracks);
  if (options.analysis && options.musicAssetId) project.musicAnalyses = [...(project.musicAnalyses ?? []).filter((item) => item.assetId !== options.musicAssetId).slice(-15), { assetId: options.musicAssetId, analysis: options.analysis }];
  return result;
}
