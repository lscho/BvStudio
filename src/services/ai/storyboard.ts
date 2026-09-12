import { z } from "zod";
import { compositionById } from "@/domain/effects";
import { isBackgroundComposition } from "@/domain/compositions";
import { defaultShotcraftSettings, isShotcraftComposition } from "@/domain/shotcraft";
import { subtitleShotcraftScene, validateShotcraftPlan } from "@/domain/shotcraftPlan";
import { shotcraftAdaptationIssue, shotcraftContentIssues, shotcraftImpactCount } from "@/domain/shotcraftLibrary/aiPolicy";
import { parseStoryboardCues, storyboardEffectAllowed, storyboardInformationCardIssue, storyboardRoleAt, storyboardShotcraftCardAllowed } from "@/domain/storyboard";
import type { MatchTimelineMotionInput } from "@/services/ai/provider";
import type { AiMotionMatch, AiMotionSelection } from "@/services/ai/schema";

export function subtitleShotcraftEligible(id: string) {
  return isShotcraftComposition(id) && !shotcraftAdaptationIssue(id) && defaultShotcraftSettings(id).regions.length === 0;
}

export function storyboardFullFrameEffect(id: string) {
  return isShotcraftComposition(id) || id === "still-image-motion" || isBackgroundComposition(id);
}

export function shotcraftSceneForMatch(match: AiMotionMatch, durationSeconds: number) {
  const id = match.primaryEffectId ?? "";
  return subtitleShotcraftScene({ compositionId: id, durationSeconds, text: match.primaryText, params: match.primaryParams, bindings: match.compositionBindings, transition: match.shotcraftTransition, sounds: match.shotcraftSounds });
}

/** Check both the resolved selection and the final timeline so normalization cannot silently remove a card. */
export function assertStoryboardCardCoverage(selection: AiMotionSelection, input: MatchTimelineMotionInput, matches?: readonly AiMotionMatch[]) {
  if (input.storyboard?.mode !== "auto") return;
  const issues: z.core.$ZodIssue[] = [];
  for (const [index, segment] of selection.segments.entries()) {
    if (segment.roll !== "b-roll" || !segment.primaryEffectId || !isShotcraftComposition(segment.primaryEffectId)) continue;
    const hasInformation = !["ambient", "transition"].includes(segment.intent) || segment.evidenceKinds.some((kind) => kind !== "none");
    if (!hasInformation || !input.captions.slice(segment.startCaptionIndex, segment.endCaptionIndex + 1).some((caption) => caption.text.trim())) continue;
    const cardId = segment.secondaryEffectId;
    if (!cardId || !storyboardShotcraftCardAllowed(segment.primaryEffectId, cardId)) {
      issues.push({ code: "custom", path: ["segments", index, "secondaryEffectId"], message: `语义段“${segment.title}”的全屏 Shotcraft 必须叠加一张信息卡。请从允许目录中选择卡片/数据/布局动效，内容依据该段字幕；没有明确数值时使用清单、对比、流程或结论，禁止编造数字。` });
    } else if (matches && !matches.some((match) => match.captionIndex >= segment.startCaptionIndex && match.captionIndex <= segment.endCaptionIndex
      && ((match.primaryEffectId === cardId && match.primaryText.trim()) || (match.secondaryEffectId === cardId && match.secondaryText?.trim())))) {
      issues.push({ code: "custom", path: ["matches"], message: `语义段“${segment.title}”的信息卡未生成或缺少文案。请生成已选 ${cardId} 的字幕事实文案和结构参数，并与 Shotcraft 底层共同保持到段末；不要只返回底层镜头。` });
    }
  }
  if (issues.length) throw new z.ZodError(issues);
}

export function assertStoryboardSelection(selection: AiMotionSelection, input: MatchTimelineMotionInput, allowedOverlayIds?: readonly string[]) {
  if (!input.storyboard) return;
  const options = input.storyboard;
  const cues = parseStoryboardCues(options.prompt, input.timelineDurationSeconds);
  const issues: z.core.$ZodIssue[] = [];
  for (const [index, segment] of selection.segments.entries()) {
    const fail = (message: string) => issues.push({ code: "custom", path: ["segments", index], message });
    if (!segment.roll) { fail("必须根据内容明确 roll=a-roll 或 b-roll"); continue; }
    const captions = input.captions.slice(segment.startCaptionIndex, segment.endCaptionIndex + 1);
    if (captions.some((caption) => { const role = storyboardRoleAt(caption, options, cues); return role && role !== segment.roll; })) fail("画面角色与指定时间段或纯模式不一致，请在字幕边界拆分段落");
    if (segment.roll === "a-roll" && captions.some((caption) => !(input.timelineVisuals ?? []).some((visual) => ["a-roll", "presenter"].includes(visual.role) && visual.startSeconds <= caption.startSeconds && visual.endSeconds >= caption.endSeconds))) fail("该段没有持续覆盖的 A-roll 主叙事视频，请选 B-roll 或先放入口播素材");
    for (const id of [segment.primaryEffectId, segment.secondaryEffectId].filter((id): id is string => Boolean(id))) {
      if (!storyboardEffectAllowed(id, segment.roll)) fail(`${id} 不适合 ${segment.roll}，请按画面角色重选动效`);
      if (isShotcraftComposition(id)) {
        if (id !== segment.primaryEffectId) { fail(`${id} 是 Shotcraft 全屏镜头，只能作为主镜头`); continue; }
        if (segment.secondaryEffectId) {
          if (options.mode !== "auto") fail("只有自动混合 A/B-roll 可在 Shotcraft 上叠加一张无素材的信息卡片");
          else if (segment.roll !== "b-roll") fail("Shotcraft 叠卡只适用于 B-roll 段，A-roll 段应保留口播画面并重选动效");
          else {
            const reason = storyboardInformationCardIssue(segment.secondaryEffectId);
            if (reason) issues.push({ code: "custom", path: ["segments", index, "secondaryEffectId"], message: `当前已是自动混合，但语义段“${segment.title}”选择的辅助动效 ${segment.secondaryEffectId} 不适合叠加：${reason}。请仅重选信息卡并保留字幕事实。${allowedOverlayIds ? `本次可用信息卡 ID：${allowedOverlayIds.join("、") || "无，请改用非 Shotcraft 画面方案"}。` : "请从标记 shotcraftOverlayEligible=true 的卡片中选择。"}` });
          }
        }
        const duration = captions.at(-1)!.endSeconds - captions[0].startSeconds;
        if (duration > 30) fail("单个 Shotcraft 镜头最多 30 秒，请在字幕边界拆分");
        if (duration < Math.min(3, compositionById(id).defaultDurationUs / 1_000_000)) fail("Shotcraft 镜头需要至少 3 秒阅读与完整动作时间，请合并相邻字幕");
      }
    }
  }
  const shots = selection.segments.flatMap((s) => s.primaryEffectId && isShotcraftComposition(s.primaryEffectId) ? [{ shotId: s.primaryEffectId, transition: "none" }] : []);
  if (shotcraftImpactCount(shots) > 3) issues.push({ code: "custom", path: ["segments"], message: "全屏镜头冲击最多三处" });
  if (issues.length) throw new z.ZodError(issues);
}

export function assertStoryboardMatches(matches: readonly AiMotionMatch[], selection: AiMotionSelection, input: MatchTimelineMotionInput) {
  if (!input.storyboard) return;
  const issues: z.core.$ZodIssue[] = [];
  const shotcraftScenes: Array<{ captionIndex: number; endCaptionIndex: number; matchIndex: number; scene: ReturnType<typeof shotcraftSceneForMatch> }> = [];
  for (const [index, match] of matches.entries()) {
    const segment = selection.segments.find((s) => match.captionIndex >= s.startCaptionIndex && match.captionIndex <= s.endCaptionIndex);
    if (!segment) continue;
    const fail = (message: string) => issues.push({ code: "custom", path: ["matches", index], message });
    if (match.primaryMediaAssetId || match.secondaryMediaAssetId) fail("字幕分镜仅使用 videoLayers 绑定视频，不能使用旧素材字段");
    if (!input.soundEnabled && (match.soundEffectId || match.shotcraftSounds?.length)) fail("用户已关闭动作音效，分镜不能携带音效");
    if (segment.roll === "a-roll" && match.videoLayers.length) fail("A-roll 段保留现有主叙事视频，不能插入覆盖视频");
    if (segment.roll === "b-roll" && match.videoLayers.some((layer) => ["a-roll", "presenter"].includes(layer.role) || input.materials.some((m) => m.id === layer.assetId && ["a-roll", "presenter"].includes(m.roleHint ?? "")))) fail("B-roll 段不能插入人物主叙事素材");
    if (segment.roll === "b-roll" && (match.cameraPreset !== "none" || match.videoLayers.some((layer) => layer.volume !== 0))) fail("B-roll 保留原口播音轨；补充视频须静音，运镜写在补充视频层内");
    if (match.primaryEffectId && isShotcraftComposition(match.primaryEffectId)) {
      const duration = input.captions[segment.endCaptionIndex].endSeconds - input.captions[match.captionIndex].startSeconds;
      const scene = shotcraftSceneForMatch(match, duration);
      shotcraftScenes.push({ captionIndex: match.captionIndex, endCaptionIndex: segment.endCaptionIndex, matchIndex: index, scene });
      for (const message of shotcraftContentIssues(scene)) fail(message);
      try { validateShotcraftPlan({ title: "字幕分镜", scenes: [scene] }, input.materials.map((material) => ({ id: material.id, kind: material.kind ?? "video", name: material.name, durationUs: Math.round(material.durationSeconds * 1_000_000) }))); }
      catch (error) { fail(error instanceof Error ? error.message : "镜头内容无效"); }
      if (match.materialPlaceholder) fail("Shotcraft 需要真实绑定素材，不能使用占位页面");
      if (match.soundEffectId) fail("Shotcraft 镜头只能使用镜头动作音效，不能携带普通字幕音效");
    } else if ((match.shotcraftTransition && match.shotcraftTransition !== "none") || match.shotcraftSounds?.length) {
      fail("普通动效不能携带 Shotcraft 转场或动作音效");
    }
  }
  const orderedShotcraftScenes = shotcraftScenes.sort((left, right) => left.captionIndex - right.captionIndex);
  for (const [index, current] of orderedShotcraftScenes.entries()) {
    if (current.scene.transition === "none") continue;
    const previous = orderedShotcraftScenes[index - 1];
    const previousEndSeconds = previous ? input.captions[previous.endCaptionIndex]?.endSeconds : undefined;
    const currentStartSeconds = input.captions[current.captionIndex]?.startSeconds;
    if (!previous || previous.endCaptionIndex + 1 !== current.captionIndex || previousEndSeconds === undefined || currentStartSeconds === undefined || Math.abs(previousEndSeconds - currentStartSeconds) > 0.000001) {
      issues.push({ code: "custom", path: ["matches", current.matchIndex, "shotcraftTransition"], message: "Shotcraft 转场只支持时间上直接相邻的两个 Shotcraft 镜头" });
    }
  }
  if (shotcraftImpactCount(orderedShotcraftScenes.map(({ scene }) => scene)) > 3) {
    issues.push({ code: "custom", path: ["matches"], message: "镜头内部冲击与闪白转场合计最多三处" });
  }
  for (const [index, segment] of selection.segments.entries()) {
    if (segment.roll !== "b-roll") continue;
    const opening = matches.find((m) => m.captionIndex === segment.startCaptionIndex);
    const fullEffect = opening?.primaryEffectId && storyboardFullFrameEffect(opening.primaryEffectId) && !opening.materialPlaceholder
      && (isShotcraftComposition(opening.primaryEffectId) || isBackgroundComposition(opening.primaryEffectId) || Boolean(opening.compositionBindings?.some((binding) => binding.assetIds.length)));
    const fullVideo = opening?.videoLayers.some((layer) => layer.layoutPreset === "full" && layer.shapePreset === "rectangle");
    if (!fullEffect && !fullVideo) issues.push({ code: "custom", path: ["segments", index], message: "B-roll 必须从该段起点持续显示全屏镜头或相关补充视频，不能仅叠一张小字卡" });
  }
  if (issues.length) throw new z.ZodError(issues);
}
