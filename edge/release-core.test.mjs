import { describe, expect, it } from "vitest";
import {
  buildUpdatePayload,
  CLIENT_UPDATE_PLATFORMS,
  decideUpdateResponse,
  fileNameFromUrl,
  isHttpsUrl,
  isRfc3339,
  isSemver,
  isValidUpdatePlatform,
  normalizeVersion,
  positiveInteger,
  releaseKeyFor
} from "./release-core.mjs";

const VALID_RECORD = {
  platform: "macos-arm",
  version: "0.4.0",
  url: "https://github.com/example/bframe-studio/releases/download/v0.4.0/bframe-studio_0.4.0_aarch64_arm64.app.tar.gz",
  signature: "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZQ==",
  fileName: "bframe-studio_0.4.0_aarch64_arm64.app.tar.gz",
  fileSize: 42354176,
  notes: "修复若干问题",
  pub_date: "2026-01-15T08:00:00Z",
  isForceUpdate: false
};

describe("平台白名单", () => {
  it("只接受构建矩阵当前产出的两个平台值", () => {
    expect(CLIENT_UPDATE_PLATFORMS).toEqual(["windows-x86", "macos-arm"]);
    for (const platform of CLIENT_UPDATE_PLATFORMS) expect(isValidUpdatePlatform(platform)).toBe(true);
  });

  it("拒绝空值、大小写变体、历史平台值与未知平台", () => {
    for (const value of [
      undefined,
      null,
      "",
      " ",
      "macos",
      "macos-arm64",
      "MACOS-ARM",
      "darwin-aarch64",
      "windows-arm",
      "macos-x86",
      "linux-x86",
      7
    ]) {
      expect(isValidUpdatePlatform(value)).toBe(false);
    }
  });

  it("按平台生成互不相同的 KV 键", () => {
    const keys = CLIENT_UPDATE_PLATFORMS.map(releaseKeyFor);
    expect(new Set(keys).size).toBe(CLIENT_UPDATE_PLATFORMS.length);
    expect(releaseKeyFor("macos-arm")).toBe("release:latest:macos-arm");
  });
});

describe("字段归一化", () => {
  it("normalizeVersion 去掉前导 v，与客户端 Rust 侧行为一致", () => {
    expect(normalizeVersion("v0.4.0")).toBe("0.4.0");
    expect(normalizeVersion(" 0.4.0 ")).toBe("0.4.0");
    expect(normalizeVersion(undefined)).toBe("");
  });

  it("isSemver 接受预发布与构建元数据，拒绝非 SemVer", () => {
    expect(isSemver("0.4.0")).toBe(true);
    expect(isSemver("1.0.0-rc.1+build.5")).toBe(true);
    expect(isSemver("0.4")).toBe(false);
    expect(isSemver("v0.4.0")).toBe(false);
    expect(isSemver("")).toBe(false);
  });

  it("isRfc3339 要求带时区，无时区写法必须被拒绝", () => {
    expect(isRfc3339("2026-01-15T08:00:00Z")).toBe(true);
    expect(isRfc3339("2026-01-15T08:00:00+08:00")).toBe(true);
    expect(isRfc3339("2026-01-15T08:00:00.123Z")).toBe(true);
    expect(isRfc3339("2026-01-15T08:00:00")).toBe(false);
    expect(isRfc3339("2026-01-15")).toBe(false);
    expect(isRfc3339("")).toBe(false);
  });

  it("positiveInteger 只接受安全正整数", () => {
    expect(positiveInteger(42354176)).toBe(42354176);
    for (const value of [0, -1, 1.5, "42354176", Number.MAX_SAFE_INTEGER + 2, null, undefined, NaN]) {
      expect(positiveInteger(value)).toBeNull();
    }
  });

  it("isHttpsUrl 只接受不含凭证的 https 绝对地址", () => {
    expect(isHttpsUrl("https://example.com/a.tar.gz")).toBe(true);
    expect(isHttpsUrl("http://example.com/a.tar.gz")).toBe(false);
    expect(isHttpsUrl("https://user:pass@example.com/a.tar.gz")).toBe(false);
    expect(isHttpsUrl("/relative/a.tar.gz")).toBe(false);
    expect(isHttpsUrl("")).toBe(false);
  });

  it("fileNameFromUrl 取路径末段并解码，非法地址返回空串", () => {
    expect(fileNameFromUrl(VALID_RECORD.url)).toBe("bframe-studio_0.4.0_aarch64_arm64.app.tar.gz");
    expect(fileNameFromUrl("https://example.com/%E6%9B%B4%E6%96%B0%E5%8C%85.tar.gz")).toBe("更新包.tar.gz");
    expect(fileNameFromUrl("not-a-url")).toBe("");
  });
});

describe("decideUpdateResponse", () => {
  it("无记录返回 204，这是正常的无更新结果", () => {
    for (const record of [null, undefined, "", 0]) {
      expect(decideUpdateResponse(record, "macos-arm").status).toBe(204);
    }
  });

  it("完整记录返回 200 且同时下发 Rust 必需字段与 UI 附加字段", () => {
    const { status, payload } = decideUpdateResponse(VALID_RECORD, "macos-arm");
    expect(status).toBe(200);
    expect(payload).toEqual({
      platform: "macos-arm",
      version: "0.4.0",
      url: VALID_RECORD.url,
      signature: VALID_RECORD.signature,
      fileName: VALID_RECORD.fileName,
      fileSize: 42354176,
      notes: "修复若干问题",
      pub_date: "2026-01-15T08:00:00Z",
      isForceUpdate: false
    });
  });

  it("v 前缀版本被归一化后下发", () => {
    expect(decideUpdateResponse({ ...VALID_RECORD, version: "v0.4.0" }, "macos-arm").payload.version).toBe("0.4.0");
  });

  it("缺 version / url / signature / fileSize 时返回 503 而不是回退", () => {
    for (const reason of ["version", "url", "signature", "fileSize"]) {
      const record = { ...VALID_RECORD, [reason]: undefined };
      expect(decideUpdateResponse(record, "macos-arm")).toMatchObject({ status: 503, reason });
    }
  });

  it("pub_date 存在但不是带时区的 RFC3339 时返回 503", () => {
    const record = { ...VALID_RECORD, pub_date: "2026-01-15T08:00:00" };
    expect(decideUpdateResponse(record, "macos-arm")).toMatchObject({ status: 503, reason: "pub_date" });
  });

  it("pub_date 缺省视为合法，不阻断下发", () => {
    const record = { ...VALID_RECORD, pub_date: undefined };
    const { status, payload } = decideUpdateResponse(record, "macos-arm");
    expect(status).toBe(200);
    expect(payload.pub_date).toBe("");
  });

  it("fileName 缺省时从 url 推导", () => {
    const record = { ...VALID_RECORD, fileName: "" };
    expect(decideUpdateResponse(record, "macos-arm").payload.fileName).toBe("bframe-studio_0.4.0_aarch64_arm64.app.tar.gz");
  });

  it("isForceUpdate 只在严格布尔 true 时生效", () => {
    expect(buildUpdatePayload({ ...VALID_RECORD, isForceUpdate: true }, "macos-arm").isForceUpdate).toBe(true);
    for (const value of ["true", 1, undefined, null]) {
      expect(buildUpdatePayload({ ...VALID_RECORD, isForceUpdate: value }, "macos-arm").isForceUpdate).toBe(false);
    }
  });

  it("notes 缺省归一化为空字符串，不影响 200", () => {
    const { status, payload } = decideUpdateResponse({ ...VALID_RECORD, notes: undefined }, "macos-arm");
    expect(status).toBe(200);
    expect(payload.notes).toBe("");
  });
});
