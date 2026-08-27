import { describe, expect, it } from "vitest";
import {
  clientUpdatePlatformFor,
  fileNameFromUrl,
  parseDesktopUpdateInfo,
  positiveInteger,
  type UpdaterRawUpdate
} from "@/services/updaterModel";

describe("clientUpdatePlatformFor", () => {
  it("maps all five supported OS/architecture pairs", () => {
    expect(clientUpdatePlatformFor("windows", "x86_64")).toBe("windows-x86");
    expect(clientUpdatePlatformFor("windows", "aarch64")).toBe("windows-arm");
    expect(clientUpdatePlatformFor("macos", "x86_64")).toBe("macos-x86");
    expect(clientUpdatePlatformFor("macos", "aarch64")).toBe("macos-arm");
    expect(clientUpdatePlatformFor("linux", "x86_64")).toBe("linux-x86");
  });

  it("returns null for unsupported combinations", () => {
    expect(clientUpdatePlatformFor("windows", "x86")).toBeNull();
    expect(clientUpdatePlatformFor("windows", "armv7")).toBeNull();
    expect(clientUpdatePlatformFor("macos", "i386")).toBeNull();
    expect(clientUpdatePlatformFor("linux", "aarch64")).toBeNull();
    expect(clientUpdatePlatformFor("ios", "aarch64")).toBeNull();
    expect(clientUpdatePlatformFor("", "")).toBeNull();
  });
});

describe("positiveInteger", () => {
  it("accepts only safe positive integers", () => {
    expect(positiveInteger(42)).toBe(42);
    expect(positiveInteger(1)).toBe(1);
  });

  it("rejects invalid file sizes", () => {
    expect(positiveInteger(0)).toBeNull();
    expect(positiveInteger(-5)).toBeNull();
    expect(positiveInteger(1.5)).toBeNull();
    expect(positiveInteger(Number.MAX_SAFE_INTEGER + 2)).toBeNull();
    expect(positiveInteger("100")).toBeNull();
    expect(positiveInteger(null)).toBeNull();
    expect(positiveInteger(undefined)).toBeNull();
  });
});

describe("fileNameFromUrl", () => {
  it("derives the file name from a valid update URL", () => {
    expect(fileNameFromUrl("https://updates.example.com/releases/tauri-base_0.2.0_x64-setup.exe")).toBe(
      "tauri-base_0.2.0_x64-setup.exe"
    );
    expect(fileNameFromUrl("https://updates.example.com/a/b/%E6%9B%B4%E6%96%B0.app.tar.gz")).toBe(
      "更新.app.tar.gz"
    );
  });

  it("falls back to 更新包 for invalid or empty URLs", () => {
    expect(fileNameFromUrl("")).toBe("更新包");
    expect(fileNameFromUrl(undefined)).toBe("更新包");
    expect(fileNameFromUrl("not a url")).toBe("更新包");
    expect(fileNameFromUrl("https://updates.example.com/")).toBe("更新包");
  });
});

function rawUpdate(overrides: Partial<UpdaterRawUpdate> = {}): UpdaterRawUpdate {
  return {
    currentVersion: "0.1.0",
    version: "0.2.0",
    rawJson: {},
    ...overrides
  };
}

describe("parseDesktopUpdateInfo", () => {
  it("maps the raw metadata for a macos-arm update", () => {
    const info = parseDesktopUpdateInfo(
      rawUpdate({
        body: "  修复若干问题  ",
        date: "  2026-01-15T08:00:00Z  ",
        rawJson: {
          fileName: "  tauri-base_0.2.0_aarch64_arm64.app.tar.gz  ",
          fileSize: 12345,
          isForceUpdate: true,
          url: "https://updates.example.com/x"
        }
      }),
      "macos-arm"
    );

    expect(info).toEqual({
      currentVersion: "0.1.0",
      version: "0.2.0",
      platform: "macos-arm",
      fileName: "tauri-base_0.2.0_aarch64_arm64.app.tar.gz",
      fileSize: 12345,
      notes: "修复若干问题",
      publishTime: "2026-01-15T08:00:00Z",
      isForceUpdate: true
    });
  });

  it("trims all strings and prefers body over raw notes", () => {
    const info = parseDesktopUpdateInfo(
      rawUpdate({
        body: "  body notes  ",
        rawJson: { notes: "  raw notes  " }
      }),
      "windows-x86"
    );
    expect(info.notes).toBe("body notes");
  });

  it("uses raw notes when the body is empty", () => {
    const info = parseDesktopUpdateInfo(
      rawUpdate({ rawJson: { notes: "  raw notes  " } }),
      "windows-x86"
    );
    expect(info.notes).toBe("raw notes");
  });

  it("rejects invalid file sizes and non-boolean force-update values", () => {
    const info = parseDesktopUpdateInfo(
      rawUpdate({
        rawJson: {
          fileSize: "100",
          isForceUpdate: "true",
          url: "https://updates.example.com/tauri-base_0.2.0_x64-setup.exe"
        }
      }),
      "windows-x86"
    );
    expect(info.fileSize).toBeNull();
    expect(info.isForceUpdate).toBe(false);
    expect(info.fileName).toBe("tauri-base_0.2.0_x64-setup.exe");
  });

  it("derives a fallback file name when fileName is missing", () => {
    const withUrl = parseDesktopUpdateInfo(
      rawUpdate({
        rawJson: { url: "https://updates.example.com/downloads/tauri-base_0.2.0_arm64.dmg" }
      }),
      "macos-arm"
    );
    expect(withUrl.fileName).toBe("tauri-base_0.2.0_arm64.dmg");

    const withoutUrl = parseDesktopUpdateInfo(rawUpdate(), "macos-arm");
    expect(withoutUrl.fileName).toBe("更新包");
  });

  it("keeps publishTime null when no date fields are present", () => {
    const info = parseDesktopUpdateInfo(rawUpdate(), "windows-x86");
    expect(info.publishTime).toBeNull();
  });
});
