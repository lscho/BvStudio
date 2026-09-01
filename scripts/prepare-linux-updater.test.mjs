import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import { prepareLinuxUpdater } from "./prepare-linux-updater.mjs";

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "bvideo-linux-updater-"));
  const appImage = join(directory, "BVideo Studio_0.1.4_amd64.AppImage");
  writeFileSync(appImage, "appimage bytes", "utf8");
  return { directory, appImage, updater: `${appImage}.tar.gz`, signature: `${appImage}.tar.gz.sig` };
}

test("creates and signs a missing Linux updater package", () => {
  const item = fixture();
  const calls = [];
  try {
    const result = prepareLinuxUpdater({
      directory: item.directory,
      tauriPath: "/repo/node_modules/.bin/tauri",
      signingKeyAvailable: true,
      signingPassword: "",
      runner: (command, args) => {
        calls.push({ command, args });
        if (command === "tar") writeFileSync(item.updater, "archive bytes", "utf8");
        else writeFileSync(item.signature, "signature", "utf8");
        return { status: 0, stdout: "", stderr: "" };
      }
    });

    assert.deepEqual(result, { appImage: item.appImage, updater: item.updater, signature: item.signature });
    assert.deepEqual(calls, [
      { command: "tar", args: ["-czf", item.updater, "-C", item.directory, basename(item.appImage)] },
      { command: "/repo/node_modules/.bin/tauri", args: ["signer", "sign", "--password", "", item.updater] }
    ]);
    assert.equal(readFileSync(item.signature, "utf8"), "signature");
  } finally {
    rmSync(item.directory, { recursive: true, force: true });
  }
});

test("keeps an existing signed updater package", () => {
  const item = fixture();
  try {
    writeFileSync(item.updater, "archive bytes", "utf8");
    writeFileSync(item.signature, "signature", "utf8");
    const result = prepareLinuxUpdater({
      directory: item.directory,
      signingKeyAvailable: false,
      runner: () => assert.fail("existing updater should not run external commands")
    });
    assert.equal(result.updater, item.updater);
  } finally {
    rmSync(item.directory, { recursive: true, force: true });
  }
});

test("rejects ambiguous AppImage inputs", () => {
  const item = fixture();
  try {
    writeFileSync(join(item.directory, "duplicate.AppImage"), "duplicate", "utf8");
    assert.throws(() => prepareLinuxUpdater({ directory: item.directory }), /Expected exactly one Linux AppImage/u);
  } finally {
    rmSync(item.directory, { recursive: true, force: true });
  }
});

test("requires a signing key before signing", () => {
  const item = fixture();
  try {
    assert.throws(() => prepareLinuxUpdater({
      directory: item.directory,
      signingKeyAvailable: false,
      runner: (command) => {
        if (command === "tar") {
          writeFileSync(item.updater, "archive bytes", "utf8");
          return { status: 0, stdout: "", stderr: "" };
        }
        return assert.fail("signer should not run without a key");
      }
    }), /Missing TAURI_SIGNING_PRIVATE_KEY/u);
  } finally {
    rmSync(item.directory, { recursive: true, force: true });
  }
});
