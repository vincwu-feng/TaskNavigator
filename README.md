<h1 align="center">TaskNavigator</h1>
<p align="center">
  <em>AI 回复的"第二双眼睛" — 实时判断 Codex / Claude Code 每一轮是否真正满足你的要求</em>
  <br/>
  <em>A desktop dock that watches every AI turn and answers: <strong>did it actually do what you asked?</strong></em>
</p>

<p align="center">
  <img src="renderer/assets/tasknavigator-mark.png" width="128" alt="TaskNavigator icon"/>
</p>

---

## Overview / 概述

**English**

TaskNavigator is an **Electron desktop widget + Node.js daemon** that binds to your existing Codex or Claude Code sessions. It reads every turn — your request, the AI's final reply, file changes, and test results — runs local zero-LLM evidence rules, and optionally calls a single Dify workflow for semantic alignment. The result is a clear three-state verdict on every turn: ✓ **ok** (on track), ⚠ **warn** (needs attention), ❓ **completion_doubt** (claims done but evidence missing).

**What makes it different:**

- **Zero-LLM local rules** are the highest priority — Dify only judges semantic alignment, not the final state
- **Bring your own Dify** — no model costs for the author, users deploy their own Dify instance (free Community Edition) or skip it entirely
- **Mock mode works out of the box** — run `npm test` with zero API keys, zero configuration
- **Privacy-first** — only reads sessions you explicitly bind, never scans all local conversations

---

**中文**

TaskNavigator 是一个桌面停靠条，绑定到你已有的 Codex 或 Claude Code 会话后，自动按轮读取：

- 用户本轮要求
- AI 的最终回复
- 修改了哪些文件
- 跑了哪些命令和测试

然后通过 **本地规则（零 LLM 成本）** + **可选 Dify 工作流** 判断本轮 AI 是否真正满足了你的要求。结果直接在桌面停靠条上显示，黄色/蓝色卡片可一键复制建议发给 AI。

**核心设计原则：**

- **本地规则最高优先级** — 文件变了、测试过了、命令跑通了，这些事实比语义判断更可靠
- **用户自备模型** — 作者不提供 API key，不承担模型费用。用户自建 Dify Community Edition 或直接用 mock 模式
- **Mock 模式下零配置可跑** — `npm test` 不需要任何 API key
- **只读你绑定的会话** — 不扫描全部本地对话

---

## Architecture / 架构

```
┌─────────────────────────────────────────────────────┐
│                   Electron Window                    │
│           (rail / list / detail 三种模式)              │
│         SSE ←─── daemon state ──── SSE              │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│            Node.js Daemon (port 48763)               │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │Transcript │  │ Judgment │  │ Dify (optional)  │  │
│  │  Parser   │──▶  Local   │──▶ tn_eval workflow │  │
│  │           │  │  Rules   │  │ (semantic check) │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
│       │                                │            │
│       ▼                                ▼            │
│  Codex/Claude logs              Your Dify instance  │
│  (local filesystem)             (self-hosted)       │
└─────────────────────────────────────────────────────┘
```

### Three States / 三态

| State | Color | Meaning |
|-------|-------|---------|
| `ok` | Green | Normal progress, requirements satisfied |
| `warn` | Yellow/Blue | No substantial progress, partial satisfaction, or needs user intervention |
| `completion_doubt` | Orange | AI claims "done" but local evidence chain can't find the required files or test results |

**Local rules always win.** Dify can flag semantic misalignment and suggest wording, but cannot override the local evidence level.

---

## Quick Start / 快速开始

### Prerequisites / 前提

- Node.js >= 18, npm
- Codex or Claude Code (for session logs)
- Windows only (Electron side-dock + cmd scripts)

### Install & Run

```powershell
# 1. Clone
git clone https://github.com/YOUR_USERNAME/TaskNavigator.git
cd TaskNavigator

# 2. Install dependencies + create config
.\setup.ps1 -InstallDeps

# 3. (Optional) Configure Dify for semantic judgment
#    Import DIFY_WORKFLOW.md into your Dify instance, then:
.\setup.ps1 -DifyBaseUrl "http://127.0.0.1:8800" -DifyEvalKey "app-xxx"

# 4. Start daemon (background)
node daemon\index.js

# 5. Start desktop dock (new terminal)
.\start-local.cmd
```

### Verify / 验证

```powershell
npm test
```

The smoke test runs **zero Dify calls, zero Electron, zero API keys** — pure local logic.

---

## Configuration / 配置

Copy `config.example.json` to `config.json` and adjust:

| Field | Default | Description |
|-------|---------|-------------|
| `port` | `48763` | Daemon HTTP port |
| `dify.baseUrl` | `http://127.0.0.1:8800` | Your Dify instance URL |
| `dify.apiKeys.eval` | `""` | Your tn_eval workflow API key |
| `dify.mock` | `true` | `true` = skip Dify, use local rules only |
| `dify.fallbackToMock` | `true` | When Dify fails, fall back to local rules |

---

## Screenshots / 截图

> *TODO: Add a screenshot of the dock in rail mode, list mode, and detail mode.*
> *Run the app, then paste screenshots here with:*
> ```markdown
> ![rail mode](docs/screenshots/rail-mode.png)
> ```

---

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Daemon + mock status |
| GET | `/api/state` | Monitor tasks + archive |
| GET | `/api/events` | SSE event stream |
| GET | `/api/sessions/latest?platform=codex\|claude` | List recent sessions |
| POST | `/api/tasks` | Bind a session |
| POST | `/api/tasks/:id/evaluate` | Manually trigger evaluation |
| POST | `/api/tasks/:id/archive` | Archive |
| POST | `/api/tasks/:id/restore` | Restore from archive |
| POST | `/api/tasks/:id/delete` | Delete |
| POST | `/api/tasks/:id/undo-delete` | Undo delete |
| POST | `/api/tasks/:id/read` | Mark as read |

---

## Dify Workflow

See [DIFY_WORKFLOW.md](./DIFY_WORKFLOW.md) for the complete tn_eval workflow prompt, variable schema, and output format.

---

## Codex Skill Installation

This repo doubles as a Codex skill. Install with:

```bash
# If you have the skill-installer script:
cd ~/.codex/skills
git clone https://github.com/YOUR_USERNAME/TaskNavigator.git tasknavigator
```

Then ask Codex: *"帮我安装 TaskNavigator 并启动"* — the skill will walk through the setup.

---

## License

MIT — see [LICENSE](./LICENSE).

---

## For Recruiters / 对面试官

This project demonstrates:

- **Electron desktop app development** (main.js, preload.js, renderer, IPC)
- **Node.js HTTP server & SSE streaming** (daemon/index.js, daemon/store.js)
- **Local rules engine design** (daemon/judgment.js — zero-LLM evidence chain)
- **Dify workflow integration** (daemon/dify.js, DIFY_WORKFLOW.md)
- **Resilient architecture** (auto-degrade to local rules when Dify is unavailable)
- **Complete test suite** (tests/smoke.js — 23 KB of structured assertions)
- **Real iterative development** (61 KB changelog, v0.1 → v0.5.5, 30+ iterations)
- **Privacy-conscious design** (only reads user-bound sessions)

No API keys, no model costs, no hosted services. Clone, `npm install`, `npm test` — everything works.