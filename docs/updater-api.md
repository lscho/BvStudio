# 桌面更新服务协议（Updater API Contract）

本仓库只实现桌面客户端、签名产物与 `desktop-release-manifest.json` 发布清单，**不实现也不部署**外部更新服务。更新服务是独立部署的公共 HTTPS API，导入 GitHub Release 上的发布清单后对外提供动态更新元数据。

## 端点

```
GET /api/desktop-updates/latest?platform={{target}}
```

`platform` 只能是以下五个值之一（与客户端 `ClientUpdatePlatform` 完全一致）：

| `platform` | 对应目标 |
| --- | --- |
| `windows-x86` | Windows x64（`x86_64-pc-windows-msvc`） |
| `windows-arm` | Windows ARM64（`aarch64-pc-windows-msvc`） |
| `macos-x86` | macOS Intel（`x86_64-apple-darwin`） |
| `macos-arm` | macOS Apple Silicon（`aarch64-apple-darwin`） |
| `linux-x86` | Linux x64（`x86_64-unknown-linux-gnu`） |

## 响应

### 200 — 存在可发布版本

未包装的 JSON 对象：

```json
{
  "platform": "macos-arm",
  "version": "0.2.0",
  "url": "https://github.com/example/tauri-base/releases/download/v0.2.0/tauri-base_0.2.0_aarch64_arm64.app.tar.gz",
  "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpLWJhc2U=",
  "fileName": "tauri-base_0.2.0_aarch64_arm64.app.tar.gz",
  "fileSize": 42354176,
  "notes": "修复若干问题",
  "pub_date": "2026-01-15T08:00:00Z",
  "isForceUpdate": false
}
```

字段约束：

| 字段 | 约束 |
| --- | --- |
| `platform` | 必须是上述五个值之一，且与请求参数一致 |
| `version` | 裸 SemVer（可带 `v` 前缀的标签发布时，记录内必须去掉 `v`），不得附加前缀 |
| `url` | 公共 HTTPS 更新包地址（`macos-*` 为 `*.app.tar.gz`，`windows-*` 为签名 NSIS `.exe`，`linux-*` 为 `*.AppImage.tar.gz`） |
| `signature` | 与更新包完全一致的 `.sig` 文件全文（非空字符串） |
| `fileName` | 与对应平台产物文件名一致 |
| `fileSize` | 正整数（字节数） |
| `notes` | 发布说明文本（可为空字符串） |
| `pub_date` | ISO 8601 时间戳，作为“最新版本”的排序依据 |
| `isForceUpdate` | JSON 布尔值；`true` 时客户端启动即弹出不可关闭的强制更新 |

响应头必须包含 `Cache-Control: no-store`。

### 204 — 无已发布版本

空响应体。这是“无更新”的**正常结果**，不是错误；客户端收到 `204` 后保持当前版本可用，不提示更新。

### 400 — 无效或缺失的 `platform`

`platform` 缺失、为空或不在四个合法值之内。

### 503 — 选中发布的更新元数据不完整

服务已选中最新的发布记录，但该记录的更新包元数据（URL、签名、文件大小等）缺失或不完整，无法安全下发。

## 选择逻辑

服务按 `pub_date` 取**最新一条**已发布记录返回；版本号比较由客户端 Tauri updater 完成，服务不参与。若最新记录没有可用的更新包元数据，应返回 `503` 而不是回退到更旧的记录。

## 外部发布清单导入（desktop-release-manifest.json）

发布工作流（`.github/workflows/build-desktop.yml`）把五个平台的安装包、更新包、签名与 `desktop-release-manifest.json` 一并上传到 GitHub Release。本仓库**不会**主动 POST 清单，也不提供发布数据库；外部更新服务需要：

1. 监听/拉取 `vX.Y.Z` 标签对应的 GitHub Release，下载 `desktop-release-manifest.json`；
2. 校验清单与 Release 资产一致后再发布记录。发布前必须核对：
   - `repository` 与 `tag` 与 Release 所属仓库/标签一致；
   - `commitSha` 与标签指向的提交一致；
   - 平台映射：`windows-x86`/`windows-arm`/`macos-x86`/`macos-arm`/`linux-x86` 五平台齐全；
   - `installer.sourceUrl` / `updater.sourceUrl` 与 Release 资产实际 URL 一致；
   - `fileSize`、`sha256` 与 Release 资产字节一致；
   - 更新包扩展名正确（macOS `.app.tar.gz`、Windows `.exe`、Linux `.AppImage.tar.gz`）且 `signature` 非空、与 `.sig` 资产一致；
   - 已签名的产物字节**不得在签名后重新打包**（重新压缩会破坏签名与哈希）。

## 客户端行为摘要

- 仅在 Tauri 桌面运行时且构建启用了 `VITE_ENABLE_UPDATER=true` 时才请求更新；
- `check({ target, timeout: 15_000 })`，`target` 即上面五个平台值之一，其它 OS/架构返回 `null`；
- 更新包下载后校验签名并安装；`isForceUpdate: true` 时启动即覆盖式提示且不可关闭。

## curl 示例（macos-arm）

```bash
curl -i --no-buffer \
  -H 'Cache-Control: no-store' \
  'https://updates.example.com/api/desktop-updates/latest?platform=macos-arm'
```

- `HTTP/1.1 200` + 上述 JSON → 有新版本，客户端显示更新入口；
- `HTTP/1.1 204` → 无更新，客户端保持当前版本（正常结果，非错误）。
