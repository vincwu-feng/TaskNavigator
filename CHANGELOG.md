---

## 2026-08-26 v0.5.5 - Move judged prompt into card context

**Modification type**: UX
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| renderer/app.js | Modified | Moves “本轮提问” out of the judgment result box so it reads as the card context instead of part of the conclusion. |
| renderer/styles.css | Modified | Restyles the prompt preview as a lighter two-line context strip under the status row. |
| daemon/index.js | Modified | Advances daemon health to v0.5.5. |
| tests/smoke.js | Modified | Verifies the prompt preview appears before the result box and stays compact. |
| package.json / package-lock.json | Modified | Advances the application version to 0.5.5. |

### Verified

- [x] Syntax checks pass for renderer, daemon, and smoke tests.
- [x] `npm.cmd test` passes the complete smoke chain.

### Remaining risks

- Exact visual comfort still depends on live Electron inspection after restart.

---

## 2026-08-26 v0.5.4 - Show the judged prompt on task cards

**Modification type**: UX / Bug Fix
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| renderer/app.js | Modified | Adds a compact “本轮提问” preview to each task card so users can tell which prompt the judgment refers to before opening details or copying advice. |
| renderer/styles.css | Modified | Styles the prompt preview as a readable, three-line-clamped context block inside the result card. |
| daemon/index.js | Modified | Advances daemon health to v0.5.4. |
| tests/smoke.js | Modified | Adds source assertions that task cards show the judged prompt and keep it compact. |
| package.json / package-lock.json | Modified | Advances the application version to 0.5.4. |

### Verified

- [x] Syntax checks pass for renderer, daemon, and smoke tests.
- [x] `npm.cmd test` passes the complete smoke chain.

### Remaining risks

- Very long prompts are intentionally truncated on the card; full text remains available in task details.

---

## 2026-08-26 v0.5.3 - Evaluate immediately after binding a session

**Modification type**: Bug Fix
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| daemon/index.js | Modified | New Codex or Claude Code task binding no longer marks the latest completed turn as already evaluated; it immediately evaluates that turn and calls Dify when a completed reply exists. |
| tests/smoke.js | Modified | Asserts Codex and Claude Code bindings immediately create an evaluation history record, and keeps history id uniqueness tied to actual history length. |
| README.md | Modified | Documents that adding a session immediately evaluates the latest complete AI reply, then continues monitoring future completed replies. |
| package.json / package-lock.json | Modified | Advances the application version to 0.5.3. |

### Verified

- [x] Syntax checks pass for daemon, renderer, and smoke tests.
- [x] `npm.cmd test` passes the complete smoke chain.

### Remaining risks

- Binding now may take as long as the Dify blocking request when the selected session already has a completed reply.

---

## 2026-08-26 v0.5.2 - Prevent task-card time from overlapping actions

**Modification type**: UX / Bug Fix
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| renderer/app.js | Modified | Moves the task update time from the title row into the status row, aligned to the right of the source label. |
| renderer/styles.css | Modified | Reserves header space for hover archive/delete actions and lets the status-row time align right without overlapping. |
| daemon/index.js | Modified | Advances daemon health to v0.5.2. |
| tests/smoke.js | Modified | Adds assertions that time is rendered on the status row and the header reserves space for hover actions. |
| package.json / package-lock.json | Modified | Advances the application version to 0.5.2. |

### Verified

- [x] Syntax checks pass for renderer, daemon, and smoke tests.
- [x] `npm.cmd test` passes the complete smoke chain.

### Remaining risks

- Visual overlap was fixed by layout/source checks; exact pixel validation still depends on the live Electron window.

---

## 2026-08-26 v0.5.1 - Refresh platform icons and detail comparison

**Modification type**: UX / Bug Fix
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| renderer/assets/codex-source.png | Modified | Replaces the Codex source icon with the user-provided black OpenAI mark. |
| renderer/assets/claude-source.png | Added | Adds the user-provided orange Claude source icon. |
| renderer/app.js | Modified | Uses the new Claude PNG icon and replaces the detail comparison table with readable message-style request/reply blocks. |
| renderer/styles.css | Modified | Styles the new “本轮对照” detail section as two scannable message cards. |
| daemon/index.js | Modified | Advances daemon health to v0.5.1. |
| tests/smoke.js | Modified | Asserts the new icon paths and message-style detail comparison are present. |
| package.json / package-lock.json | Modified | Advances the application version to 0.5.1. |

### Verified

- [x] Syntax checks pass for renderer, daemon, and smoke tests.
- [x] `npm.cmd test` passes the complete smoke chain.
- [x] Asset inspection confirms the provided Codex and Claude PNG icons are present.

### Remaining risks

- Visual spacing was verified by source and smoke checks; pixel-level screenshot inspection was not available in this run.

---

## 2026-08-26 v0.5.0 - Add platform picker and Claude Code session support

**Modification type**: Feature / Bug Fix / UX
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| daemon/index.js | Modified | Lists sessions by `platform=codex|claude`, preserves the selected Codex title during binding, refreshes existing active Codex task titles from `session_index.jsonl`, supports Claude Code transcript evaluation, and advances daemon health to v0.5.0. |
| daemon/claude-sessions.js | Modified | Uses Claude Code VS Code plugin JSONL sessions under `.claude/projects` for listing, binding, parsing turns, tool calls, and end-turn completion. |
| renderer/app.js | Modified | Uses a two-step platform picker with Codex and Claude Code icons, then loads sessions for the selected platform and binds with the selected title/source. |
| main.js / preload.js | Modified | Supports opening Claude Code sessions by workspace folder and shrinks the collapsed rail height. |
| renderer/styles.css | Modified | Tightens the collapsed rail spacing around the icon. |
| config.example.json | Modified | Documents `codexHome` and `claudeHome`. |
| README.md | Modified | Documents Codex / Claude Code platform selection, session title source, and monitoring behavior. |
| tests/smoke.js | Modified | Adds coverage for Codex indexed titles, Claude Code session listing/binding, platform picker source assertions, and compact rail sizing. |
| package.json / package-lock.json | Modified | Advances the application version to 0.5.0. |

### Verified

- [x] Syntax checks pass for daemon, Claude parser, renderer, main process, and smoke tests.
- [x] `npm.cmd test` passes the complete smoke chain.
- [x] Local inspection confirms the real Codex index maps the Xiaohongshu session to `查找小红书检索skill`.
- [x] Local inspection confirms Claude Code VS Code sessions are discoverable under `.claude/projects`.

### Remaining risks

- Opening a Claude Code session currently opens the workspace folder in VS Code; jumping to an exact Claude conversation depends on VS Code / Claude Code exposing a deep link.
- Active Codex title refresh applies to active monitored tasks; archived titles remain as stored unless restored or rebound.

---

## 2026-08-26 v0.4.5 - Show Dify's suggestion when it returns one

**Modification type**: Bug Fix
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| daemon/index.js | Modified | Prefers Dify's returned `suggest` whenever it is non-empty; local fallback wording is used only when Dify provides no suggestion. Status and reason still honor local completion-doubt / no-progress / stuck rules. |
| tests/smoke.js | Modified | Asserts a no-progress turn now displays Dify's suggestion instead of the local streak wording. |
| package.json / package-lock.json | Modified | Advances the application version to 0.4.5. |

### Verified

- [x] `node --check` passes for the daemon and smoke tests.
- [x] `npm.cmd test` passes the complete smoke chain.

### Remaining risks

- The real Dify workflow must still return a non-empty `suggest`; when it returns empty, the local fallback wording is used as before.
- A previously evaluated turn keeps its stored `suggest` until the next completed turn is re-evaluated.

---

## 2026-08-26 v0.4.4 - Only evaluate a turn after it actually ends

**Modification type**: Bug Fix
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| daemon/transcript.js | Modified | Closes a turn only on `task_complete`, an explicit `final_answer` phase, or the next user message. End-of-file parsing no longer treats phase-less commentary as a completed answer, so Dify is not called while Codex is still working. |
| tests/smoke.js | Modified | Adds a phase-less in-progress fixture proving commentary without `task_complete` stays incomplete, and includes `task_complete` in completed-turn fixtures. |
| daemon/index.js | Modified | Advances daemon health to v0.4.4. |
| README.md | Modified | Documents task_complete-based turn closure for the current transcript format. |
| package.json / package-lock.json | Modified | Advances the application version to 0.4.4. |

### Verified

- [x] Syntax checks pass for the daemon, renderer, and smoke tests.
- [x] `npm.cmd test` passes the complete smoke chain.
- [x] Parsing the live transcript shows the currently executing turn stays incomplete while completed turns close correctly.
- [x] A separate fully-new-format session parses with every turn complete and the correct final answer.

### Remaining risks

- The monitored session is the live Codex conversation, so the transcript keeps growing while work is in progress; the daemon must be restarted to load the fixed parser.
- The app's `task_complete.last_agent_message` is the last message of the round; if the user interrupts mid-work, that message may be a progress note rather than a full final answer, but Dify is still only called once per closed round.

## 2026-08-26 v0.4.3 - Align detail width and explain judgment in plain language

**Modification type**: UX / Bug Fix
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| main.js | Modified | Shrinks detail mode from 840 to 680 pixels so the 340-pixel detail panel matches the task list width. |
| renderer/app.js | Modified | Replaces the two-column evidence grid with one plain-language judgment explanation, then lists file/test/missing details below. |
| renderer/styles.css | Modified | Matches the detail panel width to the 340-pixel task card and restyles the readable evidence summary. |
| tests/smoke.js | Modified | Asserts equal detail/list widths and the readable evidence explanation. |
| daemon/index.js | Modified | Advances daemon health to v0.4.3. |
| README.md | Modified | Documents equal-width detail panel and plain-language judgment basis. |
| package.json / package-lock.json | Modified | Advances the application version to 0.4.3. |

### Verified

- [x] Renderer, daemon, main-process, and smoke-test syntax checks pass.
- [x] `npm.cmd test` passes the complete smoke chain.

### Remaining risks

- The real Dify workflow still depends on the contract in DIFY_WORKFLOW.md; local rules remain authoritative for completion doubt.
- Pixel-level visual capture is unavailable, so runtime dimensions are verified through source assertions and window config.

## 2026-08-26 v0.4.2 - Restore task-card results and side-by-side details

**Modification type**: UX / Feature
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| main.js | Modified | Expands detail mode to 840 pixels so the 340-pixel task list remains visible beside the 500-pixel detail panel. |
| daemon/index.js | Modified | Marks tasks read without changing their update time, preventing the selected card from moving, and advances health to v0.4.2. |
| renderer/assets/codex-source.png | Added | Reuses the user-provided Codex source icon for monitored-conversation titles. |
| renderer/app.js | Modified | Moves status below the icon-led title, restores the bordered result/advice/Token/copy panel, keeps detail/session actions outside, highlights the selected card, and opens details beside the list. |
| renderer/styles.css | Modified | Adds source-icon, selected-card, rounded result-box, internal copy, external navigation, and side-by-side detail styles. |
| tests/smoke.js | Modified | Asserts source icons, bordered result boxes, internal copy actions, and retained detail/session navigation. |
| README.md | Modified | Documents the restored task-card hierarchy and adjacent detail behavior. |
| package.json / package-lock.json | Modified | Advances the application version to 0.4.2. |

### Verified

- [x] Main process, daemon, renderer, and smoke-test syntax checks pass.
- [x] `npm.cmd test` passes the complete smoke chain.
- [x] The provided Codex source icon exists in the packaged renderer assets.
- [x] Visible and copied suggestion text use the same fallback function.

### Remaining risks

- The current product only binds Codex sessions, so all task cards use the Codex icon; future agent integrations need a persisted `source` field and icon mapping.
- Pixel-level visual capture is still unavailable; runtime dimensions, DOM structure, styles, event wiring, and application startup are verified.

## 2026-08-25 v0.4.1 - Show intervention wording before copying

**Modification type**: Bug Fix / UX
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| renderer/app.js | Modified | Displays the complete suggestion before copy, preserves explicit detail and Codex navigation actions, shows evaluation Token usage, and keeps judgment evidence collapsed by default. |
| renderer/index.html | Modified | Removes the misleading play-shaped arrow from the collapsed rail; the entire rail remains clickable. |
| renderer/styles.css | Modified | Adds a readable suggestion preview, two list actions, compact Token/update metadata, and removes the obsolete rail-arrow styling. |
| tests/smoke.js | Modified | Asserts suggestion visibility, explicit list navigation, Token visibility, collapsed evidence, removal of unseen-copy actions, and absence of the play icon. |
| README.md | Modified | Documents preview-before-copy, retained navigation, Token display, and collapsed evidence. |
| daemon/index.js | Modified | Advances daemon health to v0.4.1. |
| package.json / package-lock.json | Modified | Advances the application version to 0.4.1. |

### Verified

- [x] Renderer, daemon, and smoke-test syntax checks pass.
- [x] `npm.cmd test` passes the complete smoke chain.
- [x] Source assertions confirm the full suggestion is visible before both copy actions, explicit detail/session navigation is retained, Token usage is shown, evidence is collapsed by default, and the collapsed rail has no play icon.

### Remaining risks

- Pixel-level visual capture remains unavailable; runtime startup and interaction wiring are verified after restart.

## 2026-08-25 v0.4.0 - Focus the intervention flow and enforce one record per completed turn

**Modification type**: Feature / Bug Fix / UX
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| main.js | Modified | Changes detail mode to a focused 500-pixel panel instead of keeping the task list beside the detail content. |
| daemon/transcript.js | Modified | Uses `final_answer` and `task_complete` semantics to close a turn, while excluding commentary progress messages from the assistant final answer. |
| daemon/store.js | Modified | Migrates to schema v3, removes history without turn IDs, deduplicates by turn ID, stores both user and assistant sides, and adds restore/undo support. |
| daemon/index.js | Modified | Makes turn idempotency depend on the final answer, replaces history by turn ID, cleans legacy in-progress artifacts, and exposes restore and undo-delete APIs. |
| renderer/index.html | Modified | Adds a pending-action count and a plain-language connection banner. |
| renderer/app.js | Rewritten | Prioritizes actionable tasks, removes duplicate inline expansion, adds copy-and-open handling, focused decision details, adaptive diagnostics, archive restore, deletion undo, and card-based session selection. |
| renderer/styles.css | Modified | Implements the decision-first hierarchy, quiet green state, focused detail layout, actionable list cards, diagnostics, empty states, session cards, and undo toast. |
| tests/smoke.js | Modified | Covers commentary exclusion, final-answer closure, polluted-turn cleanup, one-record-per-turn history, legacy cleanup, archive restore, and delete undo. |
| README.md | Modified | Documents the new interaction flow, complete-turn semantics, and added APIs. |
| package.json / package-lock.json | Modified | Advances the application version to 0.4.0. |

### Verified

- [x] Syntax checks pass for the main process, daemon, transcript, store, renderer, and tests.
- [x] `npm.cmd test` passes the complete smoke chain.
- [x] Daemon health reports v0.4.0 and the Electron interface is running.
- [x] Live data migrated to schema v3: history reduced from 50 records to 6 completed turns, with six unique turn IDs, zero missing turn IDs, and zero “AI 正在推进” records.
- [x] The legacy record for the currently incomplete turn was removed and its cursor rolled back to the previous completed turn.

### Remaining risks

- Pixel-level visual inspection could not be automated because the Windows capture component was unavailable; renderer syntax, runtime startup, API flows, and interaction-state logic were verified.
- Existing older completed-turn records may show “该轮旧记录未保存回复摘要” when the previous schema did not persist the assistant side; every new record stores both sides.

## 2026-08-25 v0.3.2 - Simplify Dify output and make details user-facing

**Modification type**: Refactor / UX
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| daemon/index.js | Modified | Reduces Dify output parsing to four flat fields and keeps prompt classification, assistant summaries, evidence precedence, and final status local. |
| daemon/mock-data.js | Modified | Returns the same four-field `aligned`, `intent`, `reason`, and `suggest` contract. |
| renderer/app.js | Modified | Reorganizes task details around the user questions “is it okay, what is wrong, what should I say next” and hides implementation terminology. |
| renderer/styles.css | Modified | Adds clear result, request, action, and collapsed diagnostic cards for the simplified details view. |
| tests/smoke.js | Modified | Asserts the exact four-field Dify output contract in addition to the existing five-field input contract. |
| DIFY_WORKFLOW.md | Rewritten | Replaces the nested eight-field Schema and prompts with a four-field flat workflow contract. |
| package.json / package-lock.json | Modified | Advances the application version to 0.3.2. |

### Verified

- [x] Syntax checks pass for daemon, mock, renderer, and smoke-test JavaScript.
- [x] `npm.cmd test` passes the complete local smoke chain.
- [x] The task detail no longer displays prompt types, confidence, reference-resolution objects, or Token cost.

### Remaining risks

- The live Dify workflow must be changed to the new four-field output Schema before real semantic evaluation can use this contract.
- Existing stored intent-chain entries may retain internal compatibility fields, but the user interface does not display them.

## 2026-08-26 v0.4.3 - Align detail width and explain judgment in plain language

**Modification type**: UX / Bug Fix
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| main.js | Modified | Shrinks detail mode from 840 to 680 pixels so the 340-pixel detail panel matches the task list width. |
| renderer/app.js | Modified | Replaces the two-column evidence grid with one plain-language judgment explanation, then lists file/test/missing details below. |
| renderer/styles.css | Modified | Matches the detail panel width to the 340-pixel task card and restyles the readable evidence summary. |
| tests/smoke.js | Modified | Asserts equal detail/list widths and the readable evidence explanation. |
| daemon/index.js | Modified | Advances daemon health to v0.4.3. |
| README.md | Modified | Documents equal-width detail panel and plain-language judgment basis. |
| package.json / package-lock.json | Modified | Advances the application version to 0.4.3. |

### Verified

- [x] Renderer, daemon, main-process, and smoke-test syntax checks pass.
- [x] `npm.cmd test` passes the complete smoke chain.

### Remaining risks

- The real Dify workflow still depends on the contract in DIFY_WORKFLOW.md; local rules remain authoritative for completion doubt.
- Pixel-level visual capture is unavailable, so runtime dimensions are verified through source assertions and window config.

## 2026-08-26 v0.4.2 - Restore task-card results and side-by-side details

**Modification type**: UX / Feature
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| main.js | Modified | Expands detail mode to 840 pixels so the 340-pixel task list remains visible beside the 500-pixel detail panel. |
| daemon/index.js | Modified | Marks tasks read without changing their update time, preventing the selected card from moving, and advances health to v0.4.2. |
| renderer/assets/codex-source.png | Added | Reuses the user-provided Codex source icon for monitored-conversation titles. |
| renderer/app.js | Modified | Moves status below the icon-led title, restores the bordered result/advice/Token/copy panel, keeps detail/session actions outside, highlights the selected card, and opens details beside the list. |
| renderer/styles.css | Modified | Adds source-icon, selected-card, rounded result-box, internal copy, external navigation, and side-by-side detail styles. |
| tests/smoke.js | Modified | Asserts source icons, bordered result boxes, internal copy actions, and retained detail/session navigation. |
| README.md | Modified | Documents the restored task-card hierarchy and adjacent detail behavior. |
| package.json / package-lock.json | Modified | Advances the application version to 0.4.2. |

### Verified

- [x] Main process, daemon, renderer, and smoke-test syntax checks pass.
- [x] `npm.cmd test` passes the complete smoke chain.
- [x] The provided Codex source icon exists in the packaged renderer assets.
- [x] Visible and copied suggestion text use the same fallback function.

### Remaining risks

- The current product only binds Codex sessions, so all task cards use the Codex icon; future agent integrations need a persisted `source` field and icon mapping.
- Pixel-level visual capture is still unavailable; runtime dimensions, DOM structure, styles, event wiring, and application startup are verified.

## 2026-08-25 v0.4.1 - Show intervention wording before copying

**Modification type**: Bug Fix / UX
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| renderer/app.js | Modified | Displays the complete suggestion before copy, preserves explicit detail and Codex navigation actions, shows evaluation Token usage, and keeps judgment evidence collapsed by default. |
| renderer/index.html | Modified | Removes the misleading play-shaped arrow from the collapsed rail; the entire rail remains clickable. |
| renderer/styles.css | Modified | Adds a readable suggestion preview, two list actions, compact Token/update metadata, and removes the obsolete rail-arrow styling. |
| tests/smoke.js | Modified | Asserts suggestion visibility, explicit list navigation, Token visibility, collapsed evidence, removal of unseen-copy actions, and absence of the play icon. |
| README.md | Modified | Documents preview-before-copy, retained navigation, Token display, and collapsed evidence. |
| daemon/index.js | Modified | Advances daemon health to v0.4.1. |
| package.json / package-lock.json | Modified | Advances the application version to 0.4.1. |

### Verified

- [x] Renderer, daemon, and smoke-test syntax checks pass.
- [x] `npm.cmd test` passes the complete smoke chain.
- [x] Source assertions confirm the full suggestion is visible before both copy actions, explicit detail/session navigation is retained, Token usage is shown, evidence is collapsed by default, and the collapsed rail has no play icon.

### Remaining risks

- Pixel-level visual capture remains unavailable; runtime startup and interaction wiring are verified after restart.

## 2026-08-25 v0.4.0 - Focus the intervention flow and enforce one record per completed turn

**Modification type**: Feature / Bug Fix / UX
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| main.js | Modified | Changes detail mode to a focused 500-pixel panel instead of keeping the task list beside the detail content. |
| daemon/transcript.js | Modified | Uses `final_answer` and `task_complete` semantics to close a turn, while excluding commentary progress messages from the assistant final answer. |
| daemon/store.js | Modified | Migrates to schema v3, removes history without turn IDs, deduplicates by turn ID, stores both user and assistant sides, and adds restore/undo support. |
| daemon/index.js | Modified | Makes turn idempotency depend on the final answer, replaces history by turn ID, cleans legacy in-progress artifacts, and exposes restore and undo-delete APIs. |
| renderer/index.html | Modified | Adds a pending-action count and a plain-language connection banner. |
| renderer/app.js | Rewritten | Prioritizes actionable tasks, removes duplicate inline expansion, adds copy-and-open handling, focused decision details, adaptive diagnostics, archive restore, deletion undo, and card-based session selection. |
| renderer/styles.css | Modified | Implements the decision-first hierarchy, quiet green state, focused detail layout, actionable list cards, diagnostics, empty states, session cards, and undo toast. |
| tests/smoke.js | Modified | Covers commentary exclusion, final-answer closure, polluted-turn cleanup, one-record-per-turn history, legacy cleanup, archive restore, and delete undo. |
| README.md | Modified | Documents the new interaction flow, complete-turn semantics, and added APIs. |
| package.json / package-lock.json | Modified | Advances the application version to 0.4.0. |

### Verified

- [x] Syntax checks pass for the main process, daemon, transcript, store, renderer, and tests.
- [x] `npm.cmd test` passes the complete smoke chain.
- [x] Daemon health reports v0.4.0 and the Electron interface is running.
- [x] Live data migrated to schema v3: history reduced from 50 records to 6 completed turns, with six unique turn IDs, zero missing turn IDs, and zero “AI 正在推进” records.
- [x] The legacy record for the currently incomplete turn was removed and its cursor rolled back to the previous completed turn.

### Remaining risks

- Pixel-level visual inspection could not be automated because the Windows capture component was unavailable; renderer syntax, runtime startup, API flows, and interaction-state logic were verified.
- Existing older completed-turn records may show “该轮旧记录未保存回复摘要” when the previous schema did not persist the assistant side; every new record stores both sides.

## 2026-08-25 v0.3.2 - Simplify Dify output and make details user-facing

**Modification type**: Refactor / UX
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| daemon/index.js | Modified | Reduces Dify output parsing to four flat fields and keeps prompt classification, assistant summaries, evidence precedence, and final status local. |
| daemon/mock-data.js | Modified | Returns the same four-field `aligned`, `intent`, `reason`, and `suggest` contract. |
| renderer/app.js | Modified | Reorganizes task details around the user questions “is it okay, what is wrong, what should I say next” and hides implementation terminology. |
| renderer/styles.css | Modified | Adds clear result, request, action, and collapsed diagnostic cards for the simplified details view. |
| tests/smoke.js | Modified | Asserts the exact four-field Dify output contract in addition to the existing five-field input contract. |
| DIFY_WORKFLOW.md | Rewritten | Replaces the nested eight-field Schema and prompts with a four-field flat workflow contract. |
| package.json / package-lock.json | Modified | Advances the application version to 0.3.2. |

### Verified

- [x] Syntax checks pass for daemon, mock, renderer, and smoke-test JavaScript.
- [x] `npm.cmd test` passes the complete local smoke chain.
- [x] The task detail no longer displays prompt types, confidence, reference-resolution objects, or Token cost.

### Remaining risks

- The live Dify workflow must be changed to the new four-field output Schema before real semantic evaluation can use this contract.
- Existing stored intent-chain entries may retain internal compatibility fields, but the user interface does not display them.

## 2026-08-26 v0.4.2 - Restore task-card results and side-by-side details

**Modification type**: UX / Feature
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| main.js | Modified | Expands detail mode to 840 pixels so the 340-pixel task list remains visible beside the 500-pixel detail panel. |
| daemon/index.js | Modified | Marks tasks read without changing their update time, preventing the selected card from moving, and advances health to v0.4.2. |
| renderer/assets/codex-source.png | Added | Reuses the user-provided Codex source icon for monitored-conversation titles. |
| renderer/app.js | Modified | Moves status below the icon-led title, restores the bordered result/advice/Token/copy panel, keeps detail/session actions outside, highlights the selected card, and opens details beside the list. |
| renderer/styles.css | Modified | Adds source-icon, selected-card, rounded result-box, internal copy, external navigation, and side-by-side detail styles. |
| tests/smoke.js | Modified | Asserts source icons, bordered result boxes, internal copy actions, and retained detail/session navigation. |
| README.md | Modified | Documents the restored task-card hierarchy and adjacent detail behavior. |
| package.json / package-lock.json | Modified | Advances the application version to 0.4.2. |

### Verified

- [x] Main process, daemon, renderer, and smoke-test syntax checks pass.
- [x] `npm.cmd test` passes the complete smoke chain.
- [x] The provided Codex source icon exists in the packaged renderer assets.
- [x] Visible and copied suggestion text use the same fallback function.

### Remaining risks

- The current product only binds Codex sessions, so all task cards use the Codex icon; future agent integrations need a persisted `source` field and icon mapping.
- Pixel-level visual capture is still unavailable; runtime dimensions, DOM structure, styles, event wiring, and application startup are verified.

## 2026-08-25 v0.4.1 - Show intervention wording before copying

**Modification type**: Bug Fix / UX
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| renderer/app.js | Modified | Displays the complete suggestion before copy, preserves explicit detail and Codex navigation actions, shows evaluation Token usage, and keeps judgment evidence collapsed by default. |
| renderer/index.html | Modified | Removes the misleading play-shaped arrow from the collapsed rail; the entire rail remains clickable. |
| renderer/styles.css | Modified | Adds a readable suggestion preview, two list actions, compact Token/update metadata, and removes the obsolete rail-arrow styling. |
| tests/smoke.js | Modified | Asserts suggestion visibility, explicit list navigation, Token visibility, collapsed evidence, removal of unseen-copy actions, and absence of the play icon. |
| README.md | Modified | Documents preview-before-copy, retained navigation, Token display, and collapsed evidence. |
| daemon/index.js | Modified | Advances daemon health to v0.4.1. |
| package.json / package-lock.json | Modified | Advances the application version to 0.4.1. |

### Verified

- [x] Renderer, daemon, and smoke-test syntax checks pass.
- [x] `npm.cmd test` passes the complete smoke chain.
- [x] Source assertions confirm the full suggestion is visible before both copy actions, explicit detail/session navigation is retained, Token usage is shown, evidence is collapsed by default, and the collapsed rail has no play icon.

### Remaining risks

- Pixel-level visual capture remains unavailable; runtime startup and interaction wiring are verified after restart.

## 2026-08-25 v0.4.0 - Focus the intervention flow and enforce one record per completed turn

**Modification type**: Feature / Bug Fix / UX
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| main.js | Modified | Changes detail mode to a focused 500-pixel panel instead of keeping the task list beside the detail content. |
| daemon/transcript.js | Modified | Uses `final_answer` and `task_complete` semantics to close a turn, while excluding commentary progress messages from the assistant final answer. |
| daemon/store.js | Modified | Migrates to schema v3, removes history without turn IDs, deduplicates by turn ID, stores both user and assistant sides, and adds restore/undo support. |
| daemon/index.js | Modified | Makes turn idempotency depend on the final answer, replaces history by turn ID, cleans legacy in-progress artifacts, and exposes restore and undo-delete APIs. |
| renderer/index.html | Modified | Adds a pending-action count and a plain-language connection banner. |
| renderer/app.js | Rewritten | Prioritizes actionable tasks, removes duplicate inline expansion, adds copy-and-open handling, focused decision details, adaptive diagnostics, archive restore, deletion undo, and card-based session selection. |
| renderer/styles.css | Modified | Implements the decision-first hierarchy, quiet green state, focused detail layout, actionable list cards, diagnostics, empty states, session cards, and undo toast. |
| tests/smoke.js | Modified | Covers commentary exclusion, final-answer closure, polluted-turn cleanup, one-record-per-turn history, legacy cleanup, archive restore, and delete undo. |
| README.md | Modified | Documents the new interaction flow, complete-turn semantics, and added APIs. |
| package.json / package-lock.json | Modified | Advances the application version to 0.4.0. |

### Verified

- [x] Syntax checks pass for the main process, daemon, transcript, store, renderer, and tests.
- [x] `npm.cmd test` passes the complete smoke chain.
- [x] Daemon health reports v0.4.0 and the Electron interface is running.
- [x] Live data migrated to schema v3: history reduced from 50 records to 6 completed turns, with six unique turn IDs, zero missing turn IDs, and zero “AI 正在推进” records.
- [x] The legacy record for the currently incomplete turn was removed and its cursor rolled back to the previous completed turn.

### Remaining risks

- Pixel-level visual inspection could not be automated because the Windows capture component was unavailable; renderer syntax, runtime startup, API flows, and interaction-state logic were verified.
- Existing older completed-turn records may show “该轮旧记录未保存回复摘要” when the previous schema did not persist the assistant side; every new record stores both sides.

## 2026-08-25 v0.3.2 - Simplify Dify output and make details user-facing

**Modification type**: Refactor / UX
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| daemon/index.js | Modified | Reduces Dify output parsing to four flat fields and keeps prompt classification, assistant summaries, evidence precedence, and final status local. |
| daemon/mock-data.js | Modified | Returns the same four-field `aligned`, `intent`, `reason`, and `suggest` contract. |
| renderer/app.js | Modified | Reorganizes task details around the user questions “is it okay, what is wrong, what should I say next” and hides implementation terminology. |
| renderer/styles.css | Modified | Adds clear result, request, action, and collapsed diagnostic cards for the simplified details view. |
| tests/smoke.js | Modified | Asserts the exact four-field Dify output contract in addition to the existing five-field input contract. |
| DIFY_WORKFLOW.md | Rewritten | Replaces the nested eight-field Schema and prompts with a four-field flat workflow contract. |
| package.json / package-lock.json | Modified | Advances the application version to 0.3.2. |

### Verified

- [x] Syntax checks pass for daemon, mock, renderer, and smoke-test JavaScript.
- [x] `npm.cmd test` passes the complete local smoke chain.
- [x] The task detail no longer displays prompt types, confidence, reference-resolution objects, or Token cost.

### Remaining risks

- The live Dify workflow must be changed to the new four-field output Schema before real semantic evaluation can use this contract.
- Existing stored intent-chain entries may retain internal compatibility fields, but the user interface does not display them.

## 2026-08-25 v0.3.1 - Reduce Dify evaluation to five inputs

**Modification type**: Refactor
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| daemon/index.js | Modified | Sends Dify exactly five semantic inputs and keeps turn IDs, evidence profiles, rule decisions, and no-progress streaks local. |
| daemon/mock-data.js | Modified | Evaluates the same reduced input contract without depending on the removed rule payload. |
| daemon/transcript.js | Modified | Recognizes only the current five-field Dify payload when stripping copied workflow data. |
| tests/smoke.js | Modified | Asserts the exact five-key Dify input contract. |
| DIFY_WORKFLOW.md | Rewritten | Simplifies the Start node, Schema, prompts, and self-tests around semantic alignment only. |
| package.json / package-lock.json | Modified | Advances the application version to 0.3.1. |

### Verified

- [x] Syntax checks pass for the modified daemon, mock, transcript, and smoke test files.
- [x] `npm.cmd test` passes the complete local smoke chain.
- [x] Source scan confirms the removed fields are not sent by the Dify invocation code.

### Remaining risks

- The live Dify workflow must be updated to expose the five new Start variables before real semantic evaluation can resume.
- Blue completion doubt and no-progress wording intentionally come from local rules, so Dify returns only semantic `ok` or `warn` recommendations.

## 2026-08-25 v0.3.0 - Replace goal contracts with sliding intent alignment

**Modification type**: Feature / Refactor
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| daemon/transcript.js | Modified | Groups native transcript events into stable complete turns, supports both function and custom tool-call formats, keeps outputs on the owning turn, and exposes a turn cursor for idempotent evaluation. |
| daemon/judgment.js | Rewritten | Replaces contract acceptance matching with prompt classification, evidence profiles, exit-code-aware test evidence, successful file-change evidence, no-progress signals, and completion-doubt rules. |
| daemon/store.js | Rewritten | Introduces schema v2 with a four-item intent chain, current intent, bounded evidence/history, no-progress streak, and automatic removal of legacy contract fields. |
| daemon/index.js | Rewritten | Binds sessions in one step, evaluates only the newest unevaluated complete turn, routes directly to Fast or Pro, makes at most one Dify call, applies local rule precedence, and persists fallback results on Dify failure. |
| daemon/dify.js | Modified | Normalizes mock outputs through the same structured parser and prefers the single `eval_result` output. |
| daemon/mock-data.js | Rewritten | Mocks the new intent-alignment workflow and three-state structured result. |
| daemon/config.js | Modified | Removes contract and drift workflow defaults. |
| config.json / config.example.json | Modified | Retains only the eval workflow integration used by runtime. |
| renderer/app.js | Rewritten | Simplifies binding to one step and replaces goal-contract screens with current intent, evidence, four-turn intent chain, and copyable wording. |
| renderer/index.html / renderer/styles.css | Modified | Updates the binding action and adds intent/evidence presentation styles. |
| tests/smoke.js | Rewritten | Covers turn grouping, call/output correlation, completion doubt, two-turn no-progress, referential prompts, intent-chain bounds, migration, and idempotency. |
| tests/real-chain.js | Rewritten | Targets exactly one real `tn_eval` workflow with the new schema. |
| README.md | Rewritten | Documents the sliding-intent architecture, three states, one-step binding, single workflow, and current API. |
| DIFY_WORKFLOW.md | Added | Provides node-level Dify wiring, exact inputs, JSON Schema, Fast/Pro prompts, aggregator output, and publish checks. |
| package.json / package-lock.json | Modified | Advances the application version to 0.3.0. |

### Verified

- [x] Syntax checks pass for daemon, renderer, mock, and test JavaScript files.
- [x] `npm.cmd test` passes the full local smoke chain, including current Codex `custom_tool_call` evidence records.
- [x] Restarted daemon reports version `0.3.0`; Electron processes are running from this project.
- [x] Live persisted state reports schema v2 with no goal, contract, or pending-prompt fields.
- [ ] Real Dify chain is pending publication of the new `tn_eval` workflow described in `DIFY_WORKFLOW.md`.

### Remaining risks

- Until the new Dify workflow is published, semantic alignment uses the local fallback while evidence-based completion doubt and no-progress detection continue working.
- New bindings default to the code evidence profile; content-only tasks can use the internal `content` profile through the API until automatic profile inference is added.
- Direct GUI screenshot automation was unavailable in this environment; renderer syntax, API flows, daemon health, and Electron startup were verified.

## 2026-08-25 v0.2.20 - Fix copying task suggestions

**Modification type**: Bug Fix
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| renderer/app.js | Modified | Resolves task IDs consistently when a copy button supplies its string data attribute, then copies the corresponding suggestion. |
| preload.js | Modified | Routes clipboard writes through the established main-process IPC handler. |

### Verified

- [x] `node --check renderer/app.js` and `node --check preload.js` pass.
- [x] `npm.cmd test` smoke chain passes.
- [x] Restarted TaskNavigator and confirmed its Electron process is running with the updated preload bridge.

### Remaining risks

- The visible confirmation appears immediately after dispatching the clipboard request; the local main-process handler performs the write synchronously.

---

## 2026-08-25 v0.2.19 - Reconcile pending goal changes with task status

**Modification type**: Bug fix
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| daemon/index.js | Modified | A pending contract-change confirmation now forces the yellow `needs_intervention` state for the evaluated turn. |
| daemon/store.js | Modified | Existing saved tasks with a pending contract change are normalized during load. |
| renderer/app.js | Modified | Expanded cards show the intervention reason for yellow and blue states. |

### Verified

- [x] `node --check daemon/index.js` and `node --check daemon/store.js` pass.
- [x] `npm.cmd test` smoke chain passes.
- [x] Restarted the local daemon and verified the existing pending-change task reports `needs_intervention` with its pending-change reason.

---

## 2026-08-25 v0.2.18 - Monitor bound sessions without Codex hooks

**Modification type**: Feature
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| daemon/config.js | Modified | Adds an eight-second local polling interval for monitored-session log checks. |
| daemon/index.js | Modified | Polls only explicitly bound task sessions; evaluates a task only when its own transcript modification time advances, then persists that checkpoint. |
| setup.ps1 | Modified | Removes hook installation and documents the no-confirmation local polling behavior. |
| ~/.codex/hooks.json | Deleted | Removes the TaskNavigator Codex hook configuration at the user's request. |

### Verified

- [x] Syntax checks pass for `daemon/config.js` and `daemon/index.js`.
- [x] `npm.cmd test` (smoke chain) passes.
- [x] Confirmed `~/.codex/hooks.json` is absent.

### Remaining risks

- Each newly changed bound-session log can invoke the configured Dify evaluation workflow; unchanged logs are skipped.

---

## 2026-08-25 v0.2.17 - Make Codex navigation and turn monitoring real

**Modification type**: Feature
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| main.js | Modified | Opens the exact bound Codex thread through the supported `codex://threads/<thread-id>` desktop deep link. |
| preload.js | Modified | Exposes a narrow, session-ID-only bridge for opening a Codex thread. |
| renderer/app.js | Modified | Replaces the demonstration-only “go to conversation” notice with an actual deep-link action; removes percentage and progress-bar rendering. |
| renderer/styles.css | Modified | Removes unused progress-bar styles. |
| hook/turn-ended.js | Retained | Receives the native hook JSON and forwards its session id and transcript path to the local daemon. |
| setup.ps1 | Modified | Replaces the obsolete `notify` installer with an installer for the official asynchronous `Stop` hook. |
| ~/.codex/hooks.json | Added | Registers TaskNavigator's scoped, asynchronous Codex `Stop` hook. |

### Verified

- [x] Syntax checks pass for `main.js`, `preload.js`, `renderer/app.js`, and `hook/turn-ended.js`.
- [x] `npm.cmd test` (smoke chain) passes.
- [x] Hook configuration is valid JSON and points only to the local TaskNavigator forwarder.

### Remaining risks

- Codex must be restarted and the newly discovered hook trusted in `/hooks` before it begins delivering turn-end events.

---

## 2026-08-25 v0.2.16 - Read only native user-message records

**Modification type**: Bug Fix
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| daemon/transcript.js | Modified | Sources user prompts exclusively from `event_msg` records where `payload.type` is `user_message`, using only `payload.message`; response-item user content is no longer considered. |
| tests/smoke.js | Modified | Supplies native `user_message` records while retaining a response-item user wrapper to verify that wrappers are ignored. |

### Verified

- [x] `node --check daemon/transcript.js`
- [x] `npm.cmd test` (smoke chain)

### Remaining risks

- Very old Codex log formats without native `event_msg/user_message` records will have no user-prompt context rather than falling back to mixed wrapper content.

---

## 2026-08-25 v0.2.15 - Recognize all copied Dify invocation fields

**Modification type**: Bug Fix
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| daemon/transcript.js | Modified | Treats JSON fragments carrying any contract or Dify system field, including `session_title`, `existing_contract`, `sys.files`, and `sys.workflow_run_id`, as invocation data rather than a user prompt. |
| tests/smoke.js | Modified | Covers a standalone payload containing only a Dify `sys.files` field. |

### Verified

- [x] `node --check daemon/transcript.js`
- [x] `npm.cmd test` (smoke chain)

### Remaining risks

- Natural-language text after a copied JSON payload is not retained; this intentionally avoids leaking invocation fields into the contract prompt.

---

## 2026-08-25 v0.2.14 - Exclude copied workflow payloads from recent prompts

**Modification type**: Bug Fix
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| daemon/transcript.js | Modified | Detects copied Dify payloads by their contract-field keys; omits standalone payloads and retains only the preceding natural-language instruction when present. |
| tests/smoke.js | Modified | Adds regression checks for embedded and standalone copied workflow JSON. |

### Verified

- [x] `node --check daemon/transcript.js`
- [x] `npm.cmd test` (smoke chain)

### Remaining risks

- A genuine user instruction containing two or more exact Dify contract-key names will be treated as diagnostic payload data.

---

## 2026-08-25 v0.2.13 - Preserve native Codex session titles

**Modification type**: Bug Fix
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| daemon/index.js | Modified | Prefers the selected Codex client title for `session_title`, falling back to transcript derivation only when the native title is absent. |
| tests/smoke.js | Modified | Adds a regression assertion that the native title is preserved in contract inputs. |

### Verified

- [x] `node --check daemon/index.js`
- [x] `npm.cmd test` (smoke chain)

### Remaining risks

- Titles are capped at 24 characters to match the Dify contract field limit.

---

## 2026-08-25 v0.2.12 - Bind desktop shortcut to supplied product icon

**Modification type**: Other
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| ~/Desktop/TaskNavigator 监控.lnk | Modified | Set the shortcut icon to `renderer/assets/tasknavigator-mark.ico`, the supplied orange progress-arrow mark. |

### Verified

- [x] Confirmed the shortcut target remains `G:\Codex\TaskNavigator\start-tasknavigator.cmd`.
- [x] Confirmed the shortcut `IconLocation` points to the new `.ico` file.

### Remaining risks

- Windows Explorer may need a desktop refresh or Explorer restart before its icon cache visibly updates.

---

## 2026-08-25 v0.2.11 - Align contract workflow input with session context

**Modification type**: Bug Fix
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| daemon/transcript.js | Modified | Extracts genuine user requests from transcript wrappers, derives the contract title from the first request, caps the first request at 300 characters, and caps each of the latest three prompts at 250 characters. |
| daemon/index.js | Modified | Sends `tn_contract` exactly five inputs: `is_update`, `session_title`, `first_user_msg`, `recent_user_prompts`, and `existing_contract`; update mode carries the complete existing contract JSON. |
| tests/smoke.js | Modified | Asserts the exact input-field set, request/title limits, and numbered recent-prompt format. |

### Verified

- [x] `node --check daemon/transcript.js`
- [x] `node --check daemon/index.js`
- [x] `npm.cmd test` (smoke chain)

### Remaining risks

- The Dify Start node must expose the same five input variables before the draft can process live requests.

---

## 2026-08-25 v0.2.10 - Allow a user-defined task goal

**Modification type**: Feature
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| renderer/app.js | Modified | Added an explicit `其他：自行填写` option beside LLM goal candidates; it clears the goal input and focuses it for a user-authored goal. |

### Verified

- [x] Renderer syntax check passes.
- [x] `npm.cmd test` (smoke chain) passes.

### Remaining risks

- The custom goal is a single text field; constraints and acceptance criteria are still generated by the contract workflow.

---

## 2026-08-25 v0.2.9 - Anchor contract generation to original task intent

**Modification type**: Bug Fix
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| daemon/transcript.js | Modified | Added a contract-context reader that separates the initial meaningful request from recent prompts. |
| daemon/index.js | Modified | Sends Dify a priority-labelled task anchor (native title plus starting request); recent prompts are explicitly supplementary. |
| daemon/mock-data.js | Modified | Ignores the new input labels when deriving mock contracts. |
| tests/smoke.js | Modified | Verifies the contract context preserves the starting request and keeps recent prompts separate. |

### Verified

- [x] `npm.cmd test` (daemon, transcript, contract generation, monitoring, hook, and store smoke chain).
- [x] Confirmed the current session anchor resolves to the native title `自查并补全 TaskNavigator 功能` rather than a later troubleshooting prompt.

### Remaining risks

- `tn_contract` still has a system prompt that says to derive the contract from “recent user messages”; that prompt should be revised to apply the new priority hierarchy before its next Dify publication.

---

## 2026-08-25 v0.2.8 - Use native Codex thread titles

**Modification type**: Bug Fix
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| daemon/codex-threads.js | Added | Queries the local Codex app-server `thread/list` API and maps its `name` field to the session title. |
| daemon/index.js | Modified | Serves native Codex session titles to the task-creation flow, with transcript-derived labels only as a temporary fallback. |
| renderer/app.js | Modified | Displays the native title and preserves it when creating the monitoring binding. |

### Verified

- [x] `npm.cmd test` (smoke chain)
- [x] Native session query returned the exact client titles: `自查并补全 TaskNavigator 功能`, `这2个是我画出来的前端效果，但是是网页版的，我要的是桌面组件版的 ，你要基于这个要求改下但是侧边栏及详情部分还是沿用原…`, and `实现桌面会话监控组件 (2)`.

### Remaining risks

- The session list needs the local `codex` command to be available; if it is temporarily unavailable, the UI falls back to transcript subjects and labels that degraded source in the API response.

---

## 2026-08-25 v0.2.7 - Deduplicate recent Codex sessions

**Modification type**: Bug Fix
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| daemon/transcript.js | Modified | Sort session logs by last update, discard entries without a session ID, and keep only the newest log for each session. |

### Verified

- [x] Confirmed the latest-session result contains unique session IDs in descending log update order; `npm.cmd test` passes.

### Remaining risks

- Transcript log update time reflects local activity and may differ slightly from the client’s server-side sidebar ordering.

---

## 2026-08-25 v0.2.6 - Strip attachment metadata from session subjects

**Modification type**: Bug Fix
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| daemon/transcript.js | Modified | Extract the actual request text when the first message includes attachment metadata. |

### Verified

- [x] Confirmed the latest session resolves to its request text; `npm.cmd test` passes.

### Remaining risks

- Sessions without a native Codex title are intentionally represented by their first user request.

---

## 2026-08-25 v0.2.5 - Clarify task list and session selection

**Modification type**: Bug Fix
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| daemon/transcript.js | Modified | Expose a session title from transcript metadata or the first meaningful user request. |
| renderer/app.js | Modified | Preserve the selected session subject through the binding flow. |
| renderer/styles.css | Modified | Hide unused task-slot placeholders. |

### Verified

- [x] Node syntax checks for the transcript and renderer scripts.

### Remaining risks

- Codex transcript metadata does not always include a native title; those sessions use the first meaningful user request as their subject.

---

## 2026-08-25 v0.2.4 - Update desktop shortcut icon

**Modification type**: Other
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| renderer/assets/tasknavigator-mark.ico | Added | Generated a multi-size Windows icon from the supplied mark. |
| Desktop/TaskNavigator 监控.lnk | Modified | Bound the desktop shortcut to the new `.ico` asset. |

### Verified

- [x] Confirmed the shortcut references the generated icon and the `.ico` file exists.

### Remaining risks

- Windows Explorer can retain a stale visual until the desktop refreshes or the app is relaunched.

---

## 2026-08-25 v0.2.3 - Replace application mark

**Modification type**: Other
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| renderer/assets/tasknavigator-mark.png | Added | Added the user-supplied orange progress-arrow mark. |
| renderer/index.html | Modified | Replaced both fox symbols with the new mark. |
| renderer/styles.css | Modified | Ensured the image mark is cropped consistently. |
| main.js | Modified | Set the Electron window icon to the new mark. |

### Verified

- [x] Node syntax checks for `main.js` and `renderer/app.js`.

### Remaining risks

- Windows may use a generic icon in some contexts unless an `.ico` build asset is added later.

---

## 2026-08-25 v0.2.2 - Enforce explicit session binding

**Modification type**: Bug Fix
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| daemon/index.js | Modified | Reject task preparation/creation for missing sessions and duplicate active bindings. |

### Verified

- [x] `npm.cmd test` (smoke chain)

### Remaining risks

- The UI still displays a duplicate-session continuation action, but the server now rejects duplicate task creation.

---

## 2026-08-25 v0.2.1 - Normalize seeded demo state

**Modification type**: Bug Fix
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| daemon/index.js | Modified | Normalize demo records and history to the three visible task states. |

### Verified

- [x] `npm.cmd test` (smoke chain)

### Remaining risks

- No Git metadata exists in this directory, so repository diff validation is unavailable.

---

## 2026-08-25 v0.2.0 - Align monitoring with acceptance baseline

**Modification type**: Feature
**Modified by**: Codex AI Agent

### Files changed

| File | Operation | Detail |
|------|-----------|--------|
| daemon/judgment.js | Modified | Added task-mode progress rules, evidence tiers, gaps, and completion-claim detection. |
| daemon/store.js | Modified | Added task mode and migration from legacy four-state records to the three-state model. |
| daemon/index.js | Modified | Made local judgment authoritative; gated LLM calls; added completion-unverified status and task mode API input. |
| daemon/mock-data.js | Modified | Removed legacy evaluation statuses from mock workflow output. |
| renderer/app.js | Modified | Added task-mode selector and three-state presentation mapping. |
| renderer/styles.css | Modified | Added visual styles for normal progress, intervention, and completion-unverified states. |
| tests/smoke.js | Modified | Added acceptance tests for pseudo-completion and code/non-code progress rules. |
| tests/real-chain.js | Modified | Updated status enum assertion to the three-state model. |

### Verified

- [x] `npm.cmd test` (smoke chain)
- [x] Node syntax checks for modified daemon and renderer scripts

### Remaining risks

- Existing Dify workflows may still emit legacy status values, but the daemon no longer accepts them as task state.
