---
name: tasknavigator
description: "TaskNavigator 桌面停靠条：监控 Codex / Claude Code 会话，按轮判断 AI 回复是否满足用户要求。用户自备 Dify 实例或纯本地规则模式。触发词：TaskNavigator、任务导航、监控停靠条、dock widget、会话监控、AI 回复判断"
---

# TaskNavigator

## 这个产品是干什么的

TaskNavigator 是 AI 回复的"第二双眼睛"。它不替 AI 写代码、不审查代码，只做一件事：**每轮 AI 回复结束后，用客观证据检查"这轮是真完成了，还是在糊弄你"**。没完成就给用户一句可直接复制的话术。

**解决的痛点**：AI 每次交活都特别自信，结果一运行全是坑——光判断它到底做完没就得耗半天。

**三类具体问题**：

| 痛点 | 怎么解 |
|---|---|
| **假完成**：AI 说"做完了"，实际没做完、没验证 | 证据分级——"完成声明"必须对上文件/测试证据，对不上标"完成存疑" |
| **空转**：AI 反复改、没实质进展 | 无进展检测——连续无实质动作标"需要介入" |
| **指代纠正难**：用户说"这不是我想要的"但说不清要什么 | 滑动意图链——回溯前几轮，锚定"你否定的是哪个、要改成什么" |

**和市面产品的区别**：Codex Goal Mode 是 AI 自己验收自己；Auto Review 类插件是"AI 审 AI"；进程监控工具只看 Running/Blocked。TaskNavigator 是**站在用户这边的中立第二视角**——不看 AI 的自我汇报，用客观证据验证，并把结论翻译成"你该对 AI 说的话"。

用户看到的四种状态：

| 场景 | 状态 | 用户动作 |
|---|---|---|
| AI 真干完了 | 🟢 正常推进 | 不用管 |
| 说完成但没证据 | 🔵 完成存疑 | 复制话术追问 |
| 空转、反复改 | 🟡 需要介入 | 复制话术追问 |
| "这不是我想要的" | 🟡 需要介入（回溯 X→Y） | 复制话术纠正 |

## 技术实现

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

## 延伸阅读

- 完整产品说明（定位、竞品对比、设计理念）：仓库内 `docs/PRODUCT.md`
- tn_eval 工作流完整提示词与变量结构：仓库内 `DIFY_WORKFLOW.md`