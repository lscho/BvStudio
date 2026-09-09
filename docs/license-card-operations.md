# 卡密生成与导入操作手册

BVideo Pro 会员卡密的全套操作命令。背景与架构见 [`license-api.md`](license-api.md)；本文只讲操作。

## 前置条件（一次性）

1. **凭证**：已执行 `esa-cli login`（脚本自动复用其登录态），或在 CI 中导出环境变量：

   ```bash
   export ESA_ACCESS_KEY_ID=<RAM子账号AK>       # 需授权 AliyunESAFullAccess
   export ESA_ACCESS_KEY_SECRET=<RAM子账号SK>
   ```

   凭证优先级：环境变量 > `~/.esa/config/default.toml`（esa-cli 登录态）。

2. **命名空间**：默认读取 `edge/config.js` 的 `KV_NAMESPACE`（该文件已 gitignore，仅本机存在）。所有命令均可用 `--namespace <名称>` 临时覆盖。

3. **快捷命令**：均通过 `npm run` 执行，工作目录自动固定在仓库根目录，不存在相对路径问题。

---

## 一、生成并导入（最常用）

```bash
npm run esa:import -- --count 100 --plan lifetime
npm run esa:import -- --count 100 --plan monthly
```

一次完成：生成 N 张卡密 → 通过 ESA OpenAPI `PutKv` 写入 EdgeKV → 终端打印**纯卡密列表**（每行一张，可直接复制或重定向 `> cards.txt`）。完整数据（明文、哈希、掩码）同时写入本地清单文件。

**参数表**：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `--count N` | 否（默认 1） | 生成数量，1–10000 |
| `--plan lifetime` | 三选一 | 永久卡，不过期 |
| `--plan monthly` | 三选一 | 月卡，兑换后固定 30 天到期（不接受 `--days`） |
| `--plan period --days N` | 三选一 | 限时卡，兑换后 N 天到期（如 `--days 365`） |
| `--input <file.json>` | 否 | 跳过生成，导入已有清单（见下） |
| `--output <file.json>` | 否 | 指定清单文件名（默认 `license-cards-<时间戳>.json`） |
| `--namespace <名称>` | 否 | 覆盖默认命名空间 |
| `--dry-run` | 否 | 只生成和打印，不上传 |

注意：`--plan`/`--days` 在生成时**烧进卡密记录**，导入后不可修改；发错批次只能吊销重发。

**输出文件**：`license-cards-<时间戳>.json` 已被 `.gitignore` 忽略，含卡密明文——发放后离线妥善保管或删除，严禁提交、严禁聊天/工单中传播。

## 二、只生成不入库（先留档、择期导入）

```bash
node scripts/generate-license-cards.mjs --count 100 --plan lifetime --output license-cards-batch1.json
node scripts/generate-license-cards.mjs --count 100 --plan monthly --output license-cards-monthly.json
node scripts/generate-license-cards.mjs --count 50 --plan period --days 365 --output license-cards-yearly.json
```

参数同上表（无 `--input`/`--dry-run`）。生成后择期导入：

```bash
npm run esa:import -- --input license-cards-batch1.json
```

`PutKv` 幂等（同键覆盖同值），`--input` 重放整批是安全的：部分失败后重跑同命令即可补齐，不会产生重复卡。

## 三、导入已有清单（补发 / 重放）

```bash
npm run esa:import -- --input license-cards-1788841471548.json
```

输入清单格式：`{ "cards": [ { "cardKey", "kvKey", "kvValue" }, … ] }`（即生成脚本的输出）。

## 四、清理 KV（吊销全部 / 按前缀）

```bash
npm run esa:clear-kv                  # 清空命名空间全部键（危险，不可恢复）
npm run esa:clear-kv -- --prefix device:   # 只清设备绑定记录
npm run esa:clear-kv -- --dry-run     # 只列出将删除的键，不执行
```

| 参数 | 说明 |
| --- | --- |
| `--prefix <前缀>` | 只清理匹配前缀（`card:` / `device:` / `fail:`） |
| `--namespace <名称>` | 覆盖默认命名空间 |
| `--dry-run` | 只列出，不删除 |

单张卡吊销不要用全量清理：在控制台 KV 页把对应 `card:*` 的 `status` 改为 `"revoked"`，绑定设备下次联网 verify 自动降级。

---

## 卡密数据模型（kvValue 字段）

| 字段 | 说明 |
| --- | --- |
| `status` | `unused` → `bound`（兑换）→ 可手动改 `revoked`（吊销） |
| `plan` | `lifetime` \| `monthly` \| `period` |
| `days` | `monthly` 固定 30，`period` 为生成时指定的有效天数，`lifetime` 为 `null` |
| `maskedKey` | 脱敏展示（如 `VIP-****S7TD`），写进设备记录供客户端显示 |
| `hash` | 卡密明文的 SHA-256，即 KV 键 `card:<hash>` 的来源 |
| `issuedAt` | 生成时间戳 |

卡密明文**不写入 KV**，只存在于清单文件与发放渠道。字符集剔除易混淆的 `I/L/O/0/1`，格式 `VIP-XXXX-XXXX-XXXX-XXXX`。

月卡（`plan: "monthly"`）记录里同样写入 `days: 30`，因此即使边缘函数尚未更新，兑换后仍按 30 天正确到期，只是客户端展示为「30 天 VIP 会员」；部署最新 `edge/license-core.mjs` 后展示为「月卡 VIP 会员」。

## 常见问题

| 现象 | 原因与处理 |
| --- | --- |
| `Throttling.Api: Request was denied due to user flow control` | ESA OpenAPI 限流。脚本已自动退避重试 5 次，重跑 `--input` 同一清单即可补齐；频繁触发可拆小批或提工单调配额 |
| 导入成功但兑换提示"卡密不存在" | EdgeKV 最终一致，写入后全球同步需数秒到几十秒，稍后重试 |
| 删除时报 `InvalidKey.NotFound` | 已按"删除成功"处理（列表最终一致重复返回旧键），无需干预 |
| 兑换成功后立即在其他节点 verify 无会员状态 | 同上，等同步完成；客户端 72h 离线宽限期内不受影响 |
| `缺少凭证` | 未 `esa-cli login` 且未导出环境变量，二选一 |
| `未指定命名空间` | 本机无 `edge/config.js` 且未传 `--namespace` |

## 测试

```bash
node --test scripts/generate-license-cards.test.mjs scripts/import-license-cards.test.mjs scripts/clear-kv.test.mjs
# 或随发布测试全量：npm run test:release
```
