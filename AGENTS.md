# BVideo Studio Agent 开发约束

本文档适用于仓库根目录及其全部子目录。若后续某个子目录增加了更具体的 `AGENTS.md`，该子目录内以更具体的文档为准。

## 1. 工作原则

- 修改前先阅读相关实现、相邻测试和本文档，不凭文件名或需求描述猜测现有行为。
- 只改完成当前任务所需的代码；不要顺带重构、不批量改格式、不覆盖用户已有的未提交修改。
- 优先沿用现有依赖、类型、组件和工具函数。新增依赖、全局状态或跨层抽象前，必须先确认现有能力不能满足需求。
- 保持浏览器预览与 Tauri 桌面端的行为边界清晰。依赖文件系统、系统钥匙串、FFmpeg、原生对话框或窗口能力的功能，必须显式处理非 Tauri 环境。
- 不提交密钥、令牌、证书、模型文件、媒体二进制、构建产物或本机绝对路径。环境变量只提交脱敏后的 `.env*.example`。
- 除非任务明确要求，不修改发布签名、更新端点、bundle identifier、平台权限或 CI 发布流程。

## 2. 技术栈与目录职责

- 前端：React 19、TypeScript strict、Vite、Zustand、Radix UI、Lucide，代码位于 `src/`。
- 桌面端：Tauri 2、Rust 2021，代码位于 `src-tauri/`。
- `src/domain/`：工程模型、时间线规则、动效、变换、字幕、渲染计划等纯业务逻辑。这里不访问 DOM、Tauri API 或持久化存储。
- `src/stores/`：Zustand 编辑器状态与用户操作。会改变工程的编辑操作必须维护撤销/重做、工程时长和更新时间等既有语义。
- `src/services/`：浏览器/Tauri 运行时适配、持久化、AI、ASR、媒体及更新服务。组件不要直接散落 `invoke`、存储或网络协议细节。
- `src/components/`：界面、交互和可访问性。复杂计算优先下沉到 domain/service，避免在 JSX 内复制业务规则。
- `src/styles/main.css`：当前全局设计系统和组件样式。新增样式优先复用现有 CSS 变量及类名语义。
- `src-tauri/src/`：文件系统、媒体进程、系统能力、密钥和网络代理等原生实现。
- `scripts/`：构建与发布辅助脚本；`docs/`：外部格式和协议文档；`examples/`：可提交的示例资产。

## 3. 不可破坏的领域约定

- 时间线内部统一使用整数微秒，字段后缀为 `Us`。仅在 UI 展示、外部 API 或媒体工具边界做秒/毫秒转换，避免在领域层混用单位。
- 工程时长应由实际轨道内容和既有规则推导，不在多个位置维护互相独立的真值。
- 移动、裁剪、拆分、插入和替换素材时，必须保持 `sourceInUs`、`playbackRate`、关键帧和相机运动的连续性，并尊重锁定、静音、隐藏轨道。
- 预览和导出必须消费同一组领域数据。增加动效、变换、画中画、音量、字幕或场景能力时，同时检查 `PreviewCanvas` 与 `buildRenderPlan`/Rust FFmpeg 导出链路，不能只实现其中一端。
- 项目文件是用户数据。修改 `EditorProject` 的持久化结构时，必须递增 `schemaVersion`，在 `parseProject` 中兼容迁移受支持的旧版本，并增加序列化、迁移和异常输入测试。
- `objectUrl`、代理 URL 等会话态数据不得写入工程文件；本地源路径及缺失素材恢复继续通过现有 project session/media 服务处理。
- 外部输入不可信。AI 响应继续通过 Zod schema 校验；工程 JSON、动效包、更新清单、IPC 参数和媒体探测结果均需校验或规范化后再进入领域模型。
- API Key 只通过既有安全路径处理：桌面端写入系统钥匙串，浏览器开发预览最多使用会话级存储。不得写日志、localStorage、工程 JSON或错误详情。

## 4. TypeScript 与 React 风格

- 使用 TypeScript strict；不得用 `any`、`@ts-ignore` 或无依据的类型断言绕过类型错误。优先使用联合类型、类型守卫和 Zod schema 收窄未知输入。
- 使用 2 空格缩进、双引号、分号，沿用当前文件的换行和 JSX 排版；不要为无关代码运行全文件格式化。
- 项目内导入使用 `@/` 别名；同目录脚本或 Node 构建脚本可沿用相对路径。类型导入使用 `import type`。
- 组件、类型和模块使用具名导出；React 组件使用 PascalCase，hooks 使用 `useXxx`，普通变量与函数使用 camelCase，常量使用语义明确的 camelCase 或 UPPER_SNAKE_CASE。
- 保持组件 props 和本地状态最小化。可由 store 或 props 推导的数据不要重复存储；副作用放在 `useEffect` 并正确清理事件、计时器、动画帧和取消句柄。
- Zustand selector 只订阅组件实际使用的字段。领域状态修改沿用 store 的集中 action 和 `commit`/克隆模式，不在组件中直接突变工程对象。
- 异步 UI 必须覆盖加载、成功、空数据和可理解的失败状态；可取消的长任务继续传递取消动作并避免卸载后更新状态。
- 用户可见文案沿用简体中文；协议字段、代码标识符和必要日志使用英文。错误提示应说明用户能采取的动作，不暴露密钥或底层敏感信息。
- 注释只解释非显然的约束、兼容性或算法原因，不复述代码。

## 5. 视觉开发约束

- 任何涉及界面结构、组件外观、CSS、主题、图标、动效、响应式布局或交互状态的任务，都必须同时阅读并遵守仓库根目录的 [`DESIGN.md`](DESIGN.md)。
- 视觉约束已独立维护，不在本文重复；若视觉文档与本文冲突，以本文的架构、安全和领域约束为先。

## 6. Tauri、Rust 与系统边界

- 前端通过 `src/services/` 暴露的类型化函数调用 Tauri 命令，不在组件中直接新增 `invoke`。
- 新增 Tauri 命令时，同时完成：Rust 命令实现、`src-tauri/src/lib.rs` 注册、前端 service 封装、请求/响应类型、错误映射和必要的 capability 检查。
- 跨 IPC 的 Rust 结构使用 serde，并与前端现有 camelCase 契约保持一致；不要悄悄更名或改变字段单位。
- 文件路径、包 ID、URL、命令参数和外部进程输出均视为不可信输入。限制文件操作范围，避免 shell 拼接，使用参数化 `Command`，并返回可读错误。
- 长耗时媒体、下载、ASR 和导出任务不得阻塞主线程；沿用 job ID、Channel、状态管理和取消模式，并确保失败或取消后清理子进程与临时资源。
- Rust 代码遵循 `rustfmt`，错误优先向上传递并补充上下文；除启动期不可恢复状态外，不新增 `unwrap()`/`expect()`。
- 平台特定逻辑用 `cfg` 隔离，并考虑 macOS、Windows x64/ARM64 与 Linux x64 的发布矩阵。不要假设 Homebrew 路径或单一 CPU 架构。
- 不手工提交 `src-tauri/binaries/` 中生成的 sidecar；该目录只保留 README，二进制由现有准备脚本生成。

## 7. 测试要求

- 修复缺陷时先增加能复现问题的测试，再修复；新增行为必须覆盖正常路径和最重要的边界/失败路径。
- 纯领域规则放在相邻 `*.test.ts`；组件交互使用 Testing Library，以角色、标签和可见文案查询，避免依赖 DOM 结构细节。
- store 变更需测试撤销/重做、选区/锁定轨道，以及时间和源素材连续性中受影响的部分。
- 工程 schema 变更需测试当前版本 round-trip、上一版本迁移、缺失/畸形字段和不支持版本。
- 预览或导出能力变更需为领域渲染计划增加断言；涉及 Rust 媒体拼接时，至少执行 Rust 检查，并在可行时覆盖命令构建逻辑。
- 发布脚本使用 Node 内建 test runner，测试放在 `scripts/*.test.mjs`，不得混入 Vitest 配置。
- 不通过删除断言、放宽 schema、增加任意等待或跳过测试来让测试变绿。

## 8. 按变更范围执行验证

安装依赖使用 Node 22 和锁文件：

```bash
npm ci
```

前端或共享领域代码至少执行：

```bash
npm run typecheck
npm test
```

发布脚本变更追加执行：

```bash
npm run test:release
```

Rust/Tauri 代码变更追加执行：

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo check --manifest-path src-tauri/Cargo.toml
```

影响生产构建、Vite 配置或依赖时执行：

```bash
npm run build
```

- 优先先跑受影响的单个测试文件，再跑上述完整集合。
- `npm run desktop:build`、签名发布、图标生成和 media sidecar 准备成本高且会产生文件，仅在任务确实涉及对应流程时执行。
- 若因缺少模型、FFmpeg、平台工具链、签名材料或网络而无法验证，最终说明未执行项和原因，不声称已经通过。

## 9. 文档、依赖与交付

- 用户可见行为、环境变量或本地命令发生变化时同步更新 `README.md`；外部契约和 `.bveffect` 格式分别更新 `docs/updater-api.md`、`docs/effect-package-format.md`。
- 修改依赖时使用 npm 并同步提交 `package.json` 与 `package-lock.json`；先确认 Node `>=22 <23` 兼容性，不混用 pnpm/yarn 锁文件。
- 修改 Rust 依赖时同步 `src-tauri/Cargo.toml` 与 `src-tauri/Cargo.lock`，不要手工编辑 lockfile。
- 完成后检查 `git diff` 和 `git status`，确认没有生成物、密钥、临时配置或无关格式改动。
- 交付说明应包含行为变化、关键文件和实际执行的验证命令；存在剩余风险或未验证平台时明确列出。
