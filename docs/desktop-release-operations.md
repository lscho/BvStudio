# 桌面更新发布操作手册

把 GitHub Release 上的 `desktop-release-manifest.json` 导入 EdgeKV，让客户端能查到新版本。协议与字段定义见 [`updater-api.md`](updater-api.md)；本文只讲操作。

## 前置条件（一次性）

1. **凭证**：已执行 `esa-cli login`（脚本自动复用其登录态），或在 CI 中导出环境变量：

   ```bash
   export ESA_ACCESS_KEY_ID=<RAM子账号AK>       # 需授权 AliyunESAFullAccess
   export ESA_ACCESS_KEY_SECRET=<RAM子账号SK>
   ```

   凭证优先级：环境变量 > `~/.esa/config/default.toml`（esa-cli 登录态）。

2. **命名空间**：默认读取 `edge/config.js` 的 `KV_NAMESPACE`（该文件已 gitignore，仅本机存在）。更新记录与卡密共用同一个命名空间，可用 `--namespace <名称>` 临时覆盖。

3. **服务已部署**：`edge/` 代码已通过 `npm run esa:commit && npm run esa:deploy` 上线。

4. **GitHub 仓库变量**：`TAURI_UPDATER_ENDPOINT` 指向 ESA 域名并带 `{{target}}` 占位符：

   ```
   https://<你的 ESA 域名>/api/desktop-updates/latest?platform={{target}}
   ```

   该变量只在**发布构建**时经 `scripts/write-tauri-release-config.mjs` 注入临时配置，不会改写仓库里的 `src-tauri/tauri.conf.json`。未配置时客户端编译期即关闭更新检查，不会发起任何请求。

---

## 一、标准发布流程

```bash
# 1. 推送严格 SemVer 标签，触发 build-desktop 工作流（五平台构建 + 签名 + 生成清单）
git tag v0.4.0 && git push origin v0.4.0

# 2. 从 Release 资产或 workflow artifact 取回 desktop-release-manifest.json
#    （artifact 名 tauri-base-desktop-release-manifest，内部路径 release-manifest/desktop-release-manifest.json）

# 3. 先空跑，确认五个平台的地址与版本无误
npm run esa:import-release -- --manifest ./desktop-release-manifest.json --notes "修复导出偶发失败" --dry-run

# 4. 正式导入
npm run esa:import-release -- --manifest ./desktop-release-manifest.json --notes "修复导出偶发失败"

# 5. 核对线上响应
curl -i 'https://<你的 ESA 域名>/api/desktop-updates/latest?platform=macos-arm'
```

第 3 步的 `--dry-run` 输出就是将要写入 EdgeKV 的完整记录（含每个平台的更新包地址），先看一遍能拦住绝大多数发布事故。

## 二、参数表

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `--manifest <path>` | 否（默认 `desktop-release-manifest.json`） | 发布清单路径 |
| `--notes "<文本>"` | 否 | 更新说明，进入客户端「更新内容」 |
| `--notes-file <path>` | 否 | 从文件读更新说明（与 `--notes` 二选一，优先） |
| `--force-update` | 否 | 标记为强制更新，客户端启动即弹出不可关闭的更新提示 |
| `--pub-date <RFC3339>` | 否 | 覆盖 `pub_date`，默认取清单的 `generatedAt`（必须带时区） |
| `--allow-downgrade` | 否 | 允许用工更低版本覆盖已发布版本 |
| `--namespace <名称>` | 否 | 覆盖默认命名空间 |
| `--dry-run` | 否 | 只校验并打印将写入的记录，不上传 |

脚本**先全量校验再整体写入**：五个平台任一项不合格（版本非 SemVer、缺平台、签名为空、`fileSize` 非正整数、更新包地址不合法、`pub_date` 无时区）都会整批中止并以退出码 1 结束，不会出现「部分平台已更新」的中间状态。

`putKv` 是幂等的：写一半失败时重跑同一命令即可补齐，不会产生重复记录。

## 三、强制更新

```bash
npm run esa:import-release -- --manifest ./desktop-release-manifest.json \
  --notes "为修复数据损坏问题，此版本必须更新" --force-update
```

克制使用。`--force-update` 写出的 `isForceUpdate: true` 会让所有低于该版本的客户端**启动即被不可关闭的弹窗拦住**，包括正在导出工程或离线编辑的用户。建议只在数据损坏、协议不兼容或安全问题这类「旧版本继续用会出事」的场景使用。

强制状态是发布记录的一个属性，不写入发布清单。需要撤回时重新导入同版本、不带 `--force-update` 即可覆盖（同版本导入会打印告警后覆盖）。

## 四、更新说明

```bash
npm run esa:import-release -- --manifest ./desktop-release-manifest.json --notes-file CHANGELOG.md
```

说明文本会原样显示在更新弹窗里，建议一段话、面向用户描述变化，不要粘贴 commit 列表。留空则客户端不显示「更新内容」区块。

## 五、回滚与降级

发布记录按平台独立，回滚某个平台只需重新导入一份对应版本的清单：

```bash
# 让 0.4.0 重新指向更早的 0.3.x 清单（必须显式允许降级）
npm run esa:import-release -- --manifest ./desktop-release-manifest.json.0.3.2 --allow-downgrade
```

默认拒绝降级是有意的：重跑一份旧 tag 的清单如果静默生效，会把全体客户端推回旧版本。需要回滚时请确认目标清单确实指向你想要的产物。

> 已经升级到新版的客户端不会因为服务端回滚而降级——Tauri updater 只在 `release.version > current_version` 时提示更新。回滚的实际效果是**阻止还没升级的用户升到问题版本**。

彻底下线某个平台的更新提示，用 `esa:clear-kv` 删掉指针键，客户端随后收到 204：

```bash
npm run esa:clear-kv -- --prefix release:latest: --dry-run
npm run esa:clear-kv -- --prefix release:latest:
```

## 六、清理

```bash
npm run esa:clear-kv -- --prefix release:                        # 清全部发布记录
npm run esa:clear-kv -- --prefix release:latest:macos-arm        # 只清某个平台
```

`clear-kv` 会同时影响卡密与设备记录，加 `--prefix` 限定范围，先 `--dry-run` 看一遍。

## 七、本地验证链路

```bash
npx vitest run edge/        # 边缘函数纯逻辑与请求处理层
npm run test:release        # 发布脚本测试（含清单校验与跨模块契约）

npm run esa:dev             # 本地起边缘函数，可在根目录放 kv.json 模拟 EdgeKV 数据
curl -i 'http://localhost:<port>/api/desktop-updates/latest?platform=macos-arm'
```

本地 `esa:dev` 里手工构造一条 `release:latest:macos-arm` 记录，就能在不碰线上的前提下验证响应字段。

## 常见问题

| 现象 | 原因与处理 |
| --- | --- |
| 客户端不提示更新 | 先 `curl` 端点确认不是 204；再确认发布构建时 `TAURI_UPDATER_ENDPOINT` 已配置（未配置则客户端根本不会请求） |
| `platform 参数缺失或不受支持` | 端点模板里的 `{{target}}` 占位符丢失，或被写成了 `darwin-aarch64` 之类的 Tauri 默认目标名 |
| `更新包元数据不完整`（503） | 该平台记录缺 URL/签名/文件大小，通常是手工改过 KV。重新跑 `esa:import-release` 覆盖 |
| 导入报 `已发布版本 x 高于待导入的 y` | 保护机制命中。确认确实要回滚时加 `--allow-downgrade` |
| 导入报 `sourceUrl 不是合法的 https 地址` | 非 tag 推送的构建产物 `sourceUrl` 为 null，由脚本按 `repository` + `tag` 推导；若清单里已有非空但非 https 的值，说明清单被改坏，需重新生成 |
| `Throttling.Api: Request was denied due to user flow control` | ESA OpenAPI 限流。脚本自动退避重试 5 次；只有 5 条记录，重跑即可 |
| 导入成功但客户端仍收不到 | EdgeKV 最终一致，全球同步需数秒到几十秒，稍后重试 |
| 升级后客户端报签名校验失败 | 产物在签名后被重新打包，哈希已变。必须发布未重新压缩的原始产物 |

## 测试

```bash
node --test scripts/import-desktop-release.test.mjs
# 或随发布测试全量：npm run test:release
```
