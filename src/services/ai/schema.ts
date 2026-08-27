import { z } from "zod";
import { BUILTIN_EFFECTS } from "@/domain/effects";
import { CAMERA_PRESETS } from "@/domain/camera";

const effectIds = BUILTIN_EFFECTS.map((effect) => effect.id);
const cameraPresetIds = CAMERA_PRESETS.map((preset) => preset.id);

export function createAiVideoPlanSchema(allowedEffectIds: readonly string[], allowedMediaAssetIds: readonly string[] = []) {
  return z.object({
  title: z.string().min(1).max(80),
  article: z.string().min(1).max(8000),
  narration: z.string().min(1).max(8000),
  scenes: z.array(z.object({
    title: z.string().min(1).max(80),
    narration: z.string().min(1).max(1200),
    durationSeconds: z.number().min(1).max(30),
    effectId: z.string().refine((value) => allowedEffectIds.includes(value), "未知动效"),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    cameraPreset: z.enum(cameraPresetIds as [typeof cameraPresetIds[number], ...typeof cameraPresetIds[number][]]),
    mediaAssetId: z.string().nullable().refine((value) => value === null || allowedMediaAssetIds.includes(value), "未知素材"),
    mediaSourceInSeconds: z.number().min(0).max(86_400)
  })).min(1).max(20)
  });
}

export const aiVideoPlanSchema = createAiVideoPlanSchema(effectIds);

export type AiVideoPlan = z.infer<typeof aiVideoPlanSchema>;

export function createVideoPlanJsonSchema(allowedEffectIds: readonly string[], allowedMediaAssetIds: readonly string[] = []) {
  return {
  type: "object",
  additionalProperties: false,
  required: ["title", "article", "narration", "scenes"],
  properties: {
    title: { type: "string" },
    article: { type: "string" },
    narration: { type: "string" },
    scenes: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "narration", "durationSeconds", "effectId", "color", "cameraPreset", "mediaAssetId", "mediaSourceInSeconds"],
        properties: {
          title: { type: "string" },
          narration: { type: "string" },
          durationSeconds: { type: "number", minimum: 1, maximum: 30 },
          effectId: { type: "string", enum: [...allowedEffectIds] },
          color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
          cameraPreset: { type: "string", enum: [...cameraPresetIds] },
          mediaAssetId: allowedMediaAssetIds.length
            ? { anyOf: [{ type: "string", enum: [...allowedMediaAssetIds] }, { type: "null" }] }
            : { type: "null" },
          mediaSourceInSeconds: { type: "number", minimum: 0, maximum: 86_400 }
        }
      }
    }
  }
  } as const;
}

export const VIDEO_PLAN_JSON_SCHEMA = createVideoPlanJsonSchema(effectIds);
