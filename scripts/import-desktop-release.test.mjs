import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideUpdateResponse, releaseKeyFor } from "../edge/release-core.mjs";
import { handleUpdateRequest } from "../edge/update-server.mjs";
import {
  buildReleaseRecords,
  compareSemver,
  decideImport,
  deriveUpdaterUrl,
  importReleaseRecords
} from "./import-desktop-release.mjs";

const UPDATER_FILE_NAMES = {
  "windows-x86": "bframe-studio_0.4.0_x64-setup.exe",
  "macos-arm": "bframe-studio_0.4.0_aarch64_arm64.app.tar.gz"
};

/** Windows 的安装包与更新包是同一个 NSIS `.exe`；macOS 上是两个不同文件。 */
const INSTALLER_FILE_NAMES = {
  "windows-x86": "bframe-studio_0.4.0_x64-setup.exe",
  "macos-arm": "bframe-studio_0.4.0_arm64.dmg"
};

const UPDATER_FILE_SIZE = 42354176;
const INSTALLER_FILE_SIZE = 25165824;
const RELEASE_ASSET_BASE = "https://github.com/example/bframe-studio/releases/download/v0.4.0";

function validManifest(overrides = {}) {
  return {
    schemaVersion: 1,
    version: "0.4.0",
    tag: "v0.4.0",
    generatedAt: "2026-01-15T08:00:00.000Z",
    repository: "example/bframe-studio",
    commitSha: "abc123",
    platforms: Object.entries(UPDATER_FILE_NAMES).map(([platform, updaterFileName]) => {
      const installerFileName = INSTALLER_FILE_NAMES[platform];
      return {
        platform,
        installer: {
          fileName: installerFileName,
          fileSize: INSTALLER_FILE_SIZE,
          sha256: "0".repeat(64),
          sourceUrl: `${RELEASE_ASSET_BASE}/${installerFileName}`
        },
        updater: {
          fileName: updaterFileName,
          fileSize: UPDATER_FILE_SIZE,
          sha256: "1".repeat(64),
          sourceUrl: `${RELEASE_ASSET_BASE}/${updaterFileName}`,
          signatureFileName: `${updaterFileName}.sig`,
          signature: "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZQ=="
        }
      };
    }),
    ...overrides
  };
}

function createFakeKv(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    async get(namespace, key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(namespace, key, value) {
      store.set(key, value);
    }
  };
}

describe("compareSemver", () => {
  it("按 patch / minor / major 依次比较", () => {
    assert.equal(compareSemver("0.4.0", "0.4.0"), 0);
    assert.equal(compareSemver("0.4.1", "0.4.0"), 1);
    assert.equal(compareSemver("0.3.9", "0.4.0"), -1);
    assert.equal(compareSemver("1.0.0", "0.99.99"), 1);
    assert.equal(compareSemver("0.10.0", "0.9.0"), 1);
    assert.equal(compareSemver("v0.4.0", "0.4.0"), 0);
  });

  it("预发布版本小于同号正式版，预发布之间按标识符逐个比较", () => {
    assert.equal(compareSemver("1.0.0-rc.1", "1.0.0"), -1);
    assert.equal(compareSemver("1.0.0", "1.0.0-rc.1"), 1);
    assert.equal(compareSemver("1.0.0-alpha", "1.0.0-beta"), -1);
    assert.equal(compareSemver("1.0.0-rc.2", "1.0.0-rc.10"), -1);
    assert.equal(compareSemver("1.0.0-rc.1", "1.0.0-rc.1.1"), -1);
  });

  it("无法解析时返回 null", () => {
    for (const value of ["", "0.4", "0.4.0.1", "latest"]) {
      assert.equal(compareSemver(value, "0.4.0"), null);
      assert.equal(compareSemver("0.4.0", value), null);
    }
  });
});

describe("deriveUpdaterUrl", () => {
  it("按 repository + tag + 文件名推导 GitHub Release 资产地址", () => {
    const manifest = validManifest();
    assert.equal(
      deriveUpdaterUrl(manifest, { ...manifest.platforms[0].updater, sourceUrl: null }),
      `https://github.com/example/bframe-studio/releases/download/v0.4.0/${UPDATER_FILE_NAMES["windows-x86"]}`
    );
  });

  it("缺少 repository 或 tag 或文件名时返回空串", () => {
    const manifest = validManifest();
    const updater = { ...manifest.platforms[0].updater, sourceUrl: null };
    assert.equal(deriveUpdaterUrl({ ...manifest, repository: null }, updater), "");
    assert.equal(deriveUpdaterUrl({ ...manifest, tag: null }, updater), "");
    assert.equal(deriveUpdaterUrl(manifest, { ...updater, fileName: "" }), "");
  });
});

describe("buildReleaseRecords", () => {
  it("完整清单产出白名单内两平台记录，字段与客户端契约一致", () => {
    const { records, problems } = buildReleaseRecords(validManifest(), { notes: "修复若干问题" });
    assert.deepEqual(problems, []);
    assert.equal(records.length, 2);
    assert.deepEqual(
      records.map((record) => record.platform),
      ["windows-x86", "macos-arm"]
    );

    const macosArm = records.find((record) => record.platform === "macos-arm");
    assert.deepEqual(macosArm, {
      platform: "macos-arm",
      version: "0.4.0",
      url: `${RELEASE_ASSET_BASE}/${UPDATER_FILE_NAMES["macos-arm"]}`,
      signature: "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZQ==",
      fileName: UPDATER_FILE_NAMES["macos-arm"],
      fileSize: UPDATER_FILE_SIZE,
      installerUrl: `${RELEASE_ASSET_BASE}/${INSTALLER_FILE_NAMES["macos-arm"]}`,
      installerFileName: INSTALLER_FILE_NAMES["macos-arm"],
      installerFileSize: INSTALLER_FILE_SIZE,
      notes: "修复若干问题",
      pub_date: "2026-01-15T08:00:00.000Z",
      isForceUpdate: false,
      tag: "v0.4.0",
      repository: "example/bframe-studio",
      commitSha: "abc123",
      importedAt: macosArm.importedAt
    });
  });

  it("区分安装包与更新包地址：macOS 不同、Windows 同一个", () => {
    const { records } = buildReleaseRecords(validManifest());
    const byPlatform = Object.fromEntries(records.map((record) => [record.platform, record]));

    assert.notEqual(byPlatform["macos-arm"].installerUrl, byPlatform["macos-arm"].url);
    assert.match(byPlatform["macos-arm"].installerUrl, /\.dmg$/);
    assert.match(byPlatform["macos-arm"].url, /\.app\.tar\.gz$/);

    // Windows 的 NSIS 安装包同时充当更新包
    assert.equal(byPlatform["windows-x86"].installerUrl, byPlatform["windows-x86"].url);
  });

  it("pub_date 默认取清单 generatedAt，可用参数覆盖", () => {
    const fallback = buildReleaseRecords(validManifest());
    assert.equal(fallback.records[0].pub_date, "2026-01-15T08:00:00.000Z");

    const overridden = buildReleaseRecords(validManifest(), { pubDate: "2026-02-01T00:00:00+08:00" });
    assert.equal(overridden.records[0].pub_date, "2026-02-01T00:00:00+08:00");
  });

  it("无时区的 pub_date 会被判为非法，避免客户端整个响应解析失败", () => {
    const { problems } = buildReleaseRecords(validManifest(), { pubDate: "2026-02-01T00:00:00" });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /RFC3339/);
  });

  it("强制更新标记只在 --force-update 时写入记录", () => {
    assert.equal(buildReleaseRecords(validManifest(), { isForceUpdate: true }).records[0].isForceUpdate, true);
    assert.equal(buildReleaseRecords(validManifest()).records[0].isForceUpdate, false);
  });

  it("v 前缀版本被归一化后再入库", () => {
    assert.equal(buildReleaseRecords(validManifest({ version: "v0.4.0" })).records[0].version, "0.4.0");
  });

  it("清单缺少平台时不再整批中止，改为只发布已有平台并提示缺失项", () => {
    const manifest = validManifest();
    manifest.platforms = manifest.platforms.filter((entry) => entry.platform !== "macos-arm");
    const { records, problems, missingPlatforms } = buildReleaseRecords(manifest);
    assert.deepEqual(problems, []);
    assert.equal(records.length, 1);
    assert.deepEqual(missingPlatforms, ["macos-arm"]);
  });

  it("平台齐全时不报告缺失平台", () => {
    const { missingPlatforms } = buildReleaseRecords(validManifest());
    assert.deepEqual(missingPlatforms, []);
  });

  it("签名、fileSize、sourceUrl 异常时逐项报告", () => {
    const manifest = validManifest();
    manifest.platforms[0].updater.signature = "   ";
    manifest.platforms[1].updater.fileSize = 0;
    manifest.platforms[1].installer.sourceUrl = "http://insecure.example.com/a.dmg";
    const { problems } = buildReleaseRecords(manifest);
    const joined = problems.join("\n");
    assert.equal(problems.length, 3);
    assert.match(joined, /windows-x86 更新包签名缺失或为空/);
    assert.match(joined, /macos-arm 更新包 fileSize 不是正整数/);
    assert.match(joined, /macos-arm 清单中的安装包 sourceUrl 不是合法的 https 地址/);
  });

  it("sourceUrl 非法时不做静默替换，且缺失时按 tag 推导仍可发布", () => {
    const broken = validManifest();
    broken.platforms[0].updater.sourceUrl = "http://insecure.example.com/a.exe";
    const brokenProblems = buildReleaseRecords(broken).problems;
    assert.equal(brokenProblems.length, 1);
    assert.match(brokenProblems[0], /windows-x86 清单中的 sourceUrl 不是合法的 https 地址/);

    const derived = validManifest();
    for (const entry of derived.platforms) entry.updater.sourceUrl = null;
    const { records, problems } = buildReleaseRecords(derived);
    assert.deepEqual(problems, []);
    assert.match(records[0].url, /^https:\/\/github\.com\/example\/bframe-studio\/releases\/download\/v0\.4\.0\//);
  });

  it("version 非法、含未知平台时报告问题", () => {
    const manifest = validManifest({ version: "0.4" });
    manifest.platforms.push({ platform: "darwin-aarch64" });
    // linux-x86 是历史平台值，白名单裁剪后同样按未知平台拒绝
    manifest.platforms.push({ platform: "linux-x86" });
    const { problems } = buildReleaseRecords(manifest);
    assert.match(problems.join("\n"), /version 不是合法 SemVer/);
    assert.match(problems.join("\n"), /清单含未知平台/);
  });
});

describe("decideImport", () => {
  const candidate = { platform: "macos-arm", version: "0.4.0" };

  it("无既有记录时直接发布", () => {
    assert.deepEqual(decideImport({ existing: null, candidate }), { action: "publish" });
    assert.deepEqual(decideImport({ existing: undefined, candidate }), { action: "publish" });
  });

  it("待导入版本更高时发布，同版本时覆盖并告警", () => {
    assert.deepEqual(decideImport({ existing: { version: "0.3.9" }, candidate }), { action: "publish" });
    const same = decideImport({ existing: { version: "0.4.0" }, candidate });
    assert.equal(same.action, "publish");
    assert.match(same.warning, /同版本重复导入/);
  });

  it("已发布版本更高时跳过，避免重跑旧 tag 造成回滚", () => {
    const decision = decideImport({ existing: { version: "0.5.0" }, candidate });
    assert.equal(decision.action, "skip");
    assert.match(decision.reason, /0\.5\.0 高于待导入的 0\.4\.0/);
  });

  it("显式允许时才执行降级发布", () => {
    const decision = decideImport({ existing: { version: "0.5.0" }, candidate, allowDowngrade: true });
    assert.equal(decision.action, "publish");
    assert.match(decision.warning, /降级发布/);
  });
});

describe("importReleaseRecords", () => {
  const records = buildReleaseRecords(validManifest()).records;

  it("逐平台写入发布记录键", async () => {
    const kv = createFakeKv();
    const { failures, skipped } = await importReleaseRecords({ records, namespace: "bframe_studio", kv });
    assert.deepEqual(failures, []);
    assert.deepEqual(skipped, []);
    assert.deepEqual([...kv.store.keys()].sort(), records.map((record) => releaseKeyFor(record.platform)).sort());
    assert.equal(JSON.parse(kv.store.get("release:latest:macos-arm")).version, "0.4.0");
  });

  it("已发布版本更高时跳过该平台且不覆盖", async () => {
    const kv = createFakeKv({ "release:latest:macos-arm": JSON.stringify({ version: "9.9.9" }) });
    const { skipped, failures } = await importReleaseRecords({ records, namespace: "bframe_studio", kv });
    assert.deepEqual(failures, []);
    assert.deepEqual(skipped, [{ platform: "macos-arm", reason: "已发布版本 9.9.9 高于待导入的 0.4.0" }]);
    assert.equal(JSON.parse(kv.store.get("release:latest:macos-arm")).version, "9.9.9");
  });

  it("单个平台写入失败只影响该平台，并汇报失败项", async () => {
    const kv = createFakeKv();
    const failing = {
      async get(namespace, key) {
        return kv.get(namespace, key);
      },
      async put(namespace, key, value) {
        if (key === "release:latest:macos-arm") throw new Error("boom");
        return kv.put(namespace, key, value);
      }
    };
    const { failures, skipped } = await importReleaseRecords({ records, namespace: "bframe_studio", kv: failing });
    assert.equal(failures.length, 1);
    assert.deepEqual(skipped, []);
    assert.equal(failures[0].platform, "macos-arm");
    assert.equal(kv.store.size, 1);
  });

  it("既有记录不是合法 JSON 时告警并覆盖", async () => {
    const kv = createFakeKv({ "release:latest:windows-x86": "not-json" });
    const events = [];
    await importReleaseRecords({ records, namespace: "bframe_studio", kv, onEvent: (event) => events.push(event) });
    assert.match(events.find((event) => event.type === "warning").message, /不是合法 JSON/);
    assert.equal(JSON.parse(kv.store.get("release:latest:windows-x86")).version, "0.4.0");
  });
});

describe("导入产物与边缘响应的契约", () => {
  const records = buildReleaseRecords(validManifest(), { notes: "修复若干问题" }).records;

  it("每一条导入记录都能直接下发为 200，不会因字段不合格变成 503", () => {
    for (const record of records) {
      const decision = decideUpdateResponse(record, record.platform);
      assert.equal(decision.status, 200, `${record.platform} 应可下发`);
      assert.equal(decision.payload.url, record.url);
      assert.equal(decision.payload.signature, record.signature);
      assert.equal(decision.payload.fileName, record.fileName);
      assert.equal(decision.payload.fileSize, record.fileSize);
    }
  });

  it("写入 KV 后经边缘处理层返回客户端所需字段", async () => {
    const kv = createFakeKv();
    await importReleaseRecords({ records, namespace: "bframe_studio", kv });
    const response = await handleUpdateRequest(
      new Request("https://license.example.com/api/desktop-updates/latest?platform=macos-arm"),
      {
        kv: {
          async get(key) {
            const raw = kv.store.get(key);
            return raw ? JSON.parse(raw) : null;
          }
        }
      }
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      platform: "macos-arm",
      version: "0.4.0",
      url: `https://github.com/example/bframe-studio/releases/download/v0.4.0/${UPDATER_FILE_NAMES["macos-arm"]}`,
      signature: "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZQ==",
      fileName: UPDATER_FILE_NAMES["macos-arm"],
      fileSize: 42354176,
      notes: "修复若干问题",
      pub_date: "2026-01-15T08:00:00.000Z",
      isForceUpdate: false
    });
  });
});
