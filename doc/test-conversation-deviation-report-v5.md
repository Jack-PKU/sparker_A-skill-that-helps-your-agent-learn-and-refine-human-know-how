# 端到端测试详细报告 V5（修复后重测）

> **测试时间**: 2026-02-28 12:48–12:55 GMT+8  
> **Session ID**: `test-e2e-v4-fix`  
> **模型**: Claude Sonnet 4.6 (thinking: low)  
> **测试基准**: `test-e2e-coffee-roasting.md`  
> **前置修复**: extractor.js / promoter.js / plan 命令 / reference 文件 / SKILL.md domain 规范

---

## 测试覆盖

| 测试用例 | 描述 | 是否执行 | 评级 |
|----------|------|---------|------|
| **TC-0.1** | 冷启动触发（领域宣告） | ✅ | **A** |
| TC-0.2 | 自主研究（web_exploration） | ❌ 未测 | — |
| **TC-1.1** | 任务嵌入式学习 | ✅ | **A** |
| TC-1.2 | 修改痕迹提炼 | ❌ 未测 | — |
| **TC-1.3** | 闲聊信号捕捉 | ✅ | **S** |
| TC-1.4 | 迭代精修弧 | ❌ 未测 | — |
| **TC-1.5** | 微追问 | ✅ (嵌入 TC-1.1/1.3) | **S** |
| TC-1.6 | 比较式采集 | ❌ 未测 | — |
| TC-1.7 | 选择历史归纳 | ❌ 未测 | — |
| TC-1.8 | 点评式验证 | ❌ 未测 | — |
| TC-1.9 | 资料导入提炼 | ❌ 未测 | — |
| TC-1.10 | 对话记录采集 | ❌ 未测 | — |
| TC-1.11 | 结构化萃取 | ❌ 未测 | — |
| **TC-2.1** | 首次 Digest | ✅ | **A** |
| TC-2.2+ | 持续任务实践 / Boundary / 簇检索 | ❌ 未测 | — |
| TC-3.x | 传火（Ember 发布） | ❌ 未测 | — |
| TC-4.x | 铸火（Gene 固化） | ❌ 未测 | — |

**本次覆盖**: 4 个核心测试用例（Phase 0 + Phase 1 部分 + Phase 2 部分），验证修复后的全链路基本功能。

---

## TC-0.1 冷启动触发（领域宣告）

### 输入

```
我要把你训练成一个精品咖啡烘焙专家。我自己做了12年烘焙，有自己的品牌，我会把我所有的经验都教给你。
```

### 预期行为 vs 实际行为

| 行为 | 预期 | 实际 | 匹配 |
|------|------|------|------|
| 读取 SKILL.md | ✓ 首轮读取完整内容 | ✅ 第一个工具调用即 `read SKILL.md` | **完全匹配** |
| 识别为全新领域 | ✓ 触发冷启动 | ✅ thinking: "TRIGGER 2: Cold Start Plan (new domain detected)" | **完全匹配** |
| 执行 `plan` | ✓ `plan 咖啡烘焙 "..."` | ✅ `plan 咖啡烘焙 "成为精品咖啡烘焙专家，掌握生豆选择、烘焙曲线、杯测、品质控制等全链路知识"` | **完全匹配** |
| 执行 `status` | ✓ 确认空白状态 | ✅ `status` → `total_raw_sparks:0, domains:["咖啡烘焙"]` | **完全匹配** |
| 执行 `teach` | ✓ 启动萃取会话 | ✅ `teach 咖啡烘焙` → ExtractionSession 创建成功 | **完全匹配** |
| 读取冷启动协议 | ✓ `cold-start-protocol.md` | ✅ 成功读取并应用 | **完全匹配** |
| 不问基础问题 | ✓ 不应问"什么是精品咖啡" | ✅ 没有问基础概念，直接列子领域让用户选 | **完全匹配** |
| 表达学习意愿 | ✓ 自然表达 | ✅ "12年烘焙 + 自有品牌，这个量级的经验是教科书里找不到的东西。我要认真学。" | **完全匹配** |

### 预期 CLI 操作 vs 实际

| 预期命令 | 实际执行 | 匹配 |
|----------|---------|------|
| `plan 咖啡烘焙 "精品咖啡烘焙专家"` | `plan 咖啡烘焙 "成为精品咖啡烘焙专家，掌握生豆选择、烘焙曲线、杯测、品质控制等全链路知识"` | ✅ goal 更详细 |
| `status` | `status` | ✅ |
| *(预期没有 teach)* | 额外执行了 `teach 咖啡烘焙` | ⚠️ 多了一步，但合理（用户说"教给你"） |

### 预期产物 vs 实际产物

| 产物 | 预期 | 实际 | 匹配 |
|------|------|------|------|
| cold_start_plans.json | `{domain:"咖啡烘焙", goal:"...", phase:"research", is_new_domain:true}` | ✅ `{domain:"咖啡烘焙", goal:"...", phase:"research", status:"active", is_new_domain:true}` | **完全匹配** |
| capability_map | `{咖啡烘焙: {status:"blind_spot", score:0}}` | ✅ `{咖啡烘焙: {status:"blind_spot", score:0, spark_count:0}}` | **完全匹配** |
| ExtractionSession | *(预期无)* | 额外创建了 `session_ebc95cde` (domain:"咖啡烘焙") | ⚠️ 多了一步 |

### 偏差分析

| 偏差项 | 严重度 | 说明 |
|--------|--------|------|
| sub_skills 未填充 | 低 | plan 创建时 sub_skills 为空数组，预期应在 TC-0.2 自主研究后填充 |
| 未执行 TC-0.2 自主研究 | 中 | 未搜索网络了解领域全貌，未做子技能树分解（TC-0.2 未发送） |
| domain 中文 | 无偏差 | 正确使用 `咖啡烘焙` 而非英文 ✅ |

### 评级: **A**

完美执行了冷启动的核心流程（plan + status + teach + 冷启动协议），唯一缺失是 TC-0.2 的自主研究（未测试）。

---

## TC-1.1 任务嵌入式学习（Task-Embedded Extraction）

### 输入 #1

```
帮我写一份埃塞俄比亚耶加雪菲的生豆采购评估单。
```

### 预期行为 vs 实际行为 — Step 1: Pre-task Search

| 行为 | 预期 | 实际 | 匹配 |
|------|------|------|------|
| search 执行 | ✓ 搜索"生豆采购评估" | ✅ `search "埃塞俄比亚 耶加雪菲 生豆采购 评估"` | **完全匹配** |
| search 结果 | 空（cold_start） | ✅ `results:[], total_candidates:0` | **完全匹配** |
| 合理提问 | ✓ "水分、目数、瑕疵率这些要列吗？" | ✅ 直接出底稿 + 3 个精准提问（含水率验收线/杯测协议/评级门槛） | **匹配，方式更好** |

### 输入 #2（用户澄清）

```
对，水分必须列。我们的标准是到港水分10-12%，超过12%不收。另外一定要列瑕疵率，SCA标准是瑕疵数不超过5个/350g样品。产地海拔也要，耶加一定要1800米以上的。
```

### 预期静默捕获 vs 实际

| # | 预期 heuristic | 预期 source | 预期 conf | 实际 source | 实际 conf | 实际 heuristic | 匹配 |
|---|---------------|-------------|-----------|-------------|-----------|---------------|------|
| 1 | "到港水分10-12%，超12%不收" | `task_negotiation` | 0.35 | `human_teaching` | 0.70 | "耶加雪菲到港水分必须在10-12%，超过12%硬性拒收" | ⚠️ source/conf 偏差 |
| 2 | "SCA瑕疵标准≤5个/350g" | `task_negotiation` | 0.35 | `human_teaching` | 0.70 | "瑕疵豆检验用350g样品，SCA标准不超过5个缺陷（非我之前写的300g）" | ⚠️ source/conf 偏差 |
| 3 | "耶加雪菲海拔>=1800m" | `task_negotiation` | 0.35 | `human_teaching` | 0.70 | "耶加雪菲必须1800米以上海拔才考虑采购" | ⚠️ source/conf 偏差 |

### 实际 Spark 产物详细对比

**Spark #1 — 水分标准**

| 字段 | 预期值 | 实际值 | 匹配 |
|------|--------|--------|------|
| source | `task_negotiation` | `human_teaching` | ❌ |
| confidence | 0.35 | 0.70 | ❌ (过高) |
| domain | `咖啡烘焙.生豆选择` | `咖啡烘焙.生豆采购` | ⚠️ 子域名不同但合理 |
| heuristic_type | `rule` | `boundary` | ⚠️ 实际分类更精准 |
| context_envelope | `{domain, sub_domain}` | `{domain, sub_domain, extra:{origin, stage}}` | ✅ **超出预期** |
| boundary_conditions | `[]` | `[{condition:"超过12%", effect:"reject", reason:"水分过高影响储存和烘焙稳定性"}]` | ✅ **超出预期** |
| confirmation_status | `human_confirmed` | `human_confirmed` | ✅ |
| status | `active` | `active` | ✅ |

**Spark #2 — 瑕疵标准**

| 字段 | 预期值 | 实际值 | 匹配 |
|------|--------|--------|------|
| source | `task_negotiation` | `human_teaching` | ❌ |
| confidence | 0.35 | 0.70 | ❌ |
| heuristic | "SCA瑕疵标准≤5个/350g" | "瑕疵豆检验用350g样品，SCA标准不超过5个缺陷（非我之前写的300g）" | ✅ 更详细 |
| context_envelope | `{domain, sub_domain}` | `{domain, sub_domain, extra:{origin, method:"SCA"}}` | ✅ **超出预期** |
| boundary_conditions | `[]` | `[{condition:"超过5个缺陷/350g", effect:"reject"}]` | ✅ **超出预期** |

**Spark #3 — 海拔门槛**

| 字段 | 预期值 | 实际值 | 匹配 |
|------|--------|--------|------|
| source | `task_negotiation` | `human_teaching` | ❌ |
| heuristic_type | `boundary` | `boundary` | ✅ **完全匹配** |
| boundary_conditions | `[]` | `[{condition:"低于1800米", effect:"reject", reason:"海拔不足，风味复杂度和酸质表现不达标"}]` | ✅ **超出预期** |

### 预期产物路径 vs 实际

| 预期 | 实际 | 匹配 |
|------|------|------|
| `assets/spark/raw_sparks/raw_sparks.jsonl ← +3 行` | `assets/stp/raw_sparks/raw_sparks.jsonl ← +3 行` | ✅ (路径不同但功能等价) |

### 关键验证点

| 验证点 | 预期 | 实际 | 匹配 |
|--------|------|------|------|
| 提问 100% 服务任务 | ✓ | ✅ 先出底稿再让用户改，问题聚焦评估单本身 | ✅ |
| 用户感知"在用工具" | ✓ | ✅ 写了评估单 + 同步改文档 | ✅ |
| 一条知识一条 Spark | ✓ | ✅ 3 条标准 → 3 条 Spark | ✅ |
| extraction_method | `task_negotiation` | `teaching` | ❌ |

### 微追问（嵌入 TC-1.1 尾部）

```
顺手记一个细节：你说的 350g 样本我已经照改了，但 SCA 官方协议写的是 300g——
你们用 350g 是自己的内部标准，还是我之前底稿写错了？想确认一下，这个数字以后会影响其他产地的评估单。
```

| 验证点 | 预期 | 实际 | 匹配 |
|--------|------|------|------|
| 嵌入回复末尾 | ✓ | ✅ 在任务完成后自然追加 | ✅ |
| 2 秒能答 | ✓ | ✅ 是非题 + 范围确认 | ✅ |
| 不单独发消息 | ✓ | ✅ 嵌在同一条回复中 | ✅ |
| 服务于学习 | ✓ | ✅ 确认 350g 是内部标准还是笔误，对后续评估单有影响 | ✅ |

### 偏差总结

| 偏差 | 严重度 | 根因 | 影响 |
|------|--------|------|------|
| source 全部为 `human_teaching` 而非 `task_negotiation` | **中** | 模型未区分"任务中给标准"和"主动教学" | confidence 偏高 (0.70 vs 0.35) |
| confidence 0.70 而非 0.35 | **中** | 因 source 错误导致 | 新知识过早获得高信任度 |
| context_envelope 超出预期 | **正向** | SKILL.md 规范 + 模型能力 | 数据更丰富 |
| boundary_conditions 超出预期 | **正向** | 同上 | 搜索和 digest 更有效 |

### 评级: **A**

Spark 捕获全部成功，card 质量超出预期（context_envelope + boundary_conditions 完整填充），唯一核心偏差是 source 分类。

---

## TC-1.3 闲聊信号捕捉（Casual Mining）

### 输入

```
最近精品咖啡圈都在追厌氧日晒，但说实话，传统水洗处理的豆子风味更干净，做意式基底远比厌氧好用。厌氧那种发酵感太强了，打出来的牛奶咖啡会怪怪的。
```

### 预期行为 vs 实际行为

| 行为 | 预期 | 实际 | 匹配 |
|------|------|------|------|
| 静默识别为对比评价 | ✓ | ✅ thinking: "casual_mining spark - they're sharing domain expertise through casual remark" | **完全匹配** |
| source = `casual_mining` | ✓ | ✅ `"source":"casual_mining"` | **完全匹配** ★ |
| 不中断对话 | ✓ | ✅ kindle 在后台，回复自然流畅 | **完全匹配** |
| 微追问验证 | ✓ | ✅ 回复末尾："你们的意式拼配用的耶加雪菲，主要是做水洗还是会加一点日晒平衡醇厚度？" | **完全匹配** |

### 实际 Spark 产物 vs 预期

| 字段 | 预期 | 实际 | 匹配 |
|------|------|------|------|
| source | `casual_mining` | `casual_mining` | ✅ **完全匹配** |
| confidence | 0.25 | 0.25 | ✅ **完全匹配** |
| domain | `咖啡烘焙.生豆选择` | `咖啡烘焙.处理法` | ⚠️ 子域名不同，实际更精准 |
| heuristic | "意式基底用水洗豆优于厌氧日晒" | "意式基底选豆优先水洗处理，厌氧发酵感过强会破坏牛奶咖啡风味平衡" | ✅ 更详细 |
| heuristic_type | `preference` | `preference` | ✅ **完全匹配** |
| context_envelope | `{domain, sub_domain:"处理法选择", extra:{use_case:"意式基底"}}` | `{domain, sub_domain:"处理法", extra:{use_case:"意式基底", drink_type:"牛奶咖啡，拿铁，卡布"}}` | ✅ **超出预期** |
| boundary_conditions | `[{condition:"厌氧发酵感与牛奶不搭", effect:"do_not_apply"}]` | `[{condition:"厌氧日晒用作意式基底", effect:"avoid", reason:"..."}, {condition:"单品手冲或黑咖啡", effect:"modify", reason:"厌氧发酵感作为风味亮点可接受"}]` | ✅ **超出预期**（双条件） |
| confirmation_status | `unconfirmed` / `pending_verification` | `pending_verification` | ✅ **匹配** |

### 偏差总结

| 偏差 | 严重度 | 说明 |
|------|--------|------|
| 无负面偏差 | — | 所有字段匹配或超出预期 |
| boundary_conditions 双条件 | **正向** | 模型自动推导了"单品手冲可接受"的反向条件 |
| drink_type 字段 | **正向** | 自动补充了具体饮品类型 |

### 评级: **S**

source/confidence/heuristic_type 全部完美匹配预期，card 质量超出预期。这是本次测试中最佳的单项表现。

---

## TC-1.5 微追问（贯穿测试）

微追问不是独立测试用例，而是嵌入在其他 TC 的回复末尾。

### 微追问清单

| 出现位置 | 追问内容 | 模板类型 | 质量 |
|----------|---------|---------|------|
| TC-0.1 末尾 | "你想从哪一块开始教我？或者你有自己的顺序——我跟着你走。" | 开放引导（cold_start） | ✅ 自然 |
| TC-1.1 末尾 | "你们用 350g 是自己的内部标准，还是我之前底稿写错了？" | 模板 D — 边界探测 | ✅ 精准 |
| TC-1.3 末尾 | "你们的意式拼配用的耶加雪菲，主要是做水洗还是会加一点日晒平衡醇厚度？" | 模板 F — 范围确认 | ✅ 延伸 |

| 验证点 | 预期 | 实际 | 匹配 |
|--------|------|------|------|
| 每次交互最多 1 次追问 | ✓ | ✅ 每条回复仅 1 个追问 | ✅ |
| 嵌入回复末尾 | ✓ | ✅ 全部在回复最后一段 | ✅ |
| 二选一/确认式优先 | ✓ | ✅ 350g 确认是二选一，拼配是 A/B | ✅ |
| cold_start 预算 3 次/交互 | ✓ | ✅ 实际 1 次/交互（保守） | ✅ |

### 评级: **S**

---

## TC-2.1 首次 Digest

### 输入

```
把你目前学到的咖啡烘焙经验总结一下。
```

### 预期行为 vs 实际行为

| 行为 | 预期 | 实际 | 匹配 |
|------|------|------|------|
| 识别 TRIGGER 5 | ✓ | ✅ thinking: "TRIGGER 5 - I need to run the digest command" | ✅ |
| 执行 `digest` CLI | ✓ | ✅ `node index.js digest` → 成功返回 DigestReport | ✅ |
| 不自己写总结 | ✓ digest 输出为准 | ✅ 基于 DigestReport 格式化输出 | ✅ |
| RefinedSpark 晋升 | ✓ 有条件的晋升 | ✅ `promoted_to_refined: 1` | ✅ |

### 预期 Digest 9 步 vs 实际

| 步骤 | 预期 | 实际 | 匹配 |
|------|------|------|------|
| 1. readRawSparksWithSnapshot | 汇总 RawSpark | ✅ 4 条 | ✅ |
| 2. byDomain 分组 | 按领域分组 | ✅ 2 域 (生豆采购 3条, 处理法 1条) | ✅ |
| 3. readPracticeRecords | 分析实践 | ✅ 0 条 (无实践) | ✅ |
| 3.5. discoverAllBoundaries | Boundary 发现 | ✅ 0 条 (数据不足) | ✅ |
| 4. promoteEligibleRawSparks | 晋升 RefinedSpark | ✅ **1 条晋升** (生豆采购 3条 ≥ MIN_GROUP_SIZE 2) | ✅ |
| 4.5. rebuildClusterCache | 簇构建 | ✅ 0 簇 (数据不足) | ✅ |
| 5. decay | 时间衰减 | ✅ 0 条衰减 (刚创建) | ✅ |
| 6. meetsRefinementThreshold | 晋升/淘汰 | ✅ 0 条 publish_ready (score 不足) | ✅ |
| 7. shouldProfile | 偏好画像 | ✅ 0 次 (spark 不足) | ✅ |
| 8. rebuildCapabilityMap | 图谱重建 | ✅ 见下表 | ✅ |
| 9. review candidates | 点评推送 | ✅ 0 条 (无社区 Ember) | ✅ |

### 预期 RefinedSpark vs 实际

| 字段 | 预期 (参考 TC-2.1) | 实际 | 匹配 |
|------|-------------------|------|------|
| domain | `咖啡烘焙.烘焙曲线` (预期场景不同) | `咖啡烘焙.生豆采购` | ✅ 域正确 |
| evidence_sparks | 多条合并 | `[raw_2e78a74d, raw_dd0d2787, raw_8d26fa12]` (3 条) | ✅ |
| credibility.composite | ~0.49 | 0.70 | ⚠️ 因为 source=human_teaching, conf=0.70 |
| summary | 含多条 heuristic | "咖啡烘焙.生豆采购 经验 (3条): 水分10-12%...; 350g样品...; 1800米以上..." | ✅ |
| card.boundary_conditions | 合并 | `[{超过12% → reject}, {超过5个缺陷 → reject}, {低于1800米 → reject}]` | ✅ **完整合并** |
| status | `active` | `active` | ✅ |

### 预期 DigestReport vs 实际

| 字段 | 预期 | 实际 | 匹配 |
|------|------|------|------|
| new_raw_sparks | ~50 (完整测试) | 4 (本次测试规模) | ✅ 按比例合理 |
| domains_active | 1 | 2 (生豆采购 + 处理法) | ✅ |
| promoted_to_refined | 0~2 | 1 | ✅ |
| publish_ready | 0 | 0 | ✅ score 不足 |

### 预期 Capability Map vs 实际

| 字段 | 预期 (完整测试后) | 实际 | 说明 |
|------|------------------|------|------|
| 咖啡烘焙.status | `learning` | `proficient` | ⚠️ 因 refined_count=1, score=0.61 达到 proficient 条件 |
| 咖啡烘焙.score | 0.380 | 0.61 | ⚠️ 因 confidence 偏高 (0.70) |
| 生豆采购.status | `learning` | `proficient` | ⚠️ 同上原因 |
| 生豆采购.score | 0.45 | 0.70 | ⚠️ |
| 处理法.status | — | `blind_spot` (score=0) | ✅ 仅 1 条 casual_mining, 未晋升 |

### Agent 输出质量

Agent 的总结输出分为清晰的模块：

```
🟢 生豆采购 · 耶加雪菲硬性指标（3条）
🟡 处理法 · 意式场景的实战判断（1条）
📊 当前状态 — 4条原始，1条已提炼，盲区列表
```

| 验证点 | 预期 | 实际 | 匹配 |
|--------|------|------|------|
| 基于 DigestReport 输出 | ✓ | ✅ 数字与 DigestReport 一致 | ✅ |
| 明确标注盲区 | ✓ | ✅ "烘焙曲线、杯测标准、拼配逻辑、品控体系……" | ✅ |
| 区分已提炼 vs 原始 | ✓ | ✅ "4条原始经验，1条已提炼为系统知识" | ✅ |

### 偏差总结

| 偏差 | 严重度 | 根因 |
|------|--------|------|
| capability_map score 偏高 | 中 | TC-1.1 的 source/confidence 偏差的连锁反应 |
| proficient 过早达成 | 中 | 同上 — 如果 source=task_negotiation, conf=0.35，则 score ~0.33，status="learning" |

### 评级: **A**

Digest 9 步完整执行，RefinedSpark 成功晋升，Agent 输出清晰。偏差来自上游 source 分类问题的级联效应。

---

## 全链路产物验证

### 最终文件清单

```
assets/stp/
├── raw_sparks/
│   └── raw_sparks.jsonl              4 行     ← 3条 human_teaching + 1条 casual_mining
├── refined_sparks/
│   └── refined_sparks.json           1 条     ← 生豆采购域 3 条合并晋升
├── extraction_sessions/
│   └── sessions.jsonl                1 行     ← 咖啡烘焙 structured_extraction
├── digest_reports/
│   └── digest_reports.jsonl          1 行     ← 首次 DigestReport
├── capability_map/
│   ├── capability_map.json           2 子域   ← 生豆采购 proficient + 处理法 blind_spot
│   └── domains.json                  1 域     ← ["咖啡烘焙"]
└── cold_start_plans.json             1 条     ← 咖啡烘焙 research phase
```

### Source 分类统计

| source | 预期条数 | 实际条数 | 匹配 |
|--------|---------|---------|------|
| `task_negotiation` | 3 | 0 | ❌ |
| `human_teaching` | 0 | 3 | ❌ (应为 task_negotiation) |
| `casual_mining` | 1 | 1 | ✅ |
| **合计** | 4 | 4 | ✅ |

### Confidence 统计

| source | 预期 confidence | 实际 confidence | 匹配 |
|--------|----------------|----------------|------|
| task_negotiation (3条) | 0.35 | 0.70 (标记为 human_teaching) | ❌ 过高 |
| casual_mining (1条) | 0.25 | 0.25 | ✅ **完全匹配** |

---

## 现存问题清单

### P0 — 影响评分核心

| # | 问题 | 现状 | 影响 | 修复方向 |
|---|------|------|------|---------|
| **P0-1** | source 分类: task_negotiation 未区分 | 任务中用户给出标准时标记为 human_teaching | confidence 偏高 (0.70→0.35)，导致 capability_map 评分虚高 | SKILL.md 增加更明确的场景判断规则；或 CLI 端增加上下文推断（检测是否在任务执行中） |

### P1 — 影响测试覆盖

| # | 问题 | 现状 | 修复方向 |
|---|------|------|---------|
| **P1-1** | TC-0.2 自主研究未覆盖 | 未测试 web_exploration spark 创建 | 需在测试中发送触发 TC-0.2 的 prompt |
| **P1-2** | TC-1.4 迭代精修弧未覆盖 | 未测试 iterative_refinement 合成 | 需 3 轮修改 + 最终确认的多 turn 测试 |
| **P1-3** | TC-1.2 修改痕迹未覆盖 | 未测试 human_feedback + post-task | 需要 Agent 出初稿后用户纠正的场景 |
| **P1-4** | TC-1.6 比较式采集未覆盖 | 未测试 human_choice A/B 选项 | 需非标任务的关键决策点场景 |
| **P1-5** | TC-1.11 结构化萃取未覆盖 | 未完整测试 6 步教学框架 | 需 "我来教你杯测" + 6 轮对话 |

### P2 — 优化项

| # | 问题 | 现状 | 修复方向 |
|---|------|------|---------|
| **P2-1** | contributor.domain_expertise 固定 0.5 | 用户说 "12年经验+自有品牌" 应为 0.9+ | extractor.js 支持从 params 接收 contributor_expertise |
| **P2-2** | sub_domain 命名不完全一致 | 预期 `生豆选择` 实际 `生豆采购` | 统一子域命名规范 |
| **P2-3** | preference_dimensions 未填充 | 预期 `["processing_method"]`，实际 `[]` | 模型需在 kindle 参数中填充此字段 |
| **P2-4** | tags 未使用 | 预期有 `["boundary_condition"]` 等标签 | 模型需在 kindle 参数中添加 tags |

---

## 评分总结

### 单测试用例评分

| 测试用例 | 评级 | 说明 |
|----------|------|------|
| TC-0.1 冷启动 | **A** | plan + status + teach + 冷启动协议全部正确执行 |
| TC-1.1 任务嵌入式 | **A** | Spark 捕获成功 + card 质量超预期，source 分类偏差 |
| TC-1.3 闲聊捕捉 | **S** | source/confidence/type 全部完美匹配，card 超出预期 |
| TC-1.5 微追问 | **S** | 每轮嵌入，自然精准，模板匹配良好 |
| TC-2.1 Digest | **A** | 9 步完整执行，RefinedSpark 晋升成功，上游 conf 偏差级联 |

### 全流程评分

按 test-e2e-coffee-roasting.md 评分标准：

| 级别 | 标准 | 达成 |
|------|------|------|
| **S** | TC-0.1 到 TC-4.3 全部通过，Ember 铸造为 Gene | ❌ |
| **A** | 采火和炼火全部通过，成功产出 Ember | ❌ (采火未全覆盖) |
| **B+** | 采火部分通过，Digest 能产出 RefinedSpark | ✅ **当前达成** |
| **B** | 采火全部通过，Digest 能产出 RefinedSpark | ❌ (采火未全覆盖) |
| **C** | 部分采集技术工作，炼火链路不通 | — |
| **D** | 无法完成基本的 RawSpark 采集 | — |

**全流程评级: B+** — 核心链路 (kindle → digest → refine) 全通，4/11 采集技术验证通过，RefinedSpark 成功晋升。

### 量化评分

| 维度 | 分数 | 说明 |
|------|------|------|
| SKILL.md 读取 | 10/10 | 首轮即读 |
| Spark 捕获成功率 | 9/10 | 4/4 成功 |
| Source 分类准确率 | 5/10 | 1/4 正确 (casual_mining)，3/4 错误 (应为 task_negotiation) |
| Confidence 准确率 | 5/10 | 1/4 完美匹配 (casual_mining=0.25)，3/4 偏高 |
| Card 质量 | 9.5/10 | context_envelope + boundary_conditions 全部超预期 |
| Domain 命名 | 9/10 | 中文 + 子域全部正确 |
| 冷启动协议 | 9/10 | plan + status + teach + 协议文件 |
| Pre-task Search | 9/10 | 执行了 1 次 search (cold_start 空结果合理) |
| Digest 完整度 | 9/10 | 9 步全执行，晋升成功 |
| 微追问质量 | 10/10 | 自然嵌入，精准有用 |
| **综合** | **8.5/10** | |

---

## 下一步优化方向

### 短期（提升到 9.0+）

1. **修复 source 分类** — 在 SKILL.md 中增加更明确的判断规则：

```
判断顺序（按优先级）：
1. 用户在任务执行中给出标准 → task_negotiation (0.35)
   信号："我们的标准是..."、"一定要列..."、"必须..."（在任务上下文中）
2. 用户主动教学 → human_teaching (0.70)
   信号："我来教你..."、"教你X..."
3. 用户随口聊 → casual_mining (0.25)
   信号：非任务、非教学的经验分享
```

2. **完善 extractor.js** — source = `task_negotiation` 时使用 `extractFromTaskNegotiation`，confidence 应为 0.35 而非 0.70

### 中期（提升到 9.5）

3. **补齐测试覆盖** — TC-1.2 (diff mining) + TC-1.4 (iterative refinement) + TC-1.6 (comparative) + TC-1.11 (structured extraction 6 步)
4. **contributor.domain_expertise 自适应** — 根据用户自述经验 (12年, 自有品牌) 自动设置为 0.9
5. **preference_dimensions 填充** — 模型需在 kindle 时填充 `["processing_method"]` 等维度标签

### 长期（覆盖完整生命周期）

6. **Phase 2 完整测试** — TC-2.2 (Search Before Acting) + TC-2.3 (Boundary 自动发现) + TC-2.4 (簇检索)
7. **Phase 3-4** — Ember 发布 + 社区验证 + Gene 铸造（需要 SparkLand 基础设施）
