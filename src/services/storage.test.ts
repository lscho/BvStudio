import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, readSettings, writeSettings } from "@/services/storage";

const STORAGE_KEY = "tauri-base:preferences";

// Node ≥ 26 的全局 localStorage 实验性实现会遮蔽 happy-dom 的同名属性，
// 因此这里注入一个独立的内存 Storage 替身，专门验证命名空间键与回退逻辑。
function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    key(index) {
      return Array.from(values.keys())[index] ?? null;
    },
    getItem(key) {
      return values.has(key) ? values.get(key)! : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    clear() {
      values.clear();
    }
  } as Storage;
}

let storage: Storage;

function storedValue(): unknown {
  const serialized = storage.getItem(STORAGE_KEY);
  return serialized === null ? null : JSON.parse(serialized);
}

beforeEach(() => {
  storage = createMemoryStorage();
  vi.stubGlobal("localStorage", storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("readSettings", () => {
  it("returns the default when nothing is stored", async () => {
    await expect(readSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it("returns the persisted value from the namespaced browser key", async () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ colorScheme: "dark" }));
    await expect(readSettings()).resolves.toEqual({ ...DEFAULT_SETTINGS, colorScheme: "dark" });
  });

  it("normalizes malformed JSON to the default", async () => {
    storage.setItem(STORAGE_KEY, "{not json");
    await expect(readSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it("normalizes unknown color scheme values to the default", async () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ colorScheme: "sepia" }));
    await expect(readSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it("persists one million output tokens and clamps older oversized values", async () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, aiProvider: { ...DEFAULT_SETTINGS.aiProvider, maxTokens: 1_000_000 } }));
    await expect(readSettings()).resolves.toMatchObject({ aiProvider: { maxTokens: 1_000_000 } });
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, aiProvider: { ...DEFAULT_SETTINGS.aiProvider, maxTokens: 2_000_000 } }));
    await expect(readSettings()).resolves.toMatchObject({ aiProvider: { maxTokens: 1_000_000 } });
  });

  it("falls back to the default when browser storage is unavailable", async () => {
    vi.spyOn(storage, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    await expect(readSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });
});

describe("writeSettings", () => {
  it("persists through the namespaced browser key", async () => {
    const settings = { ...DEFAULT_SETTINGS, colorScheme: "light" as const };
    await writeSettings(settings);
    expect(storedValue()).toEqual(settings);
    await expect(readSettings()).resolves.toEqual(settings);
  });

  it("keeps writes in memory when browser storage throws", async () => {
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    const settings = { ...DEFAULT_SETTINGS, colorScheme: "dark" as const };
    await writeSettings(settings);
    await expect(readSettings()).resolves.toEqual(settings);
  });
});
