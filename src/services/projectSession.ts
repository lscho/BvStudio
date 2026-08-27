import { Store } from "@tauri-apps/plugin-store";
import type { EditorProject } from "@/domain/project";
import { serializeProject } from "@/domain/projectFile";
import { isDesktopRuntime } from "@/services/runtime";

export interface RecoverySnapshot {
  projectJson: string;
  projectPath: string | null;
  savedAt: string;
}

export interface RecentProject {
  path: string;
  name: string;
  lastOpenedAt: string;
}

const sessionFile = "workspace.json";
const recoveryKey = "recovery";
const recentKey = "recentProjects";
const browserRecoveryKey = "bvideo:recovery";
const browserRecentKey = "bvideo:recent-projects";
const memoryStore = new Map<string, string>();

function readBrowserValue(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? memoryStore.get(key) ?? null;
  } catch {
    return memoryStore.get(key) ?? null;
  }
}

function writeBrowserValue(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
    memoryStore.delete(key);
  } catch {
    if (value === null) memoryStore.delete(key);
    else memoryStore.set(key, value);
  }
}

async function sessionStore() {
  return Store.load(sessionFile, { defaults: {}, autoSave: false });
}

function normalizeRecovery(value: unknown): RecoverySnapshot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<RecoverySnapshot>;
  if (typeof raw.projectJson !== "string" || typeof raw.savedAt !== "string") return null;
  return {
    projectJson: raw.projectJson,
    projectPath: typeof raw.projectPath === "string" ? raw.projectPath : null,
    savedAt: raw.savedAt
  };
}

function normalizeRecent(value: unknown): RecentProject[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const raw = entry as Partial<RecentProject>;
    if (typeof raw.path !== "string" || !raw.path.trim() || typeof raw.name !== "string" || typeof raw.lastOpenedAt !== "string") return [];
    return [{ path: raw.path, name: raw.name, lastOpenedAt: raw.lastOpenedAt }];
  }).sort((left, right) => right.lastOpenedAt.localeCompare(left.lastOpenedAt)).slice(0, 10);
}

export function projectHasRecoverableContent(project: EditorProject): boolean {
  return project.assets.length > 0 || project.tracks.some((track) => track.clips.length > 0);
}

export async function readRecoverySnapshot(): Promise<RecoverySnapshot | null> {
  if (!isDesktopRuntime()) {
    const value = readBrowserValue(browserRecoveryKey);
    if (!value) return null;
    try { return normalizeRecovery(JSON.parse(value)); } catch { return null; }
  }
  const store = await sessionStore();
  return normalizeRecovery(await store.get<unknown>(recoveryKey));
}

export async function writeRecoverySnapshot(project: EditorProject, projectPath: string | null): Promise<void> {
  const snapshot: RecoverySnapshot = { projectJson: serializeProject(project), projectPath, savedAt: new Date().toISOString() };
  if (!isDesktopRuntime()) {
    writeBrowserValue(browserRecoveryKey, JSON.stringify(snapshot));
    return;
  }
  const store = await sessionStore();
  await store.set(recoveryKey, snapshot);
  await store.save();
}

export async function clearRecoverySnapshot(): Promise<void> {
  if (!isDesktopRuntime()) {
    writeBrowserValue(browserRecoveryKey, null);
    return;
  }
  const store = await sessionStore();
  await store.delete(recoveryKey);
  await store.save();
}

export async function readRecentProjects(): Promise<RecentProject[]> {
  if (!isDesktopRuntime()) {
    const value = readBrowserValue(browserRecentKey);
    if (!value) return [];
    try { return normalizeRecent(JSON.parse(value)); } catch { return []; }
  }
  const store = await sessionStore();
  return normalizeRecent(await store.get<unknown>(recentKey));
}

export async function rememberRecentProject(path: string, project: EditorProject): Promise<RecentProject[]> {
  const current = await readRecentProjects();
  const next = normalizeRecent([
    { path, name: project.name, lastOpenedAt: new Date().toISOString() },
    ...current.filter((entry) => entry.path !== path)
  ]);
  if (!isDesktopRuntime()) {
    writeBrowserValue(browserRecentKey, JSON.stringify(next));
    return next;
  }
  const store = await sessionStore();
  await store.set(recentKey, next);
  await store.save();
  return next;
}
