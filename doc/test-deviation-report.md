# STP E2E 测试偏差报告

> **测试日期:** 2026-02-26
> **测试对象:** Sparker CLI (`node index.js`) 全流程
> **参照文档:** `test-e2e-coffee-roasting.md`
> **测试环境:** Node.js v22.22.0, 干净 assets 目录

---

## 偏差汇总

| 编号 | 严重度 | 阶段 | 概要 |
|------|--------|------|------|
| D-01 | **Critical** | Phase 1 | `kindle` 命令不识别 `task_negotiation` source，fallback 为 `post_task`/`observation` |
| D-02 | **Critical** | Phase 1 | 所有 `kindle` 调用中 `card` 字段均被丢弃（输出 `null`） |
| D-03 | **High** | Phase 0 | `kindle` exploration spark 的 `contributor.type` 为 `"human"` 而非 `"agent"` |
| D-04 | **High** | Phase 0-1 | 能力图谱（capability_map）不会随 spark 创建自动构建，仅在 `digest` 后才生成 |
| D-05 | **High** | Phase 1 | `human_choice` source 被路由到 `extractFromFeedback`，confidence 使用 `human_feedback` 的 0.40 而非 `human_choice` 的 0.30 |
| D-06 | **High** | Phase 1 | Diff mining 提取的 heuristic 内容为英文，heuristic_type 全部为 `preference` |
| D-07 | **High** | Phase 3 | `processPositiveFeedback` API 参数名为 `emberIdsUsed`（数组），与测试预期的 `spark_id`（单值）不匹配 |
| D-08 | **Medium** | Phase 1 | `confirmation_status` 在 `task_negotiation` / `human_feedback` 传入时被忽略 |
| D-09 | **Medium** | Phase 2 | Digest 仅晋升 1 条 RefinedSpark（从 20 条 raw 中），RefinedSpark 的 `card.heuristic` 为空字符串 |
| D-10 | **Medium** | Phase 2 | Practice 记录中 `spark_type` 总是 `"RawSpark"`，即使传入的是 RefinedSpark ID |
| D-11 | **Medium** | Phase 2 | Practice 的 `confidence_delta` 为 0，成功实践未触发任何置信度提升 |
| D-12 | **Medium** | Phase 4 | `forgeAll --force` 仍要求 `forge_eligible: true`，并非真正跳过资格检查 |
| D-13 | **Medium** | Phase 0 | 冷启动计划的 `web_queries` 生成了软件开发模板化查询（如"常用工具 API"、"技术栈"） |
| D-14 | **Low** | Phase 1 | `agent_exchange` spark 的 `extraction_method` 为 `"dialogue"` 而非 `"agent_exchange"` |
| D-15 | **Low** | Phase 1 | Document ingestion (`ingest`) 返回 0 candidates（LLM 超时/无响应） |
| D-16 | **Low** | Phase 0 | `domains` 命令返回 `[]`，domain 注册表从未被写入 |
| D-17 | **Low** | Phase 1 | `teach` 命令创建的 extraction session 未保存到 `extraction_sessions/sessions.jsonl` |
| D-18 | **Low** | Phase 4 | Crystallize readiness `total_raw` 只统计精确匹配的 domain，不包含子域 spark |
| D-19 | **Info** | 全局 | 测试文档中 assets 路径写的是 `assets/spark/`，实际路径为 `assets/stp/` |
| D-20 | **Info** | Phase 3 | Publish 首次调用返回 `cannot_publish_private_spark`，需显式传 `owner_confirmed: true` |

---

## 详细偏差说明

### D-01 [Critical] `kindle` 不识别 `task_negotiation` source

**测试用例:** TC-1.1 任务嵌入式学习

**预期行为:**
```json
{"source": "task_negotiation", "extraction_method": "task_negotiation", "confidence": 0.35, "confirmation_status": "human_confirmed"}
```

**实际行为:**
```json
{"source": "post_task", "extraction_method": "observation", "confidence": 0.15, "confirmation_status": "unconfirmed"}
```

**根因分析:**

`index.js` 的 `kindle` 命令路由逻辑中没有 `task_negotiation` 的分支：

```javascript
// index.js L71-81
if (src === 'teaching' || src === 'human_teaching') {
    spark = ext.extractFromTeaching(params);
} else if (src === 'human_feedback' || src === 'human_choice') {
    spark = ext.extractFromFeedback(params);
} else if (src === 'exploration' || src === 'web_exploration') {
    spark = ext.extractFromExploration(params);
} else if (src === 'agent_exchange') {
    spark = ext.extractFromAgentExchange(params);
} else {
    spark = ext.extractFromObservation(params);  // ← task_negotiation 走到这里
}
```

`task_negotiation` 未列为独立 source，直接 fallback 到 `extractFromObservation`，后者使用 `post_task` 的初始置信度 (0.15) 并忽略传入的 `confirmation_status`。

**影响:** 任务嵌入式学习是 STP 中摩擦度最低的采集方式（技术 1），但由于 source 不被识别，所有此类 spark 的置信度被严重低估（0.15 vs 预期 0.35），且 `confirmation_status` 丢失。这直接影响后续 digest 的晋升判断。

**修复建议:** 在 `index.js` 的 kindle 路由中添加 `task_negotiation` 分支，或在 `extractor.js` 中创建 `extractFromTaskNegotiation()` 函数。

---

### D-02 [Critical] 所有 `kindle` 调用中 `card` 字段被丢弃

**测试用例:** TC-1.1 ~ TC-1.8 全部

**预期行为:**
传入的 `card` 对象（包含 `heuristic`, `heuristic_type`, `context_envelope`, `boundary_conditions`, `preference_dimensions`）应被保存到 RawSpark 中。

**实际行为:**
所有 source 类型的 spark，输出的 `card` 字段均为 `null`，即使调用时明确传入了完整的 card JSON。

**根因分析:**

各 `extractFrom*` 函数在 `extractor.js` 中调用 `createRawSpark()`，但 `createRawSpark()` 内部并未将传入参数的 `card` 字段映射到生成的 spark 对象上。`createRawSpark()` 始终将 `card` 设为 `null`，依赖后续 digest 阶段通过 LLM 再生成 card（即 `spark-card-schema.js` 的 `mergeCards` 在 RefinedSpark 阶段才运行）。

**影响:** 这意味着**用户提供的结构化知识（heuristic, boundary_conditions 等）在采集阶段被直接丢弃**。知识仅以 `content` 纯文本保留。后续 digest 需要重新通过 LLM 从 content 中提取结构化 card，这既浪费又可能丢失精确度。

**对测试的影响:**
- RefinedSpark 的 `card.heuristic` 实际为空字符串（digest 的机械合并无法从 null card 提取）
- 所有"传入结构化知识"的测试场景实际上退化为"纯文本记录"

**修复建议:** `createRawSpark()` 应保留传入的 `params.card`，在有值时直接使用而非覆盖为 `null`。

---

### D-03 [High] Exploration spark 的 contributor.type 错误

**测试用例:** TC-0.2

**预期行为:**
```json
{"contributor": {"type": "agent", "id": "<node_id>"}}
```

**实际行为:**
```json
{"contributor": {"type": "human", "id": "unknown", "domain_expertise": 0.5}}
```

**根因分析:**

`extractFromExploration()` 使用 `createRawSpark()` 的默认 contributor，未覆盖为 agent 类型。对比 `extractFromAgentExchange()` 正确设置了 `contributor.type = "agent"`，说明 exploration 路径漏了这一处理。

---

### D-04 [High] 能力图谱不会随 spark 创建自动构建

**测试用例:** TC-0.1, TC-0.2, Phase 1 全部

**预期行为:**
每次创建 spark 后，所属 domain 应在 capability_map 中被注册/更新。

**实际行为:**
创建 20 条 spark 后，`status` 仍显示 `domains: [], capability_map: {}`。直到运行 `digest` 命令才构建了能力图谱。

**根因分析:**

`appendRawSpark()` 仅将 spark 追加到 JSONL 文件，不触发 capability map 重建。`rebuildCapabilityMap()` 仅在 `digest` 流程的 Step 8 中被调用。

**影响:** Agent 在两次 digest 之间完全不知道自己的能力分布。cold_start 阶段的 `strategy` 命令无法基于实时数据提供学习策略建议，因为 capability_map 为空。

**修复建议:** 在 `appendRawSpark()` 后触发轻量级的 domain 注册（至少把 domain 加入 capability_map，不需要完整 rebuild）。

---

### D-05 [High] `human_choice` source 被错误路由

**测试用例:** TC-1.7 偏好画像采集

**预期行为:**
```json
{"source": "human_choice", "confidence": 0.30, "extraction_method": "preference"}
```

**实际行为:**
```json
{"source": "human_feedback", "confidence": 0.40, "extraction_method": "feedback"}
```

**根因分析:**

`index.js` L73: `else if (src === 'human_feedback' || src === 'human_choice')` — 两者共用 `extractFromFeedback` 路径。但 `extractFromFeedback` 内部将 source 统一覆盖为 `human_feedback`，导致：
1. 实际 source 从 `human_choice` 变成了 `human_feedback`
2. 初始置信度使用 `human_feedback` 的 0.40 而非 `human_choice` 的 0.30
3. `preference_dimensions` 数据被丢弃（参见 D-02）

---

### D-06 [High] Diff mining 提取的 heuristic 为英文

**测试用例:** TC-1.2

**预期行为:**
Diff mining 应提取中文的实质性经验规则，如 "到港水分10-12%，超12%退货"。

**实际行为:**
提取出的 heuristic 为英文，如 "Replace generic placeholders with concrete, actionable specifications including tolerance ranges"，且 `heuristic_type` 全部为 `preference`（没有 `rule` 或 `correction`）。

**根因分析:**

`diff-extractor.js` 的 `extractFromDiff` 调用 LLM 进行语义差异分析。LLM 以英文输出分析结果，因为 diff prompt 模板可能未指定输出语言。另外 LLM 将所有差异都归类为 `preference` 类型，未区分 `rule`（明确的规则/标准）和 `correction`（纠错）。

**影响:** 原始中文专业知识被翻译成了泛化的英文描述，丢失了"到港水分10-12%"这类精确数值信息。`preference` 类型的 heuristic 在后续 digest 中可能获得更低的晋升优先级。

---

### D-07 [High] 正向反馈 API 参数名不匹配

**测试用例:** TC-3.2

**预期行为:**
```json
{"type": "positive", "spark_id": "ember_xxx", "comment": "..."}
```

**实际行为:**
上述参数格式导致返回空数组 `[]`。必须使用：
```json
{"type": "positive", "emberIdsUsed": ["ember_xxx"]}
```

**根因分析:**

`processPositiveFeedback()` 仅读取 `params.emberIdsUsed` 或 `params.sparkIdsUsed`（数组类型）。不支持 `spark_id`（单值）。这是一个文档与实现不一致的 API 设计问题。

---

### D-08 [Medium] 传入的 confirmation_status 被忽略

**测试用例:** TC-1.1, TC-1.8

**预期行为:**
传入 `"confirmation_status": "human_confirmed"` 时，spark 应继承该状态。

**实际行为:**
`extractFromObservation` 和 `extractFromFeedback` 各自硬编码了 `confirmation_status`：
- `extractFromObservation`: `"unconfirmed"`
- `extractFromFeedback`: `"agent_confirmed"`

传入的 `confirmation_status` 参数被函数内部覆盖。

---

### D-09 [Medium] Digest 仅晋升 1 条 RefinedSpark，card 为空

**测试用例:** TC-2.1

**预期行为:**
20 条 raw spark 中应有多个 domain cluster 被晋升为 RefinedSpark。

**实际行为:**
仅晋升 1 条（烘焙曲线域，从 3 条 raw spark 合成）。RefinedSpark 的 `card.heuristic` 为空字符串 `""`，`card.context_envelope` 所有字段为空。

**根因分析:**

1. 晋升条件可能较严（需要同一 sub_domain 的 3+ active spark 且置信度达标）
2. 由于 D-01（task_negotiation → post_task），很多 spark 的置信度仅 0.15，不够晋升门槛
3. `card` 为空因为所有源 RawSpark 的 card 都是 `null`（D-02），mechanical merge 无法从 null card 中提取内容

---

### D-10 [Medium] Practice 记录的 spark_type 始终为 RawSpark

**测试用例:** TC-2.3

**预期行为:**
传入 RefinedSpark ID 时，`spark_type` 应为 `"RefinedSpark"`。

**实际行为:**
```json
{"spark_type": "RawSpark"}
```

**根因分析:**

`recordPractice()` 可能默认将 `spark_type` 设为 `"RawSpark"`，未根据传入的 `spark_id` 前缀（`refined_`）自动判断类型。

---

### D-11 [Medium] 成功实践未触发置信度提升

**测试用例:** TC-2.3

**预期行为:**
成功的 practice 应对关联 spark 产生 positive confidence delta。

**实际行为:**
```json
{"confidence_delta": 0}
```

**根因分析:**

`recordPractice()` 仅记录实践结果，不直接修改源 spark 的置信度。置信度的更新可能被设计为在 `digest` 阶段批量处理（Step 3 aggregate practice records），但这意味着实时反馈缺失。

---

### D-12 [Medium] `forgeAll --force` 不真正跳过资格检查

**测试用例:** TC-4.1

**预期行为:**
`--force` 应跳过所有资格检查，强制铸造。

**实际行为:**
`forgeAll` 的 `--force` 逻辑为：
```javascript
var eligible = o.force
    ? embers.filter(e => e.status !== 'forged' && e.status !== 'revoked' && e.forge_eligible)
    : embers.filter(isForgeEligible);
```
即使 `--force` 也要求 `forge_eligible: true`。只有单 ember 的 `forgeEmber(id, {force: true})` 才真正跳过检查。

---

### D-13 [Medium] 冷启动计划生成了不相关的软件查询

**测试用例:** TC-0.1

**预期行为:**
为"精品咖啡烘焙"生成领域相关的研究查询。

**实际行为:**
`web_queries` 包含：
- `"咖啡烘焙 常用工具 API"` — 软件概念
- `"精品咖啡烘焙专家 技术栈"` — 软件概念
- `"精品咖啡烘焙专家 实现方案"` — 软件概念

**根因分析:**

`cold-start-planner.js` 的查询模板是面向技术领域设计的，包含"工具 API"、"技术栈"、"实现方案"等固定后缀。对于非软件领域（如咖啡烘焙）产生了不相关查询。

---

### D-14 [Low] agent_exchange 的 extraction_method 为 "dialogue"

**测试用例:** TC-1.11

**预期行为:**
`extraction_method: "agent_exchange"`

**实际行为:**
`extraction_method: "dialogue"`

**根因分析:**

`extractFromAgentExchange()` 内部可能将 `extraction_method` 设为 `"dialogue"` 而非 `"agent_exchange"`。

---

### D-15 [Low] Document ingestion 返回 0 candidates

**测试用例:** TC-1.9

**预期行为:**
从 markdown 文档中提取若干 spark candidates。

**实际行为:**
```json
{"total_candidates": 0, "results": [{"file": "...", "candidates": 0, "error": null}]}
```
耗时 60 秒。

**根因分析:**

`ingest.js` 依赖 `callLLM()` 进行语义提取。LLM 调用可能超时或返回空结果。`error: null` 说明没有抛出异常，但 LLM 未返回有效内容。可能是 LLM 配置问题（API endpoint 响应慢或不兼容 ingest prompt）。

---

### D-16 [Low] `domains` 命令始终返回空数组

**测试用例:** Phase 0-4 全程

**预期行为:**
spark 创建后 domains 列表应包含 "咖啡烘焙"。

**实际行为:**
`node index.js domains` → `[]`

**根因分析:**

`readDomains()` 从 `assets/stp/domains.json` 读取，但全流程中没有任何操作会调用 `writeDomains()` 写入该文件。domain 信息仅存在于 capability_map 和 raw sparks 的 domain 字段中。

---

### D-17 [Low] teach 会话未保存到 extraction_sessions

**测试用例:** TC-1.10

**预期行为:**
`teach` 命令创建的教学会话应保存到 `extraction_sessions/sessions.jsonl`。

**实际行为:**
该目录不存在，没有 session 文件被创建。

**根因分析:**

`startDialogueExtraction()` 创建了内存中的 session 对象，但由于 CLI 是无状态的（每次 `node index.js` 调用是独立进程），session 没有被持久化。`teach` 命令仅返回第一步的 prompt，后续步骤需要新的进程调用，但没有跨进程的 session 存储机制。

---

### D-18 [Low] Crystallize readiness 不统计子域 spark

**测试用例:** TC-4.3

**预期行为:**
检查 "咖啡烘焙" 域的结晶准备度时应包含所有子域（如 "咖啡烘焙.烘焙曲线"）的 spark。

**实际行为:**
```json
{"stats": {"total_raw": 1, "trusted_raw": 0}}
```
仅统计到 1 条（精确匹配 "咖啡烘焙" domain 的），忽略了 "咖啡烘焙.烘焙曲线"、"咖啡烘焙.生豆选择" 等子域的 spark。

---

### D-19 [Info] 资产路径不一致

**整体偏差:**
测试文档中所有 assets 路径使用 `assets/spark/`，实际代码使用 `assets/stp/`。这是测试文档与代码实现的命名差异。

---

### D-20 [Info] Publish 需要显式 owner_confirmed

**测试用例:** TC-3.1

**行为:** 首次 publish 不带 `owner_confirmed: true` 时返回 `cannot_publish_private_spark`。这其实是正确的安全行为（碳基优先原则），但测试文档未明确标注此为必须参数。

---

## 根因分类总结

### 1. 路由/分派缺陷 (D-01, D-05, D-14)

`index.js` 的 kindle 命令路由对 source 类型的覆盖不完整。`SOURCE_INITIAL_CONFIDENCE` 定义了 9 种 source，但路由仅处理 4 种（`human_teaching`, `human_feedback`/`human_choice`, `web_exploration`, `agent_exchange`），其余 5 种（`task_negotiation`, `iterative_refinement`, `self_diagnosis`, `post_task` 默认路径）全部 fallback 到 `extractFromObservation`。

### 2. 输入参数被忽略 (D-02, D-08)

`createRawSpark()` 及各 `extractFrom*` 函数硬编码了 `card: null` 和固定的 `confirmation_status`，不接受调用方传入的值。这使得**调用方无法通过参数控制 spark 的核心属性**，与 STP 设计中"调用方（Agent）负责填充 card"的假设相矛盾。

### 3. 延迟计算设计 (D-04, D-11, D-16)

系统采用了"写入时不计算，digest 时批量重建"的设计哲学。这虽然简化了写入路径，但导致：
- 两次 digest 之间 Agent 的知识状态不准确
- 实时反馈缺失（practice 不触发置信度更新）
- domain 注册表始终为空

### 4. LLM 依赖导致的不确定性 (D-06, D-15)

Diff mining 和 document ingestion 的质量高度依赖 LLM。当 LLM 响应不佳时：
- Diff mining 产出英文/泛化的结果
- Document ingestion 完全失败（0 candidates）
- 没有 mechanical fallback 保证最低限度的提取

### 5. CLI 无状态限制 (D-17)

`teach` 命令的多轮对话设计与 CLI 的单次调用模式冲突。每次 `node index.js teach` 是独立进程，无法维持 session 状态。

### 6. 测试文档与实现不一致 (D-07, D-12, D-13, D-19, D-20)

部分偏差来自测试文档本身的预期与实际 API 设计不符（参数名、force 语义、路径名称），反映了文档和代码之间的同步滞后。

---

## 修复优先级建议

### P0 — 立即修复（影响核心流程）

| 编号 | 修复内容 | 预估工作量 |
|------|---------|-----------|
| D-01 | 在 `index.js` kindle 路由中添加 `task_negotiation`, `iterative_refinement`, `self_diagnosis` 分支 | 0.5h |
| D-02 | `createRawSpark()` 保留传入的 `card` 参数 | 0.5h |
| D-08 | `extractFrom*` 函数尊重传入的 `confirmation_status` | 0.5h |

### P1 — 尽快修复（影响功能完整性）

| 编号 | 修复内容 | 预估工作量 |
|------|---------|-----------|
| D-03 | `extractFromExploration` 设置 `contributor.type = "agent"` | 15min |
| D-04 | `appendRawSpark` 后触发轻量 domain 注册 | 1h |
| D-05 | 拆分 `human_choice` 和 `human_feedback` 的处理路径 | 1h |
| D-06 | Diff mining prompt 添加语言控制 + heuristic_type 分类指引 | 1h |
| D-12 | `forgeAll` 的 `--force` 逻辑修正为跳过 `forge_eligible` 检查 | 15min |

### P2 — 计划修复（影响用户体验）

| 编号 | 修复内容 | 预估工作量 |
|------|---------|-----------|
| D-07 | 统一 feedback API 参数名，支持 `spark_id` 单值 | 0.5h |
| D-09 | 优化 digest 晋升逻辑 + 从 null card 场景的 fallback | 2h |
| D-10 | `recordPractice` 根据 ID 前缀自动推断 spark_type | 15min |
| D-11 | 在 `recordPractice` 中增加实时 confidence delta 计算 | 1h |
| D-13 | `cold-start-planner` 的查询模板增加领域类型判断 | 1h |
| D-16 | 在 digest 的 `rebuildCapabilityMap` 后同步更新 `domains.json` | 15min |
| D-17 | 为 `teach` 添加 session 持久化（可写入 `extraction_sessions/`） | 2h |
| D-18 | Crystallize readiness 统计时做 domain 前缀匹配 | 30min |

---

## 正向发现（符合预期的功能）

| 功能 | 实际表现 | 说明 |
|------|---------|------|
| `human_teaching` 置信度 | 0.70 (= 0.50 + 0.20 boost) | 完全匹配 SOURCE_INITIAL_CONFIDENCE + boost 规则 |
| Teaching spark 的 confirmation_status | `human_confirmed` | 正确 |
| Teaching spark 的 contributor | `{type:"human", id:"owner", domain_expertise:0.8}` | 自动识别为 owner |
| Exploration spark 的 status | `pending_verification` | 正确，web 来源进入待验证 |
| Exploration spark 的 confidence | 0.20 | 完全匹配 |
| Diff mining extraction_method | `diff_mining` | 正确识别并标注 |
| Agent exchange contributor.type | `"agent"` | 正确 |
| Agent exchange confidence | 0.25 | 完全匹配 |
| Digest 的 capability_map 构建 | 正确构建了 5 个子域 | 分数计算合理 |
| Preference profile 生成 | 完整的偏好画像 + persona_text | 质量很高，中文输出 |
| Publish 脱敏 | contributor 匿名为 `contributor_1` | 隐私保护正确 |
| Ember status | `candidate` | 正确的初始状态 |
| Forge (单 ember --force) | 成功生成 Gene + 写入 evolver | AI-assisted 策略生成质量好 |
| Gene 结构 | 完整的 strategy/validation/constraints/preconditions | 符合 GEP 2.0 schema |
| Gene 写入 evolver | 成功写入 `evolver-main/assets/gep/genes.jsonl` | 路径发现正确 |
| Search 功能 | 返回 RefinedSpark，含完整 credibility | nucleus sampling 工作正常 |
| Review cards | 正确列出 candidate ember | 含操作指引 |
