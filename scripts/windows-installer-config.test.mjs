import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const tauriConfig = JSON.parse(readFileSync(`${repoRoot}/src-tauri/tauri.conf.json`, "utf8"));
const installerTemplate = readFileSync(`${repoRoot}/src-tauri/windows/installer.nsi`, "utf8");

test("builds the NSIS installer in Simplified Chinese without a language selector", () => {
  assert.deepEqual(tauriConfig.bundle?.windows?.nsis?.languages, ["SimpChinese"]);
  assert.equal(tauriConfig.bundle?.windows?.nsis?.displayLanguageSelector, false);
});

test("uses the shortcut-safe custom NSIS template and the Windows icon", () => {
  assert.equal(tauriConfig.bundle?.windows?.nsis?.template, "windows/installer.nsi");
  assert.equal(tauriConfig.bundle?.windows?.nsis?.installerIcon, "icons-macos26/icon.ico");
  assert.match(installerTemplate, /Unicode true/u);
  assert.match(installerTemplate, /Function CreateOrUpdateDesktopShortcut/u);
  assert.match(installerTemplate, /CreateShortcut "\$DESKTOP\\\$\{PRODUCTNAME\}\.lnk" "\$INSTDIR\\\$\{MAINBINARYNAME\}\.exe"/u);
  assert.doesNotMatch(installerTemplate, /^\s*!insertmacro SetLnkAppUserModelId/gmu);
});
