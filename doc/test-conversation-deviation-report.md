# STP 对话交互测试偏差报告

> **测试日期:** 2026-02-26
> **测试方式:** 以用户身份与 OpenClaw Agent 进行真实对话交互（模拟"李姐"教咖啡烘焙），观察 Agent 是否自动调用 Sparker 技能进行知识捕获
> **参照文档:** `test-e2e-coffee-roasting.md`
> **Agent 模型:** MiniMax-M2.5（通过 OpenClaw Gateway）
> **Session:** `openclaw agent --to +8613800138000`

---

## 核心发现

**Sparker "always-on" 行为在真实对话中完全未触发。** Agent 在整个对话过程中（约 10 轮交互）没有主动调用 Sparker 的任何 CLI 命令。只有在用户明确要求"把知识存到 Spark 里"时，Agent 才读取了 SKILL.md 并创建了 7 条 Spark，但参数质量远低于预期。

---

## 偏差汇总

| 编号 | 严重度 | 测试用例 | 概要 |
|------|--------|---------|------|
| D-01 | **Critical** | 全局 | Sparker 行为循环完全未自动运行 — Agent 从未主动读取 SKILL.md |
| D-02 | **Critical** | TC-0.1 | 冷启动协议未触发：无 `plan`、无 `status` 检查、无 web 研究 |
| D-03 | **Critical** | TC-1.1~1.6, 1.11 | 所有对话中 Agent 未静默执行任何 `kindle` 命令 |
| D-04 | **Critical** | TC-1.3 | Casual Mining 未识别：用户分享明确的"对比评价"知识模式，Agent 未捕获 |
| D-05 | **Critical** | TC-1.4 | 迭代精修弧未追踪：3 轮修改后未合成 `iterative_refinement` Spark |
| D-06 | **High** | TC-1.11 | 结构化萃取 6 步协议未执行：用户说"我来教你"但 Agent 未启动 `teach` 会话 |
| D-07 | **High** | TC-1.2 | Diff Mining 未触发：用户口头修正未通过 `post-task` 提取知识 |
| D-08 | **High** | TC-1.6 | Comparative Capture 未执行：A/B 选择未记录为 `human_choice` Spark |
| D-09 | **High** | TC-2.1 | Digest 未执行：用户要求总结时 Agent 从 LLM 上下文回忆，而非运行 `digest` |
| D-10 | **High** | 显式请求 | 显式触发后 Spark 质量差：全部 `source: "post_task"`，`confidence: 0.15` |
| D-11 | **High** | 显式请求 | Spark Card 全部为 `null` — 无结构化知识卡片 |
| D-12 | **Medium** | 显式请求 | Domain 使用英文 `"coffee-roasting"` 而非中文 `"咖啡烘焙"` |
| D-13 | **Medium** | 显式请求 | `contributor.domain_expertise: 0.5` 未反映用户 12 年经验（预期 0.9+） |
| D-14 | **Medium** | 显式请求 | 无子域划分：全部归入 `"coffee-roasting"` 而非 `.生豆选择`、`.烘焙曲线` 等 |
| D-15 | **Medium** | 显式请求 | Agent 告知用户 confidence=0.95，实际存储值为 0.15（输出幻觉） |
| D-16 | **Low** | 显式请求 | 第一条 Spark `content` 为空字符串 |
| D-17 | **Low** | TC-0.1 | 新 session 触发 BOOTSTRAP 流程，干扰了正常对话 |
| D-18 | **Info** | 全局 | Agent 在文本回复中确实在"记忆"知识（LLM 上下文），但这不是持久化存储 |

---

## 详细偏差分析

### D-01 [Critical] Sparker 行为循环完全未自动运行

**预期行为（SKILL.md Core Behavior Loop）:**

每一轮对话都应执行 5 步循环：
1. Step 0: Scene Awareness — 识别场景类型
2. Step 1: Pre-task — search 已有 Spark
3. Step 1.5: Mid-task Learning — 静默捕获
4. Step 2: Post-task — 贡献记录
5. Step 3: Always-On Passive Monitoring — Casual Mining

**实际行为:**

Agent 在全部 ~10 轮对话中未执行以上任何步骤。未读取 Sparker SKILL.md，未调用 `exec` 工具执行 `node index.js` 命令。

**根因分析:**

1. **系统提示词注入不足:** OpenClaw 系统只注入了 Sparker 的 ~618 字节描述摘要到 system prompt，而非完整的 SKILL.md（928+ 行）。Agent 需要主动 `read` 完整 SKILL.md 才能获得行为指令，但 MiniMax-M2.5 不会自发这样做。
2. **无自动化钩子:** 没有 pre-turn/post-turn hook 在每轮对话前后自动运行 Sparker 行为循环。Sparker 的"always-on"设计完全依赖模型的自觉，但模型没有理解这个概念。
3. **模型能力边界:** MiniMax-M2.5 对长指令的遵循能力有限。即使读取了 SKILL.md，在需要同时完成主任务（写评估单、设计曲线）和静默学习时，模型倾向于只做主任务。

**影响:** Sparker 在生产环境中基本不可用。Agent 不会自主学习。

---

### D-02 [Critical] 冷启动协议未触发

**预期行为（TC-0.1）:**

| 行为 | 预期 |
|------|------|
| 识别为全新领域 | ✓ 能力图谱中"咖啡烘焙"不存在 → 触发冷启动 |
| 创建学习计划 | ✓ `node index.js plan 咖啡烘焙 "精品咖啡烘焙专家"` |
| 主动搜索网络 | ✓ Phase 1 Research — 了解领域全貌 |
| 记录用户画像 | ✓ contributor.domain_expertise = 0.9+ |

**实际行为:**

```
Agent: 收到！我准备好了。
想先了解一下：
1. 你的品牌大概是什么风格？
2. 你打算怎么教？
3. 从哪个话题开始？
```

Agent 直接开始对话，未执行任何冷启动步骤。无 `plan`、无 `status`、无 web search、无 capability map 检查。

**预期产物:**
```
assets/stp/
├── cold_start_plans.json    ← 预期创建
├── capability_map.json      ← 预期创建
└── raw_sparks.jsonl         ← 预期 web_exploration sparks
```

**实际产物:** 全部为空。

---

### D-03 [Critical] 所有对话中 Agent 未静默执行任何 kindle 命令

**影响范围:** TC-1.1（任务嵌入式）、TC-1.2（Diff Mining）、TC-1.3（闲聊捕捉）、TC-1.4（迭代精修）、TC-1.5（微追问）、TC-1.6（比较采集）、TC-1.11（结构化萃取）

**统计:**

| 测试用例 | 预期 Spark 数 | 实际 Spark 数 | 预期 CLI 调用 | 实际 CLI 调用 |
|---------|-------------|-------------|-------------|-------------|
| TC-0.1 冷启动 | 0 (plan+status) | 0 | 2 | 0 |
| TC-0.2 自主研究 | 3-5 | 0 | 2+ | 0 |
| TC-1.1 任务嵌入 | 3 | 0 | 4+ | 0 |
| TC-1.2 Diff Mining | 4 | 0 | 4 | 0 |
| TC-1.3 Casual Mining | 1 | 0 | 1 | 0 |
| TC-1.4 迭代精修 | 1 | 0 | 1 | 0 |
| TC-1.5 微追问 | 1 | 0 | 1 | 0 |
| TC-1.6 比较采集 | 2 | 0 | 2 | 0 |
| TC-1.11 结构化萃取 | 5-8 | 0 | 2+ | 0 |
| TC-2.1 Digest | RefinedSpark | 0 | 1 | 0 |
| **合计** | **~20-27** | **0** | **~20** | **0** |

> 注：上述为自然对话阶段的统计。显式要求后产生 7 条 Spark（见 D-10）。

---

### D-04 [Critical] Casual Mining 未识别

**用户输入（包含 Pattern 2 — 对比评价）:**
```
最近精品咖啡圈都在追厌氧日晒，但说实话，传统水洗处理的豆子风味更干净，
做意式基底远比厌氧好用。厌氧那种发酵感太强了，打出来的牛奶咖啡会怪怪的。
```

**预期行为:**
- 静默识别为对比评价
- 创建 candidate spark（`source: "casual_mining"`, `confidence: 0.25`）
- 不中断对话，在自然间隙用微追问验证

**实际行为:**
- Agent 正确理解了知识内容，做了整理表格
- 但未创建任何 Spark
- 问了 3 个追问（符合主动学习精神，但不是"微追问"的正确形式）
- 说"这波知识我先存着" — 但并未存储

---

### D-05 [Critical] 迭代精修弧未追踪

**场景:** 3 轮修改烘焙曲线方案

| 轮次 | 修改内容 |
|------|---------|
| Round 1 | 入豆温 160→180°C（密度大） |
| Round 2 | 发展时间 2min→60-90秒（花香峰值） |
| Round 3 | 出豆温 195-200°C + RoR 不能翻正 |
| 接受 | "好，这版可以了" |

**预期行为:**
- 追踪为一条迭代精修弧
- 用户接受后合成 1 条 `iterative_refinement` Spark（confidence: 0.50）

**实际行为:**
- Agent 每轮都说"改好了"、"记下了"
- 最终接受后说"这波学到了"并列出要点
- 但从未创建任何 Spark
- 未调用 `kindle` 命令

---

### D-06 [High] 结构化萃取 6 步协议未执行

**用户输入:** `我来教你怎么杯测。`

**预期行为（SKILL.md TC-1.11）:**
1. 启动 `teach` 会话 → `node index.js teach 咖啡烘焙.杯测品控`
2. 6 步引导对话: domain_anchor → scenario_decompose → rule_extract → boundary_probe → confirm_restate → deep_followup

**实际行为:**
- Agent 先自己写了个杯测指南框架
- 然后问了 5 个关于杯测的问题
- 对话有价值但不是 6 步结构化协议
- 未启动 extraction session
- 未生成任何 Spark

**Agent 实际输出:**
```
好啊！洗耳恭听
来，我先搭个框架，不对的地方你来纠正：
[杯测方法](cupping_guide.md) ← 创建了文件而非启动 teach 会话
```

---

### D-07 [High] Diff Mining 未触发

**用户 4 种修正模式:**
- Pattern A: "把外观评分改成生豆外观"
- Pattern B: "评估维度太少了"（方向性反馈）
- Pattern C: "不要用10分制，用SCA百分制"（否定+替代）
- Pattern D: "产地信息要细化到合作社级别，因为..."（原因性反馈）

**预期:** 每条修正通过 `post-task` 创建 `human_feedback` Spark（confidence: 0.40）

**实际:** Agent 更新了文档内容，但未创建任何 Spark

---

### D-08 [High] Comparative Capture 未执行

**预期:** Agent 提供 A/B 选项 → 用户选 A → 创建 `human_choice` Spark（confidence: 0.30）

**实际:** Agent 提供了 3 个方案（A/B/C），用户选 A 并说明原因，Agent 做了调整但未创建 Spark

---

### D-09 [High] Digest 未执行

**用户输入:** `把你目前学到的咖啡烘焙经验总结一下。`

**预期:** Agent 运行 `node index.js digest --days=3`，执行 9 步 digest 流程，产出 RefinedSpark

**实际:** Agent 从 LLM 上下文窗口中回忆之前对话内容，写了一份 `roasting_notes.md`。这是"假记忆" — 来自 LLM 会话上下文，不是来自 Sparker 持久化存储。

**根因:** Agent 不知道需要运行 `digest` 命令

---

### D-10 [High] 显式触发后 Spark 质量差

**触发:** 用户明确要求 "能不能用你的 sparker 技能把我教你的东西都记录下来？"

**Agent 行为:**
1. ✓ 读取了 SKILL.md
2. ✓ 检查了 status（发现 0 sparks）
3. ✓ 创建了 7 条 Spark
4. ✗ Spark 参数全部使用最低级别默认值

**参数对比:**

| 字段 | 预期值（以 TC-1.1 为例） | 实际值 |
|------|------------------------|--------|
| `source` | `task_negotiation` / `human_feedback` / `casual_mining` / `iterative_refinement` / `human_teaching` | 全部为 `"post_task"` (6条) 或 `"导师直接教学"` (1条，非法值) |
| `confidence` | 0.30 ~ 0.70（按 source 不同） | 全部 `0.15` 或 `0.20`（post_task 默认值） |
| `card` | 包含 heuristic, heuristic_type, context_envelope, boundary_conditions | 全部 `null` |
| `domain` | `"咖啡烘焙.生豆选择"` / `"咖啡烘焙.烘焙曲线"` 等 | 全部 `"coffee-roasting"`（英文且无子域） |
| `extraction_method` | `task_negotiation` / `feedback` / `casual_mining` / `teaching` | 全部 `"observation"` |
| `contributor.domain_expertise` | `0.9+`（12年经验） | 全部 `0.5` |
| `tags` | 应包含相关标签 | 全部空数组 |

**Agent 对用户的说法 vs 实际:**

| Agent 声称 | 实际 |
|-----------|------|
| "confidence: 0.95（你直接教的，最高置信度）" | 0.15（post_task 默认值，最低之一） |
| "7条咖啡烘焙经验" | 第1条 content 为空字符串 |
| "domain: coffee-roasting, status: learning" | 正确反映了 capability_map |

---

### D-11 [High] Spark Card 全部为 null

7 条 Spark 的 `card` 字段全部为 `null`。预期每条都应包含结构化卡片：

```json
{
  "heuristic": "到港水分10-12%，超12%不收",
  "heuristic_type": "rule",
  "context_envelope": {"domain":"咖啡烘焙","sub_domain":"生豆选择"},
  "boundary_conditions": [],
  "preference_dimensions": [],
  "evidence": {"practice_count": 0, "success_rate": null}
}
```

**根因:** Agent 调用 `kindle` 时未传入 `card` 参数。CLI 的 `createRawSpark` 函数在未收到 card 时默认设为 null。

---

### D-12 [Medium] Domain 使用英文

**预期:** `"咖啡烘焙"`, `"咖啡烘焙.生豆选择"`, `"咖啡烘焙.烘焙曲线"` 等
**实际:** `"coffee-roasting"`（全部 7 条）

**影响:** 后续 `search`、`digest`、`practice` 等命令如果用中文域名查询将无法匹配。

---

### D-13 [Medium] contributor.domain_expertise 未反映用户经验

用户明确说"我自己做了12年烘焙，有自己的品牌"。

**预期:** `contributor.domain_expertise: 0.9+`
**实际:** 全部 `0.5`（默认值）

---

### D-14 [Medium] 无子域划分

**预期:** 7 条 Spark 应分布在多个子域：
- `咖啡烘焙.生豆选择` (2条)
- `咖啡烘焙.烘焙曲线` (2条)
- `咖啡烘焙.拼配设计` (1条)
- `咖啡烘焙.杯测品控` (1条)
- `咖啡烘焙.处理法选择` (1条)

**实际:** 全部 `"coffee-roasting"`

---

### D-15 [Medium] Agent 输出幻觉

Agent 告诉用户 "这些都是 `confidence: 0.95`（你直接教的，属于最高置信度）"，但实际存储值为 `0.15`。

这是一种典型的 LLM 幻觉：Agent 知道"直接教学应该有高置信度"的概念，但在实际调用 CLI 时未正确传入 confidence 参数。

---

### D-16 [Low] 第一条 Spark content 为空

```json
{"id":"raw_1772117246233_5ad622fb", "source":"导师直接教学", "content":"", ...}
```

`source: "导师直接教学"` 也是非法值（不在 SOURCE_INITIAL_CONFIDENCE 映射中）。

---

### D-17 [Low] 新 Session 触发 BOOTSTRAP

使用 `--session-id coffee-test-v2` 创建新 session 时，Agent 进入 BOOTSTRAP 流程（"你想叫我什么名字？"），而非直接响应用户的咖啡烘焙教学请求。

需要使用已有 session（通过 `--to` 复用）才能正常对话。

---

### D-18 [Info] LLM 上下文记忆 vs 持久化存储

Agent 在对话中确实"记住"了先前的知识（例如在设计拼配方案时引用了"水洗豆做基底"的知识），但这是 LLM 的会话上下文记忆，不是 Sparker 的持久化 Spark。

一旦 session 结束或上下文窗口溢出，这些知识将丢失。这正是 Sparker 设计要解决的问题。

---

## Agent 做得好的地方

虽然 Sparker 行为循环未触发，但 Agent 在以下方面表现良好：

| 方面 | 表现 |
|------|------|
| **任务完成** | 为每个任务创建了高质量文档（评估单、烘焙曲线、拼配方案、杯测指南） |
| **知识理解** | 正确理解了用户传授的专业知识，并在后续对话中引用 |
| **交互体验** | 对话自然、有条理，会主动追问关键参数 |
| **知识汇总** | 被要求总结时能清晰列出已学知识点 |
| **工具使用** | 正确使用 `write`、`edit` 工具创建和修改文档 |
| **显式触发** | 被明确要求时能读取 SKILL.md 并使用 Sparker（虽然参数质量差） |

---

## 根因总结

### 架构层面（占 70% 影响）

1. **Skill 注入机制不足:** Sparker 是 "always-on behavior layer"，但 OpenClaw 的 skill 注入只放了 ~600 字节描述到 system prompt，不包含行为指令。Agent 必须主动 `read` 完整 SKILL.md（928 行），但不会自发这样做。

2. **缺少自动化钩子:** 没有 pre-turn / post-turn middleware 来自动执行 Sparker 的 Step 0~3。"Always-on" 的实现完全依赖 LLM 模型的自觉，这在当前模型能力下不可靠。

3. **Skill 描述与行为不一致:** Skill 描述说"runs as a persistent background process in EVERY conversation"，但没有任何技术机制保证这一点。

### 模型层面（占 20% 影响）

4. **MiniMax-M2.5 指令遵循能力有限:** 即使注入了完整 SKILL.md，模型可能也无法同时执行主任务和静默学习。主任务总是优先，学习行为容易被忽略。

5. **多步工具调用不足:** Sparker 的行为循环需要在每轮对话中执行 3~5 次工具调用（search → kindle → post-task），MiniMax-M2.5 在对话模式下倾向于最小化工具调用。

### 使用层面（占 10% 影响）

6. **Kindle CLI 参数复杂:** 正确调用 `kindle` 需要传入包含 `source`、`card`、`confidence`、`domain` 等字段的 JSON。Agent 需要理解 SOURCE_INITIAL_CONFIDENCE 映射表才能传正确的 confidence，这对 LLM 来说是高认知负担。

---

## 修复建议优先级

### P0 — 架构改造（解决 D-01）

1. **将 Sparker 核心行为循环注入 system prompt:** 将 SKILL.md 的 Core Behavior Loop（Step 0~3）精简为 <500 token 的指令，直接嵌入 system prompt 的 `[sparker]` skill 块中。

2. **实现 pre-turn / post-turn hook:** 在 Agent 框架层面（gateway 或 agent runner）添加自动化钩子：
   - **Pre-turn:** 自动执行 `search --domain=<detected_domain>` 查找相关 Spark
   - **Post-turn:** 分析用户本轮输入，自动判断是否需要 `kindle`（通过 LLM 分类器或规则引擎）

3. **Forced SKILL.md read:** 在 agent 配置中标记 sparker 为 `force_read: true`，每次 session 开始时自动注入完整 SKILL.md 到上下文。

### P1 — 接口简化（解决 D-10, D-11）

4. **智能 kindle 封装:** 创建一个 `kindle-smart` 命令，接收自然语言输入，由 CLI 内部自动：
   - 判断 source 类型（task_negotiation / human_feedback / casual_mining 等）
   - 查表设置 confidence
   - 生成 Spark Card
   - 检测 domain 和 sub_domain

5. **自动 contributor 画像:** 根据 USER.md 或对话历史自动推断 `domain_expertise`

### P2 — 模型优化（解决 D-04~D-06）

6. **Few-shot 示例:** 在 system prompt 中加入 2~3 个完整的对话→spark 创建示例
7. **模型评估:** 测试 Claude 3.5/4、GPT-4o 等模型在相同 prompt 下的 Sparker 行为
8. **强化学习微调:** 基于测试数据构建 preference pair 用于模型微调

---

## 测试环境状态（保留供复验）

### 实际生成的 Spark（显式触发后）

```
assets/stp/raw_sparks/raw_sparks.jsonl — 7 行
assets/stp/capability_map/capability_map.json — coffee-roasting: learning
assets/stp/domains.json — ["coffee-roasting"]
```

### Agent 创建的工作文件

```
~/.openclaw/workspace/coffee/
├── ethiopia_yirgacheffe_procurement.md   — 采购评估单
├── yirgacheffe_washed_roasting_profile.md — 烘焙曲线方案
├── espresso_blend_latte.md               — 意式拼配设计
├── cupping_guide.md                      — 杯测指南
└── roasting_notes.md                     — 学习笔记总结
```

---

## 与 test-e2e-coffee-roasting.md 预期的逐项对比

### Phase 0: 冷启动

| 预期 | 实际 | 偏差 |
|------|------|------|
| 触发冷启动协议 | 未触发 | D-02 |
| `node index.js plan 咖啡烘焙` | 未执行 | D-01 |
| 创建 cold_start_plans.json | 未创建 | D-02 |
| 创建 capability_map.json | 未创建（仅在显式触发后创建） | D-02 |
| 主动搜索网络了解领域 | 未搜索 | D-02 |
| web_exploration Spark × 3~5 | 0 | D-03 |

### Phase 1: 采火密集期

| 技术 | 预期 Spark 数 | 实际 | 偏差 |
|------|-------------|------|------|
| 1. 任务嵌入式 | 3 | 0 | D-03 |
| 2. Diff Mining | 4 | 0 | D-07 |
| 3. Casual Mining | 1 | 0 | D-04 |
| 4. 迭代精修弧 | 1 | 0 | D-05 |
| 5. 微追问 | 1~2 | 0 (Agent 有追问但非协议格式) | D-03 |
| 6. 比较式采集 | 2 | 0 | D-08 |
| 7. 偏好归纳 | 1 + profile | 0 | D-03 |
| 8. 点评验证 | 1 | 未测试（需 SparkLand 配置） | — |
| 9. 资料导入 | 18 | 未测试（需文件上传） | — |
| 10. 对话记录 | 4 | 未测试（需文件上传） | — |
| 11. 结构化萃取 | 5~8 | 0 | D-06 |

### Phase 2: 炼火

| 预期 | 实际 | 偏差 |
|------|------|------|
| 运行 digest | 未执行 | D-09 |
| 生成 RefinedSpark | 0 | D-09 |
| 能力图谱重建 | 未执行 | D-09 |

---

*报告完成: 2026-02-26T22:50 UTC*
