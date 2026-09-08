import { z } from "zod";
import { BUILTIN_EFFECTS } from "@/domain/effects";
import { aiCompositionSlots } from "@/domain/compositions";
import { CAMERA_PRESETS } from "@/domain/camera";
import { VIDEO_LAYOUT_PRESETS } from "@/domain/transforms";
import { BUILTIN_SOUND_EFFECT_IDS } from "@/domain/soundEffects";
import { VIDEO_TRANSITION_PRESETS } from "@/domain/project";

const effectIds = BUILTIN_EFFECTS.map((effect) => effect.id);
const cameraPresetIds = CAMERA_PRESETS.map((preset) => preset.id);
const videoLayoutPresetIds = VIDEO_LAYOUT_PRESETS.filter((preset) => preset.id !== "custom").map((preset) => preset.id);
const cameraPresetEnum = cameraPresetIds as [typeof cameraPresetIds[number], ...typeof cameraPresetIds[number][]];
const videoLayoutPresetEnum = videoLayoutPresetIds as [typeof videoLayoutPresetIds[number], ...typeof videoLayoutPresetIds[number][]];
const videoRoleSchema = z.enum(["a-roll", "b-roll", "presenter", "screen", "supporting", "unspecified"]);
const videoShapeSchema = z.enum(["rectangle", "rounded", "circle", "ellipse", "square", "portrait"]);
const videoTransitionSchema = z.enum(VIDEO_TRANSITION_PRESETS);
const backdropPresetSchema = z.enum(["none", "dark", "soft", "light", "accent"]);
const motionGroupIdSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,39}$/);

const timedCaptionSchema = z.object({
  startSeconds: z.number().min(0).max(86_400),
  endSeconds: z.number().min(0.05).max(86_400),
  text: z.string().trim().min(1).max(500)
});

export const aiTimedScriptSchema = z.object({
  title: z.string().trim().min(1).max(80),
  article: z.string().trim().min(1).max(8_000),
  narration: z.string().trim().min(1).max(8_000),
  captions: z.array(timedCaptionSchema).min(1).max(80)
});

export type AiTimedScript = z.infer<typeof aiTimedScriptSchema>;

export const aiChapterPlanSchema = z.object({
  chapters: z.array(z.object({
    captionIndex: z.number().int().min(0).max(10_000),
    title: z.string().trim().min(1).max(24)
  })).min(1).max(6)
});

export type AiChapterPlan = z.infer<typeof aiChapterPlanSchema>;

export const aiSoundMatchesSchema = z.object({
  matches: z.array(z.object({
    captionIndex: z.number().int().min(0).max(79),
    soundEffectId: z.enum(BUILTIN_SOUND_EFFECT_IDS, { error: "未知音效" }).nullable()
  })).max(80)
});

export type AiSoundMatch = z.infer<typeof aiSoundMatchesSchema>["matches"][number];

export const SOUND_MATCHES_JSON_SCHEMA = {
  type: "object", additionalProperties: false, required: ["matches"],
  properties: {
    matches: {
      type: "array", maxItems: 80,
      items: {
        type: "object", additionalProperties: false, required: ["captionIndex", "soundEffectId"],
        properties: {
          captionIndex: { type: "integer", minimum: 0, maximum: 79 },
          soundEffectId: { anyOf: [{ type: "string", enum: [...BUILTIN_SOUND_EFFECT_IDS] }, { type: "null" }] }
        }
      }
    }
  }
};

const chartMatchSchema = z.object({
  categories: z.array(z.string().trim().min(1).max(30)).min(1).max(12),
  series: z.array(z.number().finite()).min(1).max(12),
  unit: z.string().max(20)
});

const videoFocusMatchSchema = z.object({
  enabled: z.boolean(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  zoom: z.number().min(1).max(4),
  startOffsetSeconds: z.number().min(0).max(86_400),
  durationSeconds: z.number().min(0.1).max(86_400)
});

const videoLayerMatchSchema = z.object({
  assetId: z.string(),
  role: videoRoleSchema,
  sourceInSeconds: z.number().min(0).max(86_400),
  layoutPreset: z.enum(videoLayoutPresetEnum),
  shapePreset: videoShapeSchema,
  transitionPreset: videoTransitionSchema,
  cameraPreset: z.enum(cameraPresetEnum),
  volume: z.number().min(0).max(1),
  focus: videoFocusMatchSchema.nullable()
});

export function createAiEffectSelectionSchema(allowedEffectIds: readonly string[]) {
  const compositionId = z.string().refine((value) => allowedEffectIds.includes(value), "未知动效");
  return z.object({ effectIds: z.array(compositionId).min(1).max(32) });
}

export function createEffectSelectionJsonSchema(allowedEffectIds: readonly string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["effectIds"],
    properties: {
      effectIds: {
        type: "array",
        minItems: 1,
        maxItems: 32,
        items: { type: "string", enum: [...allowedEffectIds] }
      }
    }
  } as const;
}

export function createAiMotionMatchesSchema(allowedEffectIds: readonly string[], allowedMediaAssetIds: readonly string[] = [], allowedImageIds: readonly string[] = []) {
  const compositionId = z.string().refine((value) => allowedEffectIds.includes(value), "未知动效");
  const mediaId = z.string().refine((value) => allowedMediaAssetIds.includes(value), "未知素材");
  return z.object({
    matches: z.array(z.object({
      captionIndex: z.number().int().min(0).max(79),
      subtitleKeywords: z.array(z.string().trim().min(2).max(16)).max(3).optional(),
      motionGroupId: motionGroupIdSchema.nullable().optional(),
      persistUntilCaptionIndex: z.number().int().min(0).max(79).nullable().optional(),
      primaryEffectId: compositionId.nullable(),
      primaryText: z.string().max(500),
      compositionBindings: z.array(z.object({ slotId: z.string().min(1).max(64), assetIds: z.array(z.string().refine((id) => allowedImageIds.includes(id) || allowedMediaAssetIds.includes(id), "未知图片或视频素材")).max(12) })).max(8).optional(),
      secondaryEffectId: compositionId.nullable(),
      secondaryText: z.string().max(500).nullable(),
      accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      x: z.number().min(5).max(95),
      y: z.number().min(5).max(95),
      scale: z.number().min(0.3).max(2.5).transform((value) => Math.max(0.65, value)),
      secondaryX: z.number().min(5).max(95),
      secondaryY: z.number().min(5).max(95),
      cameraPreset: z.enum(cameraPresetEnum),
      soundEffectId: z.enum(BUILTIN_SOUND_EFFECT_IDS, { error: "未知音效" }).nullable().optional(),
      videoLayers: z.array(videoLayerMatchSchema.extend({ assetId: mediaId })).max(6).default([]),
      backdropPreset: backdropPresetSchema.default("none"),
      primaryMediaAssetId: mediaId.nullable().optional().default(null),
      primaryMediaSourceInSeconds: z.number().min(0).max(86_400).optional().default(0),
      secondaryMediaAssetId: mediaId.nullable().optional().default(null),
      secondaryMediaSourceInSeconds: z.number().min(0).max(86_400).optional().default(0),
      mediaLayoutPreset: z.enum(videoLayoutPresetEnum).optional().default("full"),
      chart: chartMatchSchema.nullable()
    }).superRefine((match, context) => {
      const bindings = match.compositionBindings ?? [];
      const slots = match.primaryEffectId ? aiCompositionSlots(match.primaryEffectId) : [];
      const valid = new Set(bindings.map((binding) => binding.slotId)).size === bindings.length
        && bindings.every((binding) => slots.some((slot) => slot.id === binding.slotId))
        && slots.every((slot) => {
          const ids = bindings.find((binding) => binding.slotId === slot.id)?.assetIds ?? [];
          return ids.length >= slot.minItems && ids.length <= slot.maxItems && ids.every((id) => (
            slot.kind === "image"
              ? allowedImageIds.includes(id)
              : slot.kind === "video"
                ? allowedMediaAssetIds.includes(id)
                : allowedImageIds.includes(id) || allowedMediaAssetIds.includes(id)
          ));
        });
      if (!valid || (match.secondaryEffectId && aiCompositionSlots(match.secondaryEffectId).length > 0)) context.addIssue({ code: "custom", message: "素材动效必须作为主动效并完整绑定规定素材槽；图片槽不能绑定视频", path: ["compositionBindings"] });
    })).min(1).max(80)
  });
}

export type AiMotionMatch = z.infer<ReturnType<typeof createAiMotionMatchesSchema>>["matches"][number];

const legacySceneSchema = z.object({
  title: z.string().min(1).max(80),
  narration: z.string().min(1).max(1200),
  durationSeconds: z.number().min(0.05).max(600),
  effectIds: z.array(z.string()).max(2),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  cameraPreset: z.enum(cameraPresetEnum),
  mediaAssetId: z.string().nullable(),
  mediaSourceInSeconds: z.number().min(0).max(86_400),
  secondaryMediaAssetId: z.string().nullable(),
  secondaryMediaSourceInSeconds: z.number().min(0).max(86_400),
  mediaLayoutPreset: z.enum(videoLayoutPresetEnum)
});

export const aiVideoPlanSchema = aiTimedScriptSchema.extend({
  matches: z.array(z.custom<AiMotionMatch>()).default([]),
  // Retained only for old in-memory callers; the editor no longer exposes storyboard editing.
  scenes: z.array(legacySceneSchema).default([])
});

export interface AiVideoPlan {
  title: string;
  article: string;
  narration: string;
  captions?: AiTimedScript["captions"];
  matches?: AiMotionMatch[];
  scenes: z.infer<typeof legacySceneSchema>[];
}

export const TIMED_SCRIPT_JSON_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["title", "article", "narration", "captions"],
  properties: {
    title: { type: "string" }, article: { type: "string" }, narration: { type: "string" },
    captions: { type: "array", minItems: 1, maxItems: 80, items: { type: "object", additionalProperties: false, required: ["startSeconds", "endSeconds", "text"], properties: { startSeconds: { type: "number", minimum: 0, maximum: 86_400 }, endSeconds: { type: "number", minimum: 0.05, maximum: 86_400 }, text: { type: "string" } } } }
  }
} as const;

export const CHAPTER_PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["chapters"],
  properties: {
    chapters: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["captionIndex", "title"],
        properties: {
          captionIndex: { type: "integer", minimum: 0, maximum: 10_000 },
          title: { type: "string", minLength: 1, maxLength: 24 }
        }
      }
    }
  }
} as const;

export function createMotionMatchesJsonSchema(allowedEffectIds: readonly string[], allowedMediaAssetIds: readonly string[] = [], allowedImageIds: readonly string[] = []) {
  const visualIds = [...new Set([...allowedImageIds, ...allowedMediaAssetIds])];
  const nullableEnum = (values: readonly string[]) => values.length ? { anyOf: [{ type: "string", enum: [...values] }, { type: "null" }] } : { type: "null" };
  return {
    type: "object", additionalProperties: false, required: ["matches"],
    properties: {
      matches: { type: "array", minItems: 1, maxItems: 80, items: {
        type: "object", additionalProperties: false,
        required: ["captionIndex", "subtitleKeywords", "motionGroupId", "persistUntilCaptionIndex", "primaryEffectId", "primaryText", "compositionBindings", "secondaryEffectId", "secondaryText", "accentColor", "x", "y", "scale", "secondaryX", "secondaryY", "cameraPreset", "soundEffectId", "videoLayers", "backdropPreset", "chart"],
        properties: {
          compositionBindings: { type: "array", maxItems: visualIds.length ? 8 : 0, items: { type: "object", additionalProperties: false, required: ["slotId", "assetIds"], properties: { slotId: { type: "string" }, assetIds: { type: "array", maxItems: 12, items: visualIds.length ? { type: "string", enum: visualIds } : { type: "string" } } } } },
          captionIndex: { type: "integer", minimum: 0, maximum: 79 }, subtitleKeywords: { type: "array", maxItems: 3, items: { type: "string", minLength: 2, maxLength: 16 } }, motionGroupId: { anyOf: [{ type: "string", pattern: "^[a-z0-9][a-z0-9-]{0,39}$" }, { type: "null" }] }, persistUntilCaptionIndex: { anyOf: [{ type: "integer", minimum: 0, maximum: 79 }, { type: "null" }] }, primaryEffectId: nullableEnum(allowedEffectIds), primaryText: { type: "string" }, secondaryEffectId: nullableEnum(allowedEffectIds), secondaryText: { anyOf: [{ type: "string" }, { type: "null" }] }, accentColor: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" }, x: { type: "number", minimum: 5, maximum: 95 }, y: { type: "number", minimum: 5, maximum: 95 }, scale: { type: "number", minimum: 0.65, maximum: 2.5 }, secondaryX: { type: "number", minimum: 5, maximum: 95 }, secondaryY: { type: "number", minimum: 5, maximum: 95 }, cameraPreset: { type: "string", enum: [...cameraPresetIds] }, soundEffectId: nullableEnum(BUILTIN_SOUND_EFFECT_IDS),
          videoLayers: { type: "array", maxItems: allowedMediaAssetIds.length ? 6 : 0, items: { type: "object", additionalProperties: false, required: ["assetId", "role", "sourceInSeconds", "layoutPreset", "shapePreset", "transitionPreset", "cameraPreset", "volume", "focus"], properties: {
            assetId: allowedMediaAssetIds.length ? { type: "string", enum: [...allowedMediaAssetIds] } : { type: "string" }, role: { type: "string", enum: videoRoleSchema.options }, sourceInSeconds: { type: "number", minimum: 0, maximum: 86_400 }, layoutPreset: { type: "string", enum: [...videoLayoutPresetIds] }, shapePreset: { type: "string", enum: videoShapeSchema.options }, transitionPreset: { type: "string", enum: videoTransitionSchema.options }, cameraPreset: { type: "string", enum: [...cameraPresetIds] }, volume: { type: "number", minimum: 0, maximum: 1 }, focus: { anyOf: [{ type: "object", additionalProperties: false, required: ["enabled", "x", "y", "zoom", "startOffsetSeconds", "durationSeconds"], properties: { enabled: { type: "boolean" }, x: { type: "number", minimum: 0, maximum: 100 }, y: { type: "number", minimum: 0, maximum: 100 }, zoom: { type: "number", minimum: 1, maximum: 4 }, startOffsetSeconds: { type: "number", minimum: 0, maximum: 86_400 }, durationSeconds: { type: "number", minimum: 0.1, maximum: 86_400 } } }, { type: "null" }] }
          } } }, backdropPreset: { type: "string", enum: backdropPresetSchema.options },
          chart: { anyOf: [{ type: "object", additionalProperties: false, required: ["categories", "series", "unit"], properties: { categories: { type: "array", minItems: 1, maxItems: 12, items: { type: "string" } }, series: { type: "array", minItems: 1, maxItems: 12, items: { type: "number" } }, unit: { type: "string" } } }, { type: "null" }] }
        }
      } }
    }
  } as const;
}

// Compatibility exports for packages that imported the previous names.
export function createAiVideoPlanSchema(_allowedEffectIds: readonly string[] = [], _allowedMediaAssetIds: readonly string[] = []) { return aiVideoPlanSchema; }
export function createVideoPlanJsonSchema(_allowedEffectIds: readonly string[] = [], _allowedMediaAssetIds: readonly string[] = []) { return TIMED_SCRIPT_JSON_SCHEMA; }
export const VIDEO_PLAN_JSON_SCHEMA = TIMED_SCRIPT_JSON_SCHEMA;
export const ACTIVE_EFFECT_IDS = effectIds;
