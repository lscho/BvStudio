import restrictions from "@/domain/shotcraftLibrary/aiRestrictions.json";
import { libraryShot } from "@/domain/shotcraftLibrary/catalog";
import type { ShotcraftPlan } from "@/domain/shotcraftPlan";

export function shotcraftAdaptationIssue(id: string) {
  const item = restrictions.find((entry) => entry.id === id);
  if (!item) return undefined;
  return item.kind === "layout"
    ? "此镜头按参考页面坐标裁切素材，需要适配页面布局，暂不参与 AI 自动编排。"
    : "此镜头含尚未参数化的示例内容，需要定制后用于产品成片，暂不参与 AI 自动编排。";
}

const copyGuides: Readonly<Record<string, readonly { role: string; maxLength: number; required: boolean }[]>> = {
  "shotcraft-pull-back-isolation": [{ role: "主卡短语，拉远后仍须可读", maxLength: 12, required: true }],
  "shotcraft-card-footage-cadence": [0, 1, 2].map((i) => ({ role: `第 ${i + 1} 段短语`, maxLength: 10, required: true })),
  "shotcraft-slow-push-in": [{ role: "简短问题或主张", maxLength: 18, required: true }, { role: "可选补充说明", maxLength: 26, required: false }],
  "shotcraft-lead-word-zoom-assemble": [{ role: "主句，先显示首词再组句", maxLength: 20, required: true }, { role: "主句中要强调的连续原文", maxLength: 10, required: true }, { role: "观众必须读懂的副句", maxLength: 26, required: true }],
  "shotcraft-brand-frame-snap": [{ role: "第一张真实状态图的标签", maxLength: 16, required: true }, { role: "第二张真实状态图的标签", maxLength: 16, required: true }],
  "shotcraft-logo-shrink-wordmark-lockup": [{ role: "片尾标语", maxLength: 40, required: true }, { role: "用户提供的品牌全名", maxLength: 32, required: true }],
  "shotcraft-timeline-travel": [0, 1, 2, 3].map((i) => ({ role: `第 ${i + 1} 个版本或里程碑`, maxLength: 10, required: true })).concat([{ role: "发展史标题，不能用来证明视频多轨编辑", maxLength: 20, required: true }])
};

export function shotcraftCopyGuide(id: string) {
  return libraryShot(id)?.texts.map((field, index) => ({ key: field.key, sample: field.default, ...copyGuides[id]?.[index] })) ?? [];
}

export function shotcraftContentGuidance(id: string) {
  if (id === "shotcraft-card-footage-cadence") return "有图片时短字卡与真实画面交替；无图片时依次展示三段纯文字，最后保留第三段结论。";
  if (id === "shotcraft-pull-back-isolation") return "主卡短语在拉远后仍需可读，最多 12 字；没有图片时周围为抽象卡片，不是产品操作证据。";
  if (id === "shotcraft-basic-3d") return "text 必须用｜分为四段：对应三张图片的短标签和最后总览标题；每段最多 12 字。";
  if (id === "shotcraft-slow-push-in") return "短句缓慢推近；未绑定图片时保留文字终态，绑定图片时末段硬切到真实图片。";
  if (id === "shotcraft-timeline-travel") return "只讲发展史或阶段进度；这是里程碑轴，不是视频编辑器时间线。推荐至少 4.8 秒。";
  if (id === "shotcraft-freeze-annotate-real") return "images[0] 是冻结圈注的局部高清截图，其余为不同局部图；不能放整页缩略图。text 写出该控件解决的问题。";
  if (id === "shotcraft-brand-frame-snap") return "images 前两张必须是不同的真实前后状态，copy 标签按图片实际内容填写，text 解释发生的变化。";
  if (id === "shotcraft-spotlight-hero-card") return "适合单一主角，不适合必须逐项阅读的密集表单；密集界面优先正视、局部截图和焦点巡览。";
  if (id === "shotcraft-logo-shrink-wordmark-lockup") return "logo 槽仅绑定真实透明品牌标识，无标识时仅用字标；至少 4 秒，品牌落定后留 1 秒。";
  return "真实页面展示须绑定清晰图片；图形示意不能当成功能操作证据。";
}

export function shotcraftContentIssues(scene: ShotcraftPlan["scenes"][number]) {
  const issues: string[] = [];
  const copy = Object.fromEntries(scene.copy.map((field) => [field.key, field.value]));
  const hasImages = scene.bindings.some((binding) => binding.slotId !== "logo" && binding.assetIds.length);
  if (hasImages && !scene.text.trim()) issues.push("功能镜头的 text 必须提供可读说明，reason 不会进入成片");
  const captions = scene.text.split(/[|｜\n]/u).filter(Boolean);
  const stagedText = ["shotcraft-cursor-flyover", "shotcraft-basic-3d"].includes(scene.shotId);
  if (captions.some((line) => Array.from(line).length > 36) || captions.length > (stagedText ? 4 : 2)) issues.push("text 每句最多 36 字；分步镜头最多 4 句，普通说明最多 2 句");
  if (scene.shotId === "shotcraft-basic-3d" && (captions.length !== 4 || captions.some((line) => Array.from(line).length > 12))) issues.push("空间步进 text 必须有四段短标签（每段最多 12 字）：三张图片及总览");
  for (const field of shotcraftCopyGuide(scene.shotId)) {
    const value = copy[field.key] ?? "";
    if (field.required && !value.trim()) issues.push(`${field.key} 不能为空：${field.role}`);
    if (field.maxLength && Array.from(value).length > field.maxLength) issues.push(`${field.key} 最多 ${field.maxLength} 字：${field.role}`);
  }
  if (scene.shotId === "shotcraft-lead-word-zoom-assemble" && !(copy.copy0 ?? "").includes(copy.copy1 || "\u0000")) issues.push("copy1 强调词必须是 copy0 主句中的连续原文");
  if (scene.shotId === "shotcraft-brand-frame-snap") {
    const ids = scene.bindings.find((binding) => binding.slotId === "images")?.assetIds ?? [];
    if (ids.length < 2 || ids[0] === ids[1]) issues.push("切换前后必须绑定两张不同的真实状态图片");
  }
  if (scene.shotId === "shotcraft-logo-shrink-wordmark-lockup" && scene.durationSeconds < 4) issues.push("品牌收束至少需要 4 秒，包含完整落定后的 1 秒停留");
  if (scene.shotId === "shotcraft-timeline-travel" && scene.durationSeconds < 4.8) issues.push("时间线穿行至少需要 4.8 秒，包含末刻度推近与停留");
  return issues;
}

const impactShots: Readonly<Record<string, number>> = {
  "shotcraft-lead-word-zoom-assemble": 1, "shotcraft-brand-frame-snap": 1,
  "shotcraft-title-demote-to-label": 1, "shotcraft-crash-impact-real": 1,
  "shotcraft-crash-zoom-real": 1, "shotcraft-anime-impact": 1,
  "shotcraft-grid-flash-mosaic": 1, "shotcraft-smash-cut": 1,
  "shotcraft-glitch-displace": 1, "shotcraft-light-leak-burn": 1,
  "shotcraft-paparazzi-flash": 1, "shotcraft-cel-flash-stomp": 1,
  "shotcraft-drop-blackout-slam": 1, "shotcraft-impact-burst-kit": 1,
  "shotcraft-white-flash-logo-simplify-cut": 1, "shotcraft-score-slam": 1,
  "shotcraft-versus-slam": 1, "shotcraft-kanada-perspective-snap": 1,
  "shotcraft-domino-cascade": 1
};
export function shotcraftImpactCount(scenes: readonly Pick<ShotcraftPlan["scenes"][number], "shotId" | "transition">[]) {
  return scenes.reduce((sum, scene, i) => sum + (impactShots[scene.shotId] ?? 0) + (i && ["flash-cut", "shotcraft-glitch-displace", "shotcraft-light-leak-burn"].includes(scene.transition) ? 1 : 0), 0);
}
