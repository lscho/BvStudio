import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyProject } from "@/domain/project";
import {
  clearRecoverySnapshot,
  hydrateProjectAssets,
  projectHasRecoverableContent,
  readRecentProjects,
  readRecoverySnapshot,
  rememberRecentProject,
  restoreRecoverySnapshot,
  writeRecoverySnapshot
} from "@/services/projectSession";

describe("project session persistence", () => {
  beforeEach(async () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      get length() { return values.size; },
      key: (index: number) => Array.from(values.keys())[index] ?? null,
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, String(value)),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear()
    } as Storage);
    await clearRecoverySnapshot();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores a recoverable project without transient media URLs", async () => {
    const project = createEmptyProject();
    project.assets.push({ id: "asset", name: "source.mp4", kind: "video", durationUs: 1_000_000, sourcePath: "/source.mp4", objectUrl: "blob:temporary", missing: true });
    expect(projectHasRecoverableContent(project)).toBe(true);

    await writeRecoverySnapshot(project, "/project.bvideo.json");
    const recovery = await readRecoverySnapshot();

    expect(recovery).toMatchObject({ projectPath: "/project.bvideo.json" });
    expect(recovery?.projectJson).not.toContain("blob:temporary");
    expect(recovery?.projectJson).not.toContain("missing");
  });

  it("deduplicates and limits recent projects", async () => {
    const project = createEmptyProject();
    for (let index = 0; index < 12; index += 1) {
      project.name = `Project ${index}`;
      await rememberRecentProject(`/project-${index}.bvideo.json`, project);
    }
    project.name = "Most recent";
    await rememberRecentProject("/project-5.bvideo.json", project);

    const recent = await readRecentProjects();
    expect(recent).toHaveLength(10);
    expect(recent[0]).toMatchObject({ path: "/project-5.bvideo.json", name: "Most recent" });
    expect(new Set(recent.map((entry) => entry.path)).size).toBe(10);
  });

  it("restores the project when one media path check fails", async () => {
    const project = createEmptyProject();
    project.assets.push(
      { id: "broken", name: "broken.mp4", kind: "video", durationUs: 1_000_000, sourcePath: "/broken.mp4", height: 1080 },
      { id: "ready", name: "ready.mp4", kind: "video", durationUs: 1_000_000, sourcePath: "/ready.mp4", height: 720 }
    );
    const hydrated = await hydrateProjectAssets(project, {
      desktop: true,
      proxyEnabled: false,
      proxyHeight: 720,
      pathExists: async (path) => {
        if (path === "/broken.mp4") throw new Error("filesystem unavailable");
        return true;
      },
      mediaUrl: (path) => `asset://${path}`
    });

    expect(hydrated.assets[0]).toMatchObject({ missing: true, objectUrl: undefined });
    expect(hydrated.assets[1]).toMatchObject({ missing: false, objectUrl: "asset:///ready.mp4" });
  });

  it("parses and hydrates a complete recovery snapshot", async () => {
    const project = createEmptyProject();
    project.name = "Recovered";
    project.assets.push({ id: "asset", name: "source.mp4", kind: "video", durationUs: 1_000_000, sourcePath: "/source.mp4" });
    const restored = await restoreRecoverySnapshot({ projectJson: JSON.stringify(project), projectPath: "/recovered.bvideo.json", savedAt: new Date().toISOString() }, {
      desktop: true,
      proxyEnabled: false,
      proxyHeight: 720,
      pathExists: async () => true,
      mediaUrl: (path) => `asset://${path}`
    });

    expect(restored.name).toBe("Recovered");
    expect(restored.assets[0]).toMatchObject({ missing: false, objectUrl: "asset:///source.mp4" });
  });
});
