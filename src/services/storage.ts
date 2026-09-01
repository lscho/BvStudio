import { Store } from "@tauri-apps/plugin-store";
import type { AiProviderConfig } from "@/services/ai/provider";

export type ColorScheme = "system" | "light" | "dark";

export interface PersistedSettings {
  colorScheme: ColorScheme;
  aiProvider: AiProviderConfig;
  cloudSpeech: CloudSpeechConfig;
  media: MediaSettings;
}

export interface MediaSettings {
  encoder: "auto" | "software" | "videotoolbox" | "nvenc" | "qsv";
  proxyEnabled: boolean;
  proxyHeight: 540 | 720;
}

export interface CloudSpeechConfig {
  baseUrl: string;
  ttsModel: string;
  ttsVoice: string;
  ttsStyle: string;
  asrModel: string;
  asrLanguage: "auto" | "zh" | "en";
}

export const DEFAULT_SETTINGS: PersistedSettings = {
  colorScheme: "dark",
  aiProvider: {
    protocol: "openai-responses",
    baseUrl: "https://api.openai.com",
    model: "",
    inputCostPerMillion: 0,
    outputCostPerMillion: 0
  },
  cloudSpeech: {
    baseUrl: "https://api.xiaomimimo.com/v1",
    ttsModel: "mimo-v2.5-tts",
    ttsVoice: "冰糖",
    ttsStyle: "自然、清晰、适合知识讲解，语速适中",
    asrModel: "mimo-v2.5-asr",
    asrLanguage: "zh"
  },
  media: {
    encoder: "auto",
    proxyEnabled: true,
    proxyHeight: 540
  }
};

export const COLOR_SCHEME_VALUES: readonly ColorScheme[] = ["system", "light", "dark"];

export function isColorScheme(value: unknown): value is ColorScheme {
  return typeof value === "string" && (COLOR_SCHEME_VALUES as readonly string[]).includes(value);
}

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const browserStorageKey = "tauri-base:preferences";
const memoryStore = new Map<string, unknown>();
const settingsFile = "settings.json";
const settingsKey = "preferences";

function normalizeSettings(value: unknown): PersistedSettings {
  if (value && typeof value === "object" && "colorScheme" in value) {
    const raw = value as { colorScheme: unknown; aiProvider?: Partial<AiProviderConfig>; cloudSpeech?: Partial<CloudSpeechConfig>; media?: Partial<MediaSettings> };
    const colorScheme = isColorScheme(raw.colorScheme) ? raw.colorScheme : DEFAULT_SETTINGS.colorScheme;
    const protocol = ["openai-responses", "openai-chat", "anthropic"].includes(raw.aiProvider?.protocol ?? "")
      ? raw.aiProvider!.protocol!
      : DEFAULT_SETTINGS.aiProvider.protocol;
    return {
      colorScheme,
      aiProvider: {
        protocol,
        baseUrl: typeof raw.aiProvider?.baseUrl === "string" && raw.aiProvider.baseUrl.trim()
          ? raw.aiProvider.baseUrl.trim()
          : DEFAULT_SETTINGS.aiProvider.baseUrl,
        model: typeof raw.aiProvider?.model === "string" ? raw.aiProvider.model.trim() : "",
        inputCostPerMillion: typeof raw.aiProvider?.inputCostPerMillion === "number" && Number.isFinite(raw.aiProvider.inputCostPerMillion)
          ? Math.max(0, raw.aiProvider.inputCostPerMillion)
          : DEFAULT_SETTINGS.aiProvider.inputCostPerMillion,
        outputCostPerMillion: typeof raw.aiProvider?.outputCostPerMillion === "number" && Number.isFinite(raw.aiProvider.outputCostPerMillion)
          ? Math.max(0, raw.aiProvider.outputCostPerMillion)
          : DEFAULT_SETTINGS.aiProvider.outputCostPerMillion
      },
      cloudSpeech: {
        baseUrl: typeof raw.cloudSpeech?.baseUrl === "string" && raw.cloudSpeech.baseUrl.trim() ? raw.cloudSpeech.baseUrl.trim() : DEFAULT_SETTINGS.cloudSpeech.baseUrl,
        ttsModel: typeof raw.cloudSpeech?.ttsModel === "string" && raw.cloudSpeech.ttsModel.trim() ? raw.cloudSpeech.ttsModel.trim() : DEFAULT_SETTINGS.cloudSpeech.ttsModel,
        ttsVoice: typeof raw.cloudSpeech?.ttsVoice === "string" && raw.cloudSpeech.ttsVoice.trim() ? raw.cloudSpeech.ttsVoice.trim() : DEFAULT_SETTINGS.cloudSpeech.ttsVoice,
        ttsStyle: typeof raw.cloudSpeech?.ttsStyle === "string" ? raw.cloudSpeech.ttsStyle.trim() : DEFAULT_SETTINGS.cloudSpeech.ttsStyle,
        asrModel: typeof raw.cloudSpeech?.asrModel === "string" && raw.cloudSpeech.asrModel.trim() ? raw.cloudSpeech.asrModel.trim() : DEFAULT_SETTINGS.cloudSpeech.asrModel,
        asrLanguage: ["auto", "zh", "en"].includes(raw.cloudSpeech?.asrLanguage ?? "") ? raw.cloudSpeech!.asrLanguage! : DEFAULT_SETTINGS.cloudSpeech.asrLanguage
      },
      media: {
        encoder: ["auto", "software", "videotoolbox", "nvenc", "qsv"].includes(raw.media?.encoder ?? "") ? raw.media!.encoder! : DEFAULT_SETTINGS.media.encoder,
        proxyEnabled: typeof raw.media?.proxyEnabled === "boolean" ? raw.media.proxyEnabled : DEFAULT_SETTINGS.media.proxyEnabled,
        proxyHeight: raw.media?.proxyHeight === 720 ? 720 : 540
      }
    };
  }
  return structuredClone(DEFAULT_SETTINGS);
}

function readBrowserSettings(): PersistedSettings {
  try {
    const serialized = window.localStorage.getItem(browserStorageKey);
    if (serialized === null) {
      const fallback = memoryStore.get(browserStorageKey);
      return normalizeSettings(fallback);
    }
    return normalizeSettings(JSON.parse(serialized));
  } catch (error) {
    console.warn(`Failed to read browser settings ${browserStorageKey}`, error);
    return normalizeSettings(memoryStore.get(browserStorageKey));
  }
}

function writeBrowserSettings(settings: PersistedSettings) {
  try {
    window.localStorage.setItem(browserStorageKey, JSON.stringify(settings));
    memoryStore.delete(browserStorageKey);
  } catch (error) {
    console.warn(`Failed to write browser settings ${browserStorageKey}`, error);
    memoryStore.set(browserStorageKey, settings);
  }
}

async function desktopStore() {
  return await Store.load(settingsFile, { defaults: {}, autoSave: false });
}

/** 读取持久化设置；桌面运行时走 plugin-store（settings.json / preferences），浏览器预览走 localStorage，异常时回退默认值。 */
export async function readSettings(): Promise<PersistedSettings> {
  if (!isTauri) return readBrowserSettings();

  try {
    const store = await desktopStore();
    return normalizeSettings((await store.get<unknown>(settingsKey)) ?? DEFAULT_SETTINGS);
  } catch (error) {
    console.warn(`Failed to read ${settingsFile}:${settingsKey}`, error);
    return structuredClone(DEFAULT_SETTINGS);
  }
}

/** 写入持久化设置；仅通过显式调用持久化，组件不直接触碰存储。 */
export async function writeSettings(settings: PersistedSettings): Promise<void> {
  if (!isTauri) {
    writeBrowserSettings(settings);
    return;
  }

  const store = await desktopStore();
  await store.set(settingsKey, settings);
  await store.save();
}
