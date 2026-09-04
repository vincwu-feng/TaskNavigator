<h1 align="center">TaskNavigator</h1>

<p align="center">
  <img src="renderer/assets/tasknavigator-mark.png" width="112" alt="TaskNavigator"/>
</p>

<p align="center">
  <strong>AI 回复的"第二双眼睛"</strong><br/>
  <em>A neutral second pair of eyes on your AI coding agent</em>
</p>

<p align="center">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-blue.svg"/>
  <img alt="node" src="https://img.shields.io/badge/node-%3E%3D18-green.svg"/>
  <img alt="platform" src="https://img.shields.io/badge/platform-Windows-lightgrey.svg"/>
  <img alt="llm" src="https://img.shields.io/badge/works%20without%20API%20key-yes-success.svg"/>
</p>

---

## 定位 / Positioning

> **TaskNavigator 不替 AI 写代码，只做一件事：每轮回复后，用客观证据检查"这轮是真完成了，还是在糊弄你"。没完成，就弹一句"你该跟它说这句"，复制粘贴就能继续。**

> **It doesn't write code and it doesn't review code. After every turn it asks one question using objective evidence: did the AI actually finish, or is it bluffing? If not, it hands you the exact sentence to send back.**
<img width="2150" height="1336" alt="image" src="https://github.com/user-attachments/assets/1bb0c0e4-0ed8-4dd1-a6db-86d5c103c51b" />

**核心痛点**：AI 每次交活都特别自信，结果一运行全是坑——光判断它到底做完没就得耗半天。

📖 **完整产品说明见 [docs/PRODUCT.md](./docs/PRODUCT.md)**（定位、痛点拆解、竞品对比、设计理念）

---

## 关于模型调用 / Bring your own model

> **本项目不内置、不代理、不代付任何模型 API。作者不提供任何托管服务或共享 key。**
>
> **This project ships no model API, no proxy, and no shared key. The author hosts nothing for you.**

| 模式 | 需要什么 | 效果 |
|---|---|---|
| 本地规则模式（默认） | 什么都不需要，零 key、零外部服务 | 假完成检测、空转检测、证据链、话术生成全部可用 |
| 语义增强模式（可选） | 你自己的 Dify 实例 + 你自己的 workflow key | 额外增加“本轮语义是否对齐”的判断与指代回溯 |

实现上的三重保证：

1. config.example.json 默认 mock: true 且 apiKeys.eval 为空 —— clone 下来默认不发出任何网络请求。
2. 默认 baseUrl 是 http://127.0.0.1:8800，即你自己机器上的 localhost，与作者环境无任何关联。
3. config.json（存放 key 的文件）在 .gitignore 中，仓库内不存在，也永远不会被提交。

即使你完全不配置 Dify，核心卖点（用客观证据判断“AI 是不是在糊弄你”）也完整可用，因为那一层是零 LLM 的本地规则引擎。

---

## 效果 / What you actually see

绑定一个已有会话后，屏幕右侧常驻一条监督栏。每轮 AI 回复结束，亮一个状态灯，点开是一句可直接复制的话术：

| 场景 | 用户看到 | 用户动作 |
|---|---|---|
| AI 真干完了 | 🟢 **正常推进** | 不用管，继续 |
| AI 说"完成了"但没测试、没证据 | 🔵 **完成存疑** | 复制话术追问 |
| AI 空转、反复改、没进展 | 🟡 **需要介入** | 复制话术追问 |
| 用户说"这不是我想要的" | 🟡 **需要介入**（回溯出"你否定的是 X，要的是 Y"） | 复制话术纠正 |

用户不用再自己读代码、组织语言、跟 AI 反复拉扯——工具替他把"该说什么"想好了。

---

## 和市面产品的区别 / How this differs

| 市面产品 | 它们在做什么 | 致命盲区 |
|---|---|---|
| **Codex Goal Mode** | AI 自己拆任务、自己执行、自己验收 | **AI 自己当裁判**，它说"完成"就是完成 |
| **Auto Review 类插件** | 用一个 AI 审查另一个 AI 的代码 | 还是"AI 审 AI"，没有用户侧的中立视角 |
| **进程监控工具** | 只看 Running / Blocked / Ready | 只告诉你"它还在跑"，不告诉你**这轮有没有真完成、该说什么** |

> 别人做的是"AI 的执行"和"AI 的自我验收"；TaskNavigator 做的是**替用户验收 AI 的每一轮**。

---

## 三态判定 / Three states

| State | 含义 | 判定来源 |
|---|---|---|
| `ok` | 本轮正常推进或要求已满足 | 本地证据 + 语义对齐 |
| `warn` | 无实质推进、部分未满足、指代未对齐、需要介入 | 本地规则（可由语义判断补充） |
| `completion_doubt` | AI 声明完成，但证据链缺少要求的文件或验证结果 | **纯本地证据，语义判断无权推翻** |

**最重要的架构约束**：本地客观证据拥有最终裁定权。语义判断（Dify）可以指出语义偏差、生成话术，但**不能**把本地识别出的"完成存疑"改成绿色。这条是硬编码的，不是配置项。

---

## 架构 / Architecture

```
┌──────────────────────────────────────────────────────────┐
│                Electron 停靠条 (rail / list / detail)      │
│                    ▲  SSE 实时推送                         │
└────────────────────┼─────────────────────────────────────┘
                     │
┌────────────────────┴─────────────────────────────────────┐
│              Node.js daemon  (127.0.0.1:48763)            │
│                                                           │
│   transcript.js        judgment.js          dify.js       │
│  ┌────────────┐      ┌────────────┐      ┌────────────┐  │
│  │ 按轮增量解析 │─────▶│ 本地证据规则 │─────▶│ tn_eval    │  │
│  │ 只闭合完整轮 │      │  零 LLM 成本 │      │ 语义对齐    │  │
│  └────────────┘      └────────────┘      └─────┬──────┘  │
│         │                    │                  │ 可选     │
│         ▼                    ▼                  ▼         │
│  Codex / Claude       文件变化 · 退出码      你自建的        │
│  本地会话日志           测试结果                Dify 实例     │
└──────────────────────────────────────────────────────────┘
```

**关于模型调用**：本项目**不内置任何模型 API**，不提供也不代付 key。语义判断这一层由你自己的 Dify 实例完成；不配置就走纯本地规则模式，功能依然可用。

---

## 快速开始 / Quick start

**前提**：Node.js >= 18、已安装 Codex 或 Claude Code、Windows

```powershell
# 1. 克隆
# 用本页 Code 按钮里的地址
git clone <this-repo>.git
cd TaskNavigator

# 2. 安装依赖 + 生成配置（默认 mock 模式，零 key 可跑）
.\setup.ps1 -InstallDeps

# 3. 可选：接入 Dify 语义判断
#    先按 DIFY_WORKFLOW.md 建好 tn_eval 工作流，再执行：
.\setup.ps1 -DifyBaseUrl "http://127.0.0.1:8800" -DifyEvalKey "app-xxx"

# 4. 启动后台守护
node daemon\index.js

# 5. 另开终端，启动桌面停靠条
.\start-local.cmd
```

然后展开右侧停靠条 → "选择会话开始监控" → 选平台（Codex / Claude Code）→ 选一个已有会话。

### 验证 / Verify

```powershell
npm test
```

冒烟测试**不需要 API key、不需要 Dify、不需要 Electron**，纯本地逻辑。覆盖：最终回复分轮、中间进度排除、工具输出关联、假完成识别、连续空转、指代型消息、四轮意图链、归档恢复、删除撤销、重复轮次幂等。

---

## 配置 / Configuration

复制 `config.example.json` 为 `config.json` 后按需修改：

| 字段 | 默认 | 说明 |
|---|---|---|
| `port` | `48763` | daemon 端口 |
| `sessionsDir` | `~/.codex/sessions` | Codex 会话日志目录 |
| `claudeHome` | `~/.claude` | Claude Code 数据目录 |
| `dify.baseUrl` | `http://127.0.0.1:8800` | 你的 Dify 实例地址 |
| `dify.apiKeys.eval` | `""` | 你的 tn_eval 工作流 API key |
| `dify.mock` | `true` | `true` = 不调 Dify，纯本地规则 |
| `dify.fallbackToMock` | `true` | Dify 失败时自动降级为本地规则 |

> `config.json` 已在 `.gitignore` 中——你的 key 不会被提交。

---

## 隐私 / Privacy

- **只读你手动绑定的会话**，不扫描本地全部对话记录
- 所有会话数据留在本机 `data/tasks.json`（已 gitignore）
- 除了你自己配置的 Dify 实例，不向任何第三方发送数据
- 不写入 Codex hook 配置，不需要修改 Codex 本身

---

## 截图 / Screenshots

> 📸 待补充。运行后截图放入 `docs/screenshots/`，然后在此处引用：
> `![rail mode](docs/screenshots/rail-mode.png)`

---

## daemon API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | daemon 与 mock 状态 |
| GET | `/api/state` | 监控任务与归档 |
| GET | `/api/events` | SSE 事件流 |
| GET | `/api/sessions/latest?platform=codex\|claude` | 最近会话列表 |
| POST | `/api/tasks` | 绑定一个已有会话 |
| POST | `/api/turn-ended` | 可选 Hook 入口 |
| POST | `/api/tasks/:id/evaluate` | 手动触发最新完整轮次评估 |
| POST | `/api/tasks/:id/archive` · `/restore` · `/delete` · `/undo-delete` · `/read` | 任务生命周期操作 |

---

## 作为 Codex 技能安装 / Install as a Codex skill

本仓库同时是一个可安装的 Codex 技能：

```powershell
git clone <this-repo>.git "$env:USERPROFILE\.codex\skills\tasknavigator"
```

之后对 Codex 说「帮我安装并启动 TaskNavigator」，它会按 [`skills/tasknavigator/SKILL.md`](./skills/tasknavigator/SKILL.md) 的指引完成安装。

---

## 文档 / Docs

| 文档 | 内容 |
|---|---|
| [docs/PRODUCT.md](./docs/PRODUCT.md) | 产品定位、痛点拆解、竞品对比、设计理念 |
| [DIFY_WORKFLOW.md](./DIFY_WORKFLOW.md) | tn_eval 工作流的节点、变量、结构化输出与完整提示词 |
| [CHANGELOG.md](./CHANGELOG.md) | v0.1 → v0.5.5 的完整迭代记录 |
| [skills/tasknavigator/SKILL.md](./skills/tasknavigator/SKILL.md) | Codex 技能安装指引 |

---

## License

MIT — see [LICENSE](./LICENSE).

---

## For reviewers / 技术要点

Clone 下来 `npm test` 即可验证，无需任何 key 或外部服务。

- **Electron 桌面应用**：三态窗口模式、无边框侧边停靠、IPC + contextIsolation、深链跳回原会话
- **Node.js 服务端**：零依赖 HTTP server、SSE 长连接推送、JSONL 增量解析与游标推进、schema 迁移
- **规则引擎设计**：`daemon/judgment.js` 用文件变化 / 退出码 / 测试结果构建证据链，零 LLM 成本完成假完成与空转判定
- **容错架构**：Dify 不可用时自动降级为本地规则并推进游标，避免重复扣费与重复判定
- **幂等性**：`turn_id` + 最终回复双重去重，同一问答只保留一条记录
- **测试覆盖**：`tests/smoke.js` 结构化断言，覆盖 13 类场景
- **真实迭代**：60 KB 变更日志，v0.1 → v0.5.5 三十余次迭代
