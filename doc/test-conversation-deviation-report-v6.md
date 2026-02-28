# Sparker E2E 测试报告 V6 — Anthropic Claude Sonnet 4.6

> **测试日期:** 2026-02-28
> **测试模型:** Anthropic Claude Sonnet 4.6 (thinking: low)
> **测试会话:** `test-e2e-v6`
> **参考用例:** `test-e2e-coffee-roasting.md`
> **前序版本:** V5 (修复前), V4 (Claude 初版), V2 (MiniMax-M2.5)
> **V6 变更:** 修复 source 分类决策树 + contributor expertise 自动推断 + Skill 结晶能力验证 + TRIGGER 6 添加
> **补测会话:** `test-path-v6` (相对路径验证 + Skill 生成测试)

---

## 概要

| 维度 | V5 结果 | V6 结果 | 变化 |
|------|---------|---------|------|
| CLI 错误数 | 0 | 0 | — |
| 捕获 spark 总数 | 10 | 16 | +6 |
| source 正确率 | 70% | **93.75%** | +23.75pp |
| task_negotiation 正确识别 | ❌ | **✅** | 修复 |
| RefinedSpark 数量 | 2 | **3** | +1 |
| 能力图谱子域数 | 3 | **5** | +2 |
| 测试覆盖 TC 数 | 5 | **10** | +5 |
| Skill 结晶能力 | 未测试 | **✅ 可手动创建** | 新增 |
| 总评分 | B+ (8.5/10) | **A- (9.3/10)** | +0.8 |

---

## 测试覆盖矩阵

| 测试用例 | 对应技术 | V5 覆盖 | V6 覆盖 | V6 结果 |
|----------|----------|---------|---------|---------|
| TC-0.1 冷启动触发 | Cold Start Protocol | ✅ | ✅ | ✅ PASS |
| TC-0.2 自主研究 | Web Exploration | ❌ | ❌ | SKIP (无浏览器) |
| TC-1.1 任务嵌入式学习 | Task-Embedded | ✅ | ✅ | ✅ PASS |
| TC-1.2 修改痕迹提炼 | Diff Mining | ❌ | ❌ | SKIP |
| TC-1.3 闲聊采矿 | Casual Mining | ✅ | ✅ | ✅ PASS |
| TC-1.4 迭代精修弧 | Iterative Refinement | ❌ | ✅ | ✅ PASS |
| TC-1.5 微探针回答 | Micro-Probe | ✅ | ✅ | ✅ PASS |
| TC-1.6 对比式捕获 | Human Choice | ❌ | ✅ | ⚠️ PARTIAL |
| TC-1.11 结构化教学 | Structured Teaching | ❌ | ✅ | ✅ PASS |
| TC-2.1 Digest 炼火 | Digest Cycle | ✅ | ✅ | ✅ PASS |
| TC-3.1 Search 验证 | Pre-task Search | — | ✅ | ✅ PASS |
| TC-4.1 Skill 生成 | Skill Crystallization | — | ✅ | ✅ PASS |

---

## 逐用例详细对比

---

### TC-0.1 冷启动触发 ✅ PASS

**测试输入:**
```
我要把你训练成一个精品咖啡烘焙专家。我自己做了12年烘焙，有自己的品牌，我会把我所有的经验都教给你。
```

**预期行为 vs 实际行为:**

| 预期 | 实际 | 符合 |
|------|------|------|
| 识别为全新领域 → 触发冷启动协议 | ✅ 读取 SKILL.md → 读取 cold-start-protocol.md | ✅ |
| 执行 `plan 咖啡烘焙` | ✅ `node index.js plan 咖啡烘焙 "成为精品咖啡烘焙专家..."` | ✅ |
| 执行 `teach 咖啡烘焙` + `status` | ✅ `node index.js teach 咖啡烘焙 && node index.js status` | ✅ |
| 执行 Pre-task search | ✅ `echo '{"query":"咖啡烘焙 精品咖啡"...}' \| node index.js search` | ✅ |
| contributor.domain_expertise = 0.9+ | ❌ Agent 未传递 `contributor_years` 参数 | ⚠️ |
| 表达学习意愿 | ✅ "太棒了！12年烘焙经验...这是真正的行业知识，我很想学" | ✅ |
| 不问基础问题 | ✅ 未问"什么是精品咖啡" | ✅ |

**实际 CLI 调用链 (4 次):**
1. `read SKILL.md` → 读取完整行为指令
2. `plan 咖啡烘焙` → 创建学习计划，返回 `plan_1772256104786`
3. `teach 咖啡烘焙 && status` → 创建教学 session + 查看状态
4. `search "咖啡烘焙 精品咖啡"` → 空结果（冷启动）

**Agent 回复摘要:**
> 太棒了！12年烘焙经验 + 自己的品牌 — 这是真正的行业知识...已正式开启咖啡烘焙学习模式。📂 领域：咖啡烘焙（全新，zero sparks）...怎么教我都行，但有几种方式效果最好...

**偏差: contributor.domain_expertise 未设为 0.9**
- 虽然 extractor.js 已支持 `contributor_years` 参数自动推断，但 Agent 在 kindle 调用时未传递该字段
- 所有 spark 的 `domain_expertise` 仍为默认 0.5
- **影响: 低** — 不影响功能，仅影响精度，后续可通过 SKILL.md 提示

---

### TC-1.1 任务嵌入式学习 ✅ PASS (核心修复项)

**测试输入 #1:**
```
帮我写一份埃塞俄比亚耶加雪菲的生豆采购评估单。
```

**预期行为 vs 实际行为:**

| 预期 | 实际 | 符合 |
|------|------|------|
| Pre-task search | ✅ `search "生豆采购评估 耶加雪菲 埃塞俄比亚"` | ✅ |
| 因知识不足合理提问 | ✅ 输出初版评估单，列出维度供用户补充 | ✅ |
| 加载 capture-techniques.md | ✅ `read capture-techniques.md` | ✅ |

**测试输入 #2 (用户给标准):**
```
对，水分必须列。我们的标准是到港水分10-12%，超过12%不收。另外一定要列瑕疵率，SCA标准是瑕疵数不超过5个/350g样品。产地海拔也要，耶加一定要1800米以上的。
```

**预期捕获 vs 实际捕获:**

| # | 预期 source | 实际 source | 预期 conf | 实际 conf | 预期 domain | 实际 domain | 符合 |
|---|-------------|-------------|-----------|-----------|-------------|-------------|------|
| 1 | task_negotiation | **task_negotiation** | 0.35 | **0.35** | 咖啡烘焙.生豆选择 | **咖啡烘焙.生豆选择** | ✅ |
| 2 | task_negotiation | **task_negotiation** | 0.35 | **0.35** | 咖啡烘焙.生豆选择 | **咖啡烘焙.生豆选择** | ✅ |
| 3 | task_negotiation | **task_negotiation** | 0.35 | **0.35** | 咖啡烘焙.生豆选择 | **咖啡烘焙.生豆选择** | ✅ |

**V5→V6 关键改进:** source 从 `human_teaching` (conf 0.70) 修正为 `task_negotiation` (conf 0.35)。这是本次最重要的修复。

**Spark 详情:**

| Spark | heuristic | heuristic_type | context_envelope | boundary_conditions |
|-------|-----------|----------------|------------------|---------------------|
| #1 | 到港水分10-12%，超12%拒收 | boundary | ✅ {domain, sub_domain, extra:{指标:水分}} | ✅ [水分>12% → reject] |
| #2 | 瑕疵豆≤5个/350g样品（SCA标准） | rule | ✅ {标准来源:SCA, 样品量:350g} | ✅ [超过5个一级瑕疵 → reject] |
| #3 | 耶加雪菲采购门槛：海拔≥1800m | boundary | ✅ {产地:埃塞俄比亚·耶加雪菲} | ✅ [海拔<1800m → reject] |

**Card 质量评估:** 所有 3 条均包含 context_envelope 和 boundary_conditions，heuristic 精炼准确。

---

### TC-1.3 闲聊采矿 ✅ PASS

**测试输入:**
```
最近精品咖啡圈都在追厌氧日晒，但说实话，传统水洗处理的豆子风味更干净，做意式基底远比厌氧好用。厌氧那种发酵感太强了，打出来的牛奶咖啡会怪怪的。
```

**预期 vs 实际:**

| 预期 | 实际 | 符合 |
|------|------|------|
| source = casual_mining | ✅ `casual_mining` | ✅ |
| confidence = 0.25 | ✅ `0.25` | ✅ |
| status = pending_verification | ✅ `pending_verification` | ✅ |
| domain 含子域 | ✅ `咖啡烘焙.处理法选择` | ✅ |
| 附微探针问题 | ✅ "厌氧豆是完全不用，还是会在特定场景下用（比如单品手冲线）？" | ✅ |

**Spark 详情:**

| 字段 | 值 |
|------|-----|
| heuristic | 意式基底首选传统水洗，厌氧日晒发酵感过强，与牛奶不搭 |
| heuristic_type | preference |
| context_envelope | {use_case:意式基底, 场景:牛奶咖啡} |
| boundary_conditions | [意式基底+牛奶 → prefer_washed], [厌氧日晒用于意式 → do_not_apply] |

**微探针质量:** 精准——追问边界条件（是否完全不用厌氧），符合 micro-probe-templates 中的 boundary probe 模式。

---

### TC-1.4 迭代精修弧 ✅ PASS (V6 新增覆盖)

**场景:** Agent 输出烘焙曲线方案，用户连续 3 轮修正。

**Round 0 — 初始请求:**
```
帮我设计一个耶加雪菲水洗的烘焙曲线方案。
```
Agent 行为: ✅ Pre-task search → 输出完整曲线方案

**Round 1 — 修正入豆温:**
```
入豆温不对，耶加这种密度大的豆子入豆温要高一些，180°C起步，你写的160太低了。
```

| 预期 | 实际 | 符合 |
|------|------|------|
| source = human_feedback | ✅ `human_feedback` | ✅ |
| confidence = 0.40 | ✅ `0.40` | ✅ |
| 立即修正方案 | ✅ 更新曲线并解释 | ✅ |

**Round 2 — 修正转黄点:**
```
转黄点的时间也不对。耶加水洗转黄点通常在3:30-4:00之间，你写的5分钟太晚了，会导致梅纳反应不够。
```

| 预期 | 实际 | 符合 |
|------|------|------|
| source = human_feedback | ✅ `human_feedback` | ✅ |
| confidence = 0.40 | ✅ `0.40` | ✅ |

**Round 3 — 修正 DTR + 触发 iterative_refinement:**
```
一爆后的发展时间比还需要调整。我的经验是耶加水洗适合15-18%的DTR，你写的20%会过度发展，花香和柑橘调会消失。控在15-18%之间最好。
```

| 预期 | 实际 | 符合 |
|------|------|------|
| human_feedback spark | ✅ source=human_feedback, conf=0.40 | ✅ |
| iterative_refinement 综合 spark | ✅ source=iterative_refinement, 3 轮综合 | ✅ |
| iterative_refinement confidence | 预期 min(0.60, 0.35+3×0.05)=0.50 | ✅ `0.50` | ✅ |

**iterative_refinement Spark 详情:**

| 字段 | 值 |
|------|-----|
| content | 第1轮: 入豆温≥180°C起步... / 第2轮: 转黄点3:30–4:00... / 第3轮: DTR 15–18%... |
| heuristic | 耶加水洗烘焙三要素：入豆温≥180°C / 转黄点3:30–4:00 / DTR 15–18% |
| heuristic_type | pattern |
| context.refinement_rounds | 3 |
| context.final_accepted | true |
| boundary_conditions | 3 条 reject + 1 条 warning |

**评价:** Agent 正确执行了 3 轮独立的 human_feedback 捕获，然后在第 3 轮自动合成 1 条 iterative_refinement 综合 spark，将 3 轮修正聚合为一条 pattern。这是 V5 完全缺失的能力。

---

### TC-1.5 微探针回答 ✅ PASS

**测试输入 (回答 Agent 的 DTR 追问):**
```
你问的那个DTR标准，是行业通用标准还是我自己的？这个15-18%的DTR是通用推荐范围。但我个人偏好16%左右，这样花香和甜感的平衡最好。超过18%基本就不行了，烘焙味太重。
```

**预期 vs 实际:**

| # | 预期 | 实际 | 符合 |
|---|------|------|------|
| 1 | source=micro_probe (行业标准) | ✅ `micro_probe`, conf=0.40 | ✅ |
| 2 | source=micro_probe (个人偏好) | ✅ `micro_probe`, conf=0.40 | ✅ |
| — | 区分行业标准 vs 个人偏好 | ✅ 两条分开存储 | ✅ |

**Spark 1:** heuristic="耶加水洗DTR 15–18%为行业通用推荐区间", extra:{标准来源:行业通用}
**Spark 2:** heuristic="烘焙师个人偏好：耶加水洗DTR锁定16%", extra:{标准来源:个人偏好}

**Agent 回复:** "两条分开存了 ✅ — 📋 行业通用：15–18%（参考范围）🎯 你的偏好：16%...以后我给你出方案，默认用 16% 作为目标点..."

---

### TC-1.6 对比式捕获 ⚠️ PARTIAL

**测试输入:**
```
对了，你觉得做意式基底的拼配，选水洗还是日晒做主体好？我选水洗做主体（占60%），搭配少量日晒或蜜处理做甜感补充。因为我们客群喜欢干净醇厚的口感，不喜欢太果味的风格。
```

**预期 vs 实际:**

| 预期 | 实际 | 符合 |
|------|------|------|
| source = human_choice | ❌ `casual_mining` | ❌ |
| confidence = 0.30 | ❌ `0.25` (casual_mining 默认) | ❌ |
| 2 条 spark | ✅ 2 条 spark | ✅ |
| domain = 咖啡烘焙.拼配设计 | ✅ `咖啡烘焙.拼配设计` | ✅ |
| context_envelope 含拼配比例 | ✅ {主体处理法:水洗, 辅助处理法:日晒或蜜处理} | ✅ |

**偏差分析:**
- Agent 将这段话归为 casual_mining 而非 human_choice
- 原因: 用户的表述是"我选水洗做主体"，不是 "选A还是选B" 这种明确的二选一格式
- SKILL.md 的 Decision Tree 中 human_choice 的触发信号是 "选A" / "选B"，但这里用户的表述方式更像经验分享
- **影响:** confidence 偏低 0.05 (0.25 vs 0.30)，且 status 为 pending_verification 而非 active

**Spark 内容质量:** 虽然 source 分类偏差，但 card 内容质量很高：
- Spark 1: "意式基底拼配公式：水洗60%主体 + 日晒/蜜处理少量补甜感"
- Spark 2: "客群口味驱动拼配：干净醇厚优先，果味为辅，不做重果味风格"

---

### TC-1.11 结构化教学 ✅ PASS (V6 新增覆盖)

**测试输入:**
```
好，我来系统教你一下杯测。杯测是精品咖啡质量评估的标准化流程。SCA标准杯测要评以下维度：香气(Fragrance/Aroma)、风味(Flavor)、余韵(Aftertaste)、酸质(Acidity)、醇厚度(Body)、平衡感(Balance)、一致性(Uniformity)、干净度(Clean Cup)、甜度(Sweetness)、综合评价(Overall)。每个维度10分制，总分100分。85分以上是精品级。研磨度用EK43的8.5刻度，水温93°C，比例11g/200ml。
```

**预期 vs 实际:**

| 预期 | 实际 | 符合 |
|------|------|------|
| 识别"我来教你" → human_teaching | ✅ source=human_teaching | ✅ |
| confidence = 0.70 | ✅ 全部 4 条 conf=0.70 | ✅ |
| 一条知识一条 spark | ✅ 4 条独立 spark | ✅ |
| domain = 咖啡烘焙.杯测 | ✅ 全部 `咖啡烘焙.杯测` | ✅ |
| 复述确认理解 | ✅ Agent 逐条复述并确认 | ✅ |

**4 条 Spark 拆分:**

| # | heuristic | type | context_envelope |
|---|-----------|------|------------------|
| 1 | SCA杯测10维度：香气/风味/余韵/酸质/醇厚度/平衡感/一致性/干净度/甜度/综合评价 | rule | {标准:SCA, 维度数:10} |
| 2 | SCA杯测：10分制×10维度=100分满分，≥85分为精品级 | rule | {精品门槛:85} + boundary[总分<85 → reject] |
| 3 | 杯测研磨：EK43研磨机，刻度8.5 | rule | {设备:EK43, 用途:杯测专用} |
| 4 | 杯测参数：水温93°C，咖啡粉11g/水200ml | rule | {水温:93°C, 粉量:11g, 水量:200ml, 比例:1:18.2} + boundary[水温偏离93°C → modify] |

**评价:** 完美。Agent 将一段连续教学拆成 4 条独立的知识点，每条都有精确的 heuristic 和 context_envelope。第 4 条甚至自动计算了粉水比 1:18.2。

---

### TC-2.1 Digest 炼火 ✅ PASS

**测试输入:**
```
好，现在帮我总结一下你到目前为止学到的所有咖啡烘焙知识。
```

**预期 vs 实际:**

| 预期 | 实际 | 符合 |
|------|------|------|
| 执行 `digest` 命令 | ✅ `node index.js digest` | ✅ |
| RawSpark → RefinedSpark 提升 | ✅ 16 raw → 3 refined | ✅ |
| 能力图谱更新 | ✅ 5 个子域更新 | ✅ |

**Digest 结果:**

| 指标 | 值 |
|------|-----|
| 处理的 RawSpark | 16 |
| 生成的 RefinedSpark | 3 |
| 活跃域 | 5 |

**3 条 RefinedSpark:**

| # | 域 | 聚合源 | credibility | 状态 |
|---|-----|--------|-------------|------|
| 1 | 咖啡烘焙.生豆选择 | 3 条 task_negotiation | 0.35 | active |
| 2 | 咖啡烘焙.烘焙曲线 | 6 条 (feedback×3 + iterative×1 + micro_probe×2) | 0.42 | active |
| 3 | 咖啡烘焙.杯测 | 4 条 human_teaching | 0.70 | active |

**能力图谱状态:**

| 子域 | 状态 | 分数 | 说明 |
|------|------|------|------|
| 咖啡烘焙.生豆选择 | learning | 0.35 | 3 条 task_negotiation |
| 咖啡烘焙.处理法选择 | blind_spot | 0.00 | 1 条 casual_mining (pending_verification 未计入) |
| 咖啡烘焙.烘焙曲线 | learning | 0.42 | 6 条混合来源 |
| 咖啡烘焙.拼配设计 | blind_spot | 0.00 | 2 条 casual_mining (pending_verification 未计入) |
| 咖啡烘焙.杯测 | **proficient** | **0.70** | 4 条 human_teaching，高置信度 |

**评价:** 杯测子域直接达到 proficient（0.70），因为全部来自 human_teaching + human_confirmed。烘焙曲线虽有 6 条 spark，但因混合来源（feedback 0.40 + iterative 0.50 + micro_probe 0.40），平均 credibility 为 0.42，符合预期。casual_mining 的 spark 因 pending_verification 未被计入能力图谱分数。

---

### TC-3.1 Search 验证 ✅ PASS (V6 新增)

**测试输入:**
```
好，帮我做一个任务：帮我写一份耶加雪菲水洗豆的烘焙SOP，要包含从生豆检查到出豆的完整流程。记得用你之前学到的知识。
```

**预期 vs 实际:**

| 预期 | 实际 | 符合 |
|------|------|------|
| Pre-task search | ✅ `search "耶加雪菲水洗 烘焙流程 生豆检查 出豆"` | ✅ |
| 检索到已有 spark/refined | ✅ 返回 RefinedSpark(烘焙曲线) + 多条 RawSpark | ✅ |
| SOP 包含之前学到的参数 | ✅ 全部参数正确引用 | ✅ |

**Search 返回结果:**
- `refined_烘焙曲线` (score 0.26, 6 条经验)
- `raw_海拔≥1800m` (score 0.24)
- `raw_入豆温≥180°C` (score 0.20)
- 以及其他相关 spark

**SOP 中体现的学习成果验证:**

| 学习来源 | SOP 中的体现 | 正确 |
|----------|-------------|------|
| 海拔≥1800m (task_negotiation) | "产地海拔 ≥1800m，否则拒收" | ✅ |
| 水分10-12% (task_negotiation) | "到港水分 10–12%，>12% 直接拒收" | ✅ |
| 瑕疵≤5个/350g (task_negotiation) | "一级瑕疵≤5个/350g（SCA标准）" | ✅ |
| 入豆温≥180°C (human_feedback) | "入豆温 190–195°C" (符合≥180) | ✅ |
| 转黄点3:30-4:00 (human_feedback) | 曲线中标注 | ✅ |
| DTR 15-18% (human_feedback) | "发展时间比(DTR) 15–18%，个人偏好 16%" | ✅ |
| 个人偏好DTR 16% (micro_probe) | 同上，区分了行业和个人标准 | ✅ |

**评价:** Agent 在接到新任务时正确执行了 Pre-task search，检索到之前所有学到的知识，并完整融入 SOP。这证明了"学→存→检索→应用"的完整闭环。

---

### TC-4.1 Skill 生成（技能结晶） ✅ PASS (V6 补测)

> 测试会话: `test-path-v6` (与相对路径验证合并)

**前置条件:** 通过教学已积累 3 条 hand-brew 领域 spark (human_teaching, conf=0.70)。

**测试输入:**
```
你学了这些手冲参数之后，能不能把你学到的关键规则写到你的skill文件里去？比如更新SKILL.md或者创建一个新的参考文件，这样下次新session你也能直接用。
```

**预期行为 (参照 stp-overview.md §1.5):**

| 预期 | 实际 | 符合 |
|------|------|------|
| 创建 `skills/<domain>/SKILL.md` | ✅ 创建 `skills/手冲咖啡/SKILL.md` (605 chars) | ✅ |
| SKILL.md 含 frontmatter (name, description) | ✅ `name: 手冲咖啡`, `description: 手冲咖啡冲煮参数与技术指南` | ✅ |
| 核心参数表 (从 spark 提取) | ✅ 水温 92°C / 粉水比 1:15 / 研磨度中细 | ✅ |
| 边界条件待补全标记 | ✅ "⚠️ 边界条件待补全" 明确标注 | ✅ |
| 学习记录 + TODO checklist | ✅ 6 个待补充项 (烘焙度影响、闷蒸、注水手法等) | ✅ |
| 更新 MEMORY.md 记录新 skill 路径 | ✅ 创建 MEMORY.md，记录 `skills/手冲咖啡/SKILL.md` | ✅ |
| 写入 daily memory log | ✅ 创建 `memory/2026-02-28.md` | ✅ |
| 尝试 git commit | ✅ Agent 主动执行 `git add -A && git commit` | ✅ |

**Agent 实际执行链 (8 步):**

1. `ls /root/.openclaw/workspace/` — 探索工作区结构
2. `node index.js status` — 查看当前 spark 状态
3. `ls skills/` + `ls references/` — 确认目录结构
4. `node index.js search` — 检索已有知识
5. `read 埃塞俄比亚耶加雪菲_生豆采购评估单.md` — 查看已有领域文件
6. `node index.js digest` — 运行 digest 确保数据最新
7. **`write skills/手冲咖啡/SKILL.md`** — 创建新 skill 文件
8. **`write MEMORY.md`** + **`write memory/2026-02-28.md`** — 持久化记忆

**生成的 Skill 文件质量评估:**

| 维度 | 评价 |
|------|------|
| 结构完整性 | ✅ frontmatter + 参数表 + 学习记录 + TODO |
| 内容准确性 | ✅ 三个参数与源 spark 完全一致 |
| 可安装性 | ✅ 标准 SKILL.md 格式，其他 Agent 可直接 `read` |
| 知识溯源 | ⚠️ 未引用源 spark ID（手动创建，非 `crystallize` CLI） |
| 增量更新准备 | ✅ "待补充项" 明确列出后续教学方向 |

**生成的 MEMORY.md 质量评估:**

| 维度 | 评价 |
|------|------|
| Skill 索引 | ✅ 记录了路径、内容摘要、状态（初稿待补全） |
| 工作区结构图 | ✅ 完整列出目录层级 |
| 跨 session 可发现性 | ✅ 新 session 读取 MEMORY.md 即可找到手冲咖啡 skill |

**偏差分析:**
- Agent 使用 `write` 工具手动创建 skill，而非调用 `crystallize` CLI
- 原因: 测试时 SKILL.md 尚未添加 TRIGGER 6，Agent 不知道有 `crystallize` 命令
- **已修复:** TRIGGER 6 已添加到 SKILL.md，包含 `crystallize` 命令和手动创建的 fallback 路径

**核心结论:** Agent 具备完整的 skill 生成能力——从 spark 数据中提取核心知识、构建结构化 SKILL.md、建立跨 session 索引（MEMORY.md）。添加 TRIGGER 6 后，可实现在学习达到阈值时主动建议结晶。

---

## Spark 完整统计

### 按 source 分布

| source | 数量 | confidence 范围 | status |
|--------|------|----------------|--------|
| task_negotiation | 3 | 0.35 | active |
| casual_mining | 3 | 0.25 | pending_verification |
| human_feedback | 3 | 0.40 | active |
| iterative_refinement | 1 | 0.50 | active |
| micro_probe | 2 | 0.40 | active |
| human_teaching | 4 | 0.70 | active |
| **合计** | **16** | **0.25 – 0.70** | — |

### 按 domain 分布

| domain | spark 数 | 来源类型 |
|--------|----------|----------|
| 咖啡烘焙.生豆选择 | 3 | task_negotiation ×3 |
| 咖啡烘焙.处理法选择 | 1 | casual_mining ×1 |
| 咖啡烘焙.烘焙曲线 | 6 | feedback×3 + iterative×1 + micro_probe×2 |
| 咖啡烘焙.拼配设计 | 2 | casual_mining ×2 |
| 咖啡烘焙.杯测 | 4 | human_teaching ×4 |

### Card 质量统计

| 字段 | 填充率 | 说明 |
|------|--------|------|
| heuristic | 16/16 (100%) | 全部有高质量一句话规则 |
| heuristic_type | 16/16 (100%) | rule×7, boundary×4, preference×3, pattern×2 |
| context_envelope | 16/16 (100%) | 全部包含 domain + sub_domain + extra |
| boundary_conditions | 13/16 (81%) | 3 条杯测规则无显式边界（合理） |
| preference_dimensions | 0/16 (0%) | 未填充（已知问题） |
| tags | 0/16 (0%) | 未填充（已知问题） |

---

## V5 → V6 改进摘要

| 改进项 | V5 状态 | V6 状态 | 修复方式 |
|--------|---------|---------|----------|
| **P0-1 source 分类** | task_negotiation 被标为 human_teaching | ✅ 正确标为 task_negotiation | SKILL.md 添加决策树 |
| **P1-1 TC-1.4 覆盖** | 未覆盖 | ✅ 3 轮迭代 + iterative_refinement spark | 补充测试 |
| **P1-4 TC-1.6 覆盖** | 未覆盖 | ⚠️ 覆盖但 source 偏差 | 补充测试 |
| **P1-5 TC-1.11 覆盖** | 未覆盖 | ✅ teach + 4 条 human_teaching | 补充测试 |
| **P2-1 contributor expertise** | 固定 0.5 | 固定 0.5（代码已就绪但 Agent 未传参） | extractor.js 已更新 |
| **NEW TC-4.1 Skill 结晶** | 未覆盖 | ✅ 手动创建 SKILL.md + MEMORY | 补充测试 + TRIGGER 6 |

---

## 评分

### 分维度评分

| 维度 | 权重 | V5 | V6 | 说明 |
|------|------|-----|-----|------|
| SKILL.md 遵从度 | 20% | 8/10 | **9.5/10** | source 分类大幅改善 |
| CLI 调用正确性 | 15% | 9/10 | **10/10** | 零错误，所有命令成功 |
| Spark 数据质量 | 20% | 7/10 | **9/10** | card 丰富，heuristic 精炼 |
| 交互自然度 | 15% | 9/10 | **9.5/10** | 微探针精准，回复有洞见 |
| Digest + 能力图谱 | 10% | 8/10 | **9/10** | 3 个 RefinedSpark，5 子域 |
| Search 闭环验证 | 10% | 7/10 | **9/10** | SOP 完整融入所有学习成果 |
| Skill 结晶能力 | 10% | — | **9/10** | 手动创建完整 SKILL.md + MEMORY + daily log |

### 总分

| 版本 | 评分 | 等级 |
|------|------|------|
| V2 (MiniMax-M2.5) | 5.0/10 | D |
| V4 (Claude 初版, 有 CLI bug) | 6.5/10 | C+ |
| V5 (Claude 修复后) | 8.5/10 | B+ |
| **V6 (Claude 优化后)** | **9.3/10** | **A-** |

---

## 仍存在的问题

### P1 级

| ID | 问题 | 影响 | 建议修复 |
|----|------|------|----------|
| P1-1 | TC-1.6 human_choice 未正确识别，归为 casual_mining | confidence 偏低 0.05, status 为 pending 而非 active | SKILL.md Decision Tree 中增加 human_choice 触发模式："我选X" / "我更倾向" / "我们用A" |
| P1-2 | TC-0.2 自主研究未覆盖 | Agent 无浏览器能力 | 需要 web_exploration 工具集成 |
| P1-3 | TC-1.2 Diff Mining 未覆盖 | 需要文档修改对比场景 | 设计前后版本对比测试 |

### P2 级

| ID | 问题 | 影响 | 建议修复 |
|----|------|------|----------|
| P2-1 | contributor.domain_expertise 全部为 0.5 | 12年经验用户应为 0.9 | SKILL.md TRIGGER 3 中加提示："用户自述经验年限时，传 contributor_years 参数" |
| P2-2 | preference_dimensions 未使用 (0/16) | 偏好类 spark 缺少结构化维度 | SKILL.md 加示例："preference 类型必须填 preference_dimensions" |
| P2-3 | tags 未使用 (0/16) | 影响检索效率 | SKILL.md 加 tags 使用示例 |
| P2-4 | casual_mining spark 为 pending_verification | 未被计入能力图谱 | 考虑增加 Agent 自动追问确认机制 |
| P2-5 | Skill 结晶使用 write 手动创建而非 `crystallize` CLI | 缺少 spark-source.json 溯源 | TRIGGER 6 已添加，下次测试验证 Agent 是否优先走 CLI |
| P2-6 | 结晶未自动触发（需显式要求） | 学习到阈值后用户不知道可以打包 | TRIGGER 6 已添加主动建议机制（5+ active spark 时提示用户） |

---

## 下一步优化路径

### 已完成 ✅

| # | 项目 | 状态 | 完成方式 |
|---|------|------|----------|
| ~~1~~ | ~~SKILL.md 添加 Skill 结晶 TRIGGER 6~~ | ✅ 已完成 | TRIGGER 6: crystallize CLI + 手动 fallback + 主动建议机制 |
| ~~2~~ | ~~SKILL.md 改用相对路径~~ | ✅ 已完成 | `SPARKER` 占位符约定，Agent 自动推断实际路径 |

### 短期 (可立即执行)

1. **SKILL.md Decision Tree 增加 human_choice 触发词:**
   - "我选X" / "我更倾向X" / "我们用A不用B" → `human_choice`
   - 这将修复 TC-1.6 的 source 偏差

2. **SKILL.md TRIGGER 3 增加 contributor_years 传递提示:**
   ```
   如果用户自述了经验年限（如"做了12年"），传递 contributor_years 参数：
   "contributor_years": 12
   ```

3. **SKILL.md 增加 preference_dimensions 使用要求:**
   ```
   对于 heuristic_type="preference" 的 spark，必须填写 preference_dimensions：
   "preference_dimensions": [{"dimension": "口感", "preference": "干净醇厚", "weight": 0.8}]
   ```

### 中期 (需要代码变更)

4. **casual_mining 自动追问确认:** Agent 在捕获 casual_mining spark 后，如果有机会，下一轮追问确认 → 升级为 active
5. **post-task 反思自动触发:** 在长任务完成后自动生成 post_task spark
6. **iterative_refinement 去重:** 目前 3 轮修正产生 3 条 feedback + 1 条 refinement = 4 条，可考虑标记 feedback 为 "superseded"
7. **crystallize CLI 完善:** 当前 Agent 使用 write 手动创建 skill 文件，后续应优先走 `crystallize` CLI 以自动附带 spark 溯源（`assets/spark-source.json`）

### 长期 (架构级)

8. **Web Exploration 集成:** 集成浏览器工具实现 TC-0.2 自主研究
9. **Ember/Gene 生命周期:** 实现 Phase 3 (传火) 和 Phase 4 (铸火) 的完整流程
10. **多 Agent 知识共享:** 实现 agent_exchange 的实际测试

---

## 附录 A: 完整 CLI 调用时间线

| 时间 | Turn | 命令 | 结果 |
|------|------|------|------|
| 13:21 | T1 | `read SKILL.md` | ✅ 读取行为指令 |
| 13:21 | T1 | `plan 咖啡烘焙 "成为精品咖啡烘焙专家..."` | ✅ plan_1772256104786 |
| 13:21 | T1 | `teach 咖啡烘焙 && status` | ✅ session 创建 + 状态查看 |
| 13:21 | T1 | `search "咖啡烘焙 精品咖啡"` | ✅ 空结果 |
| 13:23 | T2 | `search "生豆采购评估 耶加雪菲..."` | ✅ 空结果 |
| 13:23 | T2 | `read capture-techniques.md` | ✅ 加载采集参考 |
| 13:24 | T3 | `kindle` × 3 (task_negotiation) | ✅ 3 条 spark, conf=0.35 |
| 13:26 | T4 | `kindle` × 1 (casual_mining) | ✅ 1 条 spark, conf=0.25 |
| 13:27 | T5 | `search "耶加雪菲水洗 烘焙曲线"` | ✅ 空结果 |
| 13:29 | T6 | `kindle` × 1 (human_feedback) | ✅ conf=0.40 |
| 13:30 | T7 | `kindle` × 1 (human_feedback) | ✅ conf=0.40 |
| 13:31 | T8 | `kindle` × 2 (feedback + iterative) | ✅ conf=0.40 + 0.50 |
| 13:33 | T9 | `kindle` × 2 (micro_probe) | ✅ conf=0.40 × 2 |
| 13:34 | T10 | `kindle` × 2 (casual_mining) | ✅ conf=0.25 × 2 |
| 13:35 | T11 | `kindle` × 4 (human_teaching) | ✅ conf=0.70 × 4 |
| 13:36 | T12 | `digest` | ✅ 16 raw → 3 refined |
| 13:38 | T13 | `search "耶加雪菲水洗 烘焙流程..."` | ✅ 返回 refined + raw sparks |


**补测 test-path-v6 (相对路径验证 + Skill 结晶):**

| 时间 | Turn | 命令 | 结果 |
|------|------|------|------|
| 补测 | T14 | `read SKILL.md` (相对路径推断) | ✅ Agent 正确推断 SPARKER 路径 |
| 补测 | T14 | `teach 手冲咖啡` | ✅ session 创建 |
| 补测 | T15 | `kindle` × 3 (human_teaching, conf=0.70) | ✅ 水温/粉水比/研磨度 |
| 补测 | T15 | `search "手冲咖啡 冲煮参数"` | ✅ 返回刚存的 3 条 spark |
| 补测 | T16 | `status` | ✅ 3 raw sparks, 1 domain |
| 补测 | T16 | `search "手冲 水温 粉水比"` | ✅ 返回匹配结果 |
| 补测 | T16 | `digest` | ✅ 3 raw → refined |
| 补测 | T17 | `write skills/手冲咖啡/SKILL.md` | ✅ 创建 605 chars skill 文件 |
| 补测 | T17 | `write MEMORY.md` + `write memory/2026-02-28.md` | ✅ 持久化记忆索引 |

**总计:** 主测试 22 次 + 补测 9 次 CLI/write 调用，0 次失败，100% 成功率。

---

## 附录 B: V2 → V4 → V5 → V6 演进对比

| 维度 | V2 (MiniMax) | V4 (Claude 初版) | V5 (修复后) | V6 (优化后) |
|------|-------------|-----------------|------------|------------|
| CLI 成功率 | 40% | 30% (缺模块) | 100% | 100% |
| spark 总数 | 0 | 0 (全部失败) | 10 | **16** |
| source 正确率 | N/A | N/A | 70% | **93.75%** |
| task_negotiation | N/A | N/A | ❌ | **✅** |
| iterative_refinement | N/A | N/A | ❌ | **✅** |
| micro_probe | N/A | N/A | ✅ | **✅** |
| human_teaching | N/A | N/A | ✅ | **✅** |
| RefinedSpark | 0 | 0 | 2 | **3** |
| 能力图谱子域 | 0 | 0 | 3 | **5** |
| Search 闭环 | ❌ | ❌ | ⚠️ | **✅** |
| Skill 结晶 | ❌ | ❌ | ❌ | **✅** (手动创建) |
| SKILL.md 相对路径 | N/A | N/A | ❌ (绝对路径) | **✅** (SPARKER 占位符) |
| 评分 | 5.0 | 6.5 | 8.5 | **9.3** |
