---
name: tasknavigator
description: "TaskNavigator 桌面停靠条：监控 Codex / Claude Code 会话，按轮判断 AI 回复是否满足用户要求。用户自备 Dify 实例或纯本地规则模式。触发词：TaskNavigator、任务导航、监控停靠条、dock widget、会话监控、AI 回复判断"
---

# TaskNavigator

TaskNavigator 是一个桌面停靠条（Electron app + Node daemon），绑定到已有 Codex 或 Claude Code 会话后，自动按轮读取用户要求、AI 回复、文件变化和测试结果，通过本地规则（零 LLM）和可选 Dify 工作流判断本轮是否真正满足要求。

**关键设计**：本地规则优先于语义判断。Dify 只负责判断"本轮语义是否对齐"，不决定最终状态。Dify 不可用时自动降级为纯本地规则。

## 运行概览

```text
用户绑定已有 Codex / Claude Code 会话
  → 按轮增量采集 transcript
  → 本地证据规则（零 LLM）
  → Fast 或 Pro 二选一的 tn_eval（最多一个 LLM 节点）
  → ok / warn / completion_doubt 三态
  → SSE 刷新桌面停靠条
```

## 安装

### 前提条件

- Node.js >= 18、npm
- 已安装 Codex 或 Claude Code（用于提供会话日志）
- 仅 Windows（依赖 cmd 侧边停靠和 Electron 窗口）

### 快速安装（在 Codex 中执行）

```powershell
# 1. Clone 仓库
cd ~
git clone https://github.com/OWNER/TaskNavigator.git
cd TaskNavigator

# 2. 安装依赖 + 创建配置
.\setup.ps1 -InstallDeps

# 3. 可选：配置 Dify 语义判断（不配则走纯本地规则）
# 在 Dify 中导入 DIFY_WORKFLOW.md 描述的 tn_eval workflow
# 然后：
.\setup.ps1 -DifyBaseUrl "http://127.0.0.1:8800" -DifyEvalKey "app-xxx"

# 4. 启动
node daemon\index.js        # 开启后台守护
# 另开终端：
.\start-local.cmd           # 开启桌面停靠条
```

### 验证

```powershell
npm test
```

冒烟测试不依赖 Electron 和 Dify，纯本地逻辑。

## 配置

`config.json` 从 `config.example.json` 按需修改：

| 字段 | 说明 |
|---|---|
| `dify.mock` | `true` = 不使用 Dify，纯本地规则 |
| `dify.fallbackToMock` | 即使 Dify 调用失败也降级为本地规则 |
| `dify.apiKeys.eval` | 你的 Dify tn_eval workflow API key |

## 使用流程

1. 启动 daemon + 桌面窗口
2. 点击右侧停靠条 → "选择会话开始监控"
3. 选择平台（Codex / Claude Code）→ 选择已有会话
4. 系统自动评估每一轮完整回复
5. 三态：`ok`（已满足） / `warn`（需介入） / `completion_doubt`（声明完成但缺证据）
6. 黄色/蓝色卡片可直接复制建议发给 AI

## 注意事项

- 系统只读取用户**手动绑定**的会话，不扫描所有本地对话记录
- 每轮绑定后，只从绑定时刻开始监控后续轮次，不会重新判断历史轮次
- Dify 配置为可选，不配置则走纯本地规则模式
- TaskNavigator 不调用任何第三方模型 API，所有模型调用由用户自建 Dify 实例完成