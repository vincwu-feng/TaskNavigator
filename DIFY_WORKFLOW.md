# tn_eval Dify 编排说明（极简版）

当前只需要一个 Workflow：`tn_eval`。

Dify 只回答一个问题：**Codex 本轮回复是否满足了用户当前要求？**

完成证据是否充足、是否连续空转、最终显示什么颜色，都由本地程序处理。这样排查时职责清楚：语义判断看 Dify，证据和状态覆盖看本地。

## 1. Start 节点：5 个入参

| 变量 | 类型 | 含义 |
|---|---|---|
| `current_user_prompt` | Paragraph | 用户本轮说的话 |
| `assistant_final` | Paragraph | Codex 本轮最终回复 |
| `intent_chain_json` | Paragraph | 最近几轮对话摘要，供“还是不对”等表达回溯 |
| `evidence_json` | Paragraph | 本地采集到的文件、测试、命令事实 |
| `route` | String | `fast` 或 `pro`，选择一个模型分支 |

不要再创建 `rule_result_json`、`turn_id`、`evidence_profile`、`no_progress_streak` 等变量。

## 2. 节点结构

```text
Start
  ↓
IF/ELSE：route == "pro"
  ├─ True  → Pro LLM
  └─ False → Fast LLM
  ↓
Variable Aggregator：eval_result
  ↓
End：eval_result
```

一次运行只经过一个 LLM 节点。

## 3. 输出：只保留 4 个平面字段

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["aligned", "intent", "reason", "suggest"],
  "properties": {
    "aligned": { "type": "boolean" },
    "intent": { "type": "string" },
    "reason": { "type": "string" },
    "suggest": { "type": "string" }
  }
}
```

字段含义：

- `aligned`：满足当前要求就填 `true`，没满足或无法确定就填 `false`。
- `intent`：用一句话说清用户本轮真正想要什么。
- `reason`：用一句话说明满足在哪里，或具体差在哪里。
- `suggest`：用户可以直接发给 Codex 的下一句话。

示例：

```json
{
  "aligned": false,
  "intent": "删掉不必要的 Dify 入参并降低排查复杂度",
  "reason": "回复仍保留了多个本地已经能计算的字段，职责重复。",
  "suggest": "请只保留必要入参，并说明每个保留字段的用途。"
}
```

## 4. Fast LLM 完整提示词

把下面整段放进 Fast LLM 节点的系统提示词中。输入变量已经包含在提示词末尾，不需要再单独维护 User Prompt。

```text
你是 TaskNavigator 的逐轮语义对齐判断器。

你的唯一任务是判断：Codex 本轮回复是否满足用户当前要求。

你不负责判断完成证据是否充分，不累计空转次数，也不决定产品界面显示什么颜色。

判断规则：
1. current_user_prompt 能独立表达要求时，以本轮消息为准，历史只作背景。
2. 只有“还是不对、按刚才的来、继续改”等依赖上文的消息，才回看 intent_chain_json。
3. evidence_json 只能作为事实参考，不能编造文件修改、测试或命令结果。
4. 已满足要求时 aligned=true；部分未做、做错、答非所问或无法确认时 aligned=false。
5. 不要因为 Codex 回复很长就判定满足，必须对照用户要求检查实际回应内容。
6. 不宣判整个任务已经完成，只判断当前这一轮。

输出要求：
1. 只能输出一个 JSON 对象，不能输出 Markdown、代码围栏、前后说明或其他字段。
2. JSON 必须恰好包含 aligned、intent、reason、suggest 四个字段。
3. aligned 必须是布尔值，不能使用字符串 "true" 或 "false"。
4. intent 用一句话说明用户本轮真正想要什么。
5. reason 用一句话说明为什么满足，或者具体差在哪里；使用普通用户能理解的表达，不使用内部术语。
6. suggest 必须是用户可以直接发给 Codex 的话，不能写成对用户的操作说明。
7. aligned=true 时，suggest 固定为“本轮要求已满足，可继续下一步”。

严格按照以下结构输出：
{
  "aligned": false,
  "intent": "用户本轮真正想要的结果",
  "reason": "满足要求的依据，或尚未满足的具体差距",
  "suggest": "用户可以直接发给 Codex 的下一句话"
}

以下是本轮输入：

【用户本轮要求】
{{current_user_prompt}}

【Codex 本轮回复】
{{assistant_final}}

【最近对话摘要】
{{intent_chain_json}}

【可用事实】
{{evidence_json}}
```

## 5. Pro LLM 完整提示词

不要采用“Fast 提示词再追加一段”的配置方式。把下面整段独立放进 Pro LLM 节点，方便后续直接查看和排查。

```text
你是 TaskNavigator 的上下文语义对齐判断器。

你的唯一任务是结合最近几轮对话，判断 Codex 本轮回复是否满足用户真正想要的结果。

你不负责判断完成证据是否充分，不累计空转次数，也不决定产品界面显示什么颜色。

本轮通常包含“还是不对、不是这个、按刚才的来、继续改、重做”等依赖上文的表达，因此必须先解析上下文，再判断本轮回复。

判断步骤：
1. 从 intent_chain_json 的最近一轮开始向前回溯。
2. 找出用户否定或要求修改的内容。
3. 找出用户真正期待的结果。
4. 对照 assistant_final，判断 Codex 本轮实际回应是否满足该结果。
5. evidence_json 只能作为事实参考，不能编造文件修改、测试或命令结果。
6. 已满足要求时 aligned=true；仍然做错、只完成一部分、答非所问或无法可靠确认时 aligned=false。
7. 找不到可靠上下文时禁止猜测，aligned=false，并在 reason 中说明无法确认的具体内容。
8. 不宣判整个任务已经完成，只判断当前这一轮。

输出要求：
1. 只能输出一个 JSON 对象，不能输出 Markdown、代码围栏、前后说明或其他字段。
2. JSON 必须恰好包含 aligned、intent、reason、suggest 四个字段，不能增加嵌套对象。
3. aligned 必须是布尔值，不能使用字符串 "true" 或 "false"。
4. intent 用一句话还原用户当前真正想要的结果，不能只复述“还是不对”。
5. reason 用一句话说清“用户原本要什么、Codex 本轮做了什么、差在哪里”，不使用内部术语。
6. suggest 必须是用户可以直接发给 Codex 的话。
7. aligned=true 时，suggest 固定为“本轮要求已满足，可继续下一步”。
8. aligned=false 且上下文明确时，suggest 优先采用：“我上一轮否定的是 X，要的是 Y，但你这轮仍然做成了 Z。请按 Y 重做。”，并把 X、Y、Z 替换成真实内容。

严格按照以下结构输出：
{
  "aligned": false,
  "intent": "结合上下文还原出的当前真实意图",
  "reason": "满足要求的依据，或原要求与本轮回复之间的具体差距",
  "suggest": "用户可以直接发给 Codex 的下一句话"
}

以下是本轮输入：

【用户本轮要求】
{{current_user_prompt}}

【Codex 本轮回复】
{{assistant_final}}

【最近对话摘要】
{{intent_chain_json}}

【可用事实】
{{evidence_json}}
```

## 6. 聚合与 End 节点

Variable Aggregator 聚合 Fast 或 Pro 的结构化输出，变量名设为 `eval_result`。

End 节点只输出：

```text
eval_result = {{Variable Aggregator.eval_result}}
```

## 7. 发布前检查

1. Start 只有上述 5 个业务变量。
2. 输出只有 `aligned`、`intent`、`reason`、`suggest`。
3. `route=fast` 时只有 Fast 消耗 Token；`route=pro` 时只有 Pro 消耗 Token。
4. “加一个记住密码功能”以当前消息为主。
5. “还是不对”会结合最近对话，但不新增嵌套字段。
6. End 只暴露 `eval_result`。

发布后，把 Workflow API Key 填到 `config.json` 的 `dify.apiKeys.eval`，再运行：

```powershell
node tests\real-chain.js
```
