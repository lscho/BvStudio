import { describe, expect, it } from "vitest";
import { releaseKeyFor } from "./release-core.mjs";
import { handleUpdateRequest, isUpdateRoute } from "./update-server.mjs";

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

function createFakeKv(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    async get(key) {
      return store.has(key) ? structuredClone(store.get(key)) : null;
    }
  };
}

function request(query = "?platform=macos-arm", { method = "GET" } = {}) {
  return new Request(`https://license.example.com/api/desktop-updates/latest${query}`, { method });
}

function kvSeeded(record = VALID_RECORD, platform = "macos-arm") {
  return createFakeKv({ [releaseKeyFor(platform)]: record });
}

describe("isUpdateRoute", () => {
  it("只匹配更新端点，容忍尾部斜杠", () => {
    expect(isUpdateRoute("/api/desktop-updates/latest")).toBe(true);
    expect(isUpdateRoute("/api/desktop-updates/latest/")).toBe(true);
  });

  it("不吞掉授权接口或子路径", () => {
    expect(isUpdateRoute("/api/license/verify")).toBe(false);
    expect(isUpdateRoute("/api/desktop-updates/latest/extra")).toBe(false);
    expect(isUpdateRoute("/api/desktop-updates")).toBe(false);
    expect(isUpdateRoute("/")).toBe(false);
  });
});

describe("handleUpdateRequest", () => {
  it("命中发布记录时返回 200 与动态格式字段", async () => {
    const response = await handleUpdateRequest(request(), { kv: kvSeeded() });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await response.json()).toEqual({
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

  it("无记录时返回 204 空响应体，且仍带 no-store", async () => {
    const response = await handleUpdateRequest(request("?platform=windows-x86"), { kv: createFakeKv() });
    expect(response.status).toBe(204);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toBe("");
  });

  it("记录存在但元数据不完整时返回 503", async () => {
    const kv = kvSeeded({ ...VALID_RECORD, signature: "" });
    const response = await handleUpdateRequest(request(), { kv });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ message: "更新包元数据不完整，请稍后重试" });
  });

  it("platform 缺失或非法时返回 400", async () => {
    for (const query of ["", "?platform=", "?platform=darwin-aarch64", "?platform=macos-arm64"]) {
      const response = await handleUpdateRequest(request(query), { kv: createFakeKv() });
      expect(response.status).toBe(400);
    }
  });

  it("非 GET 请求返回 405，OPTIONS 预检返回 204 与 CORS 头", async () => {
    const kv = createFakeKv();
    const created = await handleUpdateRequest(request("?platform=macos-arm", { method: "POST" }), { kv });
    expect(created.status).toBe(405);

    const preflight = await handleUpdateRequest(request("", { method: "OPTIONS" }), { kv });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
  });

  it("KV 读取异常时返回 500 而不是抛出", async () => {
    const kv = {
      async get() {
        throw new Error("kv unavailable");
      }
    };
    const response = await handleUpdateRequest(request(), { kv });
    expect(response.status).toBe(500);
  });

  it("按平台分别读取，互不串号", async () => {
    const kv = createFakeKv({
      [releaseKeyFor("macos-arm")]: VALID_RECORD,
      [releaseKeyFor("windows-x86")]: { ...VALID_RECORD, platform: "windows-x86", url: "https://example.com/setup.exe" }
    });
    const arm = await handleUpdateRequest(request("?platform=macos-arm"), { kv });
    const win = await handleUpdateRequest(request("?platform=windows-x86"), { kv });
    const linux = await handleUpdateRequest(request("?platform=linux-x86"), { kv });
    expect((await arm.json()).url).toBe(VALID_RECORD.url);
    expect((await win.json()).url).toBe("https://example.com/setup.exe");
    // linux-x86 已随构建矩阵裁剪移出白名单，必须与其他平台一样拿到 400 而不是 204
    expect(linux.status).toBe(400);
  });
});
