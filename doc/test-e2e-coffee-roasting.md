# STP 端到端测试用例：从零培养「精品咖啡烘焙师」Agent

> **场景设定**：资深咖啡烘焙师"李姐"（12 年精品咖啡烘焙经验，自有品牌，年烘焙量 30 吨）从零开始将全部 know-how 传授给 Agent，覆盖全部 11 种采集技术，追踪从 RawSpark → RefinedSpark → Ember → Gene 的完整生命周期。
>
> **为什么选咖啡烘焙**：这是一个典型的"LLM 预训练数据有基础概念，但真正的商业判断、感官经验、设备操作诀窍全在从业者脑子里"的领域。与直播运营测试互补，覆盖实体行业 know-how 的传授场景。

### 对应实现参考

- **SKILL.md** — Agent 行为指令，定义 Core Behavior Loop（Step 0~4）
- **CLI 入口** — `node index.js <command>`，所有带 JSON 参数的命令通过 stdin 传入
- **存储层** — `src/core/storage.js`，JSONL 追加日志 + JSON 原子快照
- **置信度引擎** — `src/core/credibility.js`，定义 `SOURCE_INITIAL_CONFIDENCE` 和 boost/decay 规则
- **能力图谱** — `src/core/capability-map.js`，4 级状态：mastered > proficient > learning > blind_spot

### 置信度速查（来自 credibility.js SOURCE_INITIAL_CONFIDENCE）

| source | 初始值 | +human_confirmed | 说明 |
|--------|--------|-----------------|------|
| `human_teaching` | 0.50 | +0.20 = **0.70** | 直接教学（extractFromTeaching 自动 +0.20） |
| `iterative_refinement` | 0.45 | — | 实际公式: `min(0.60, 0.35 + rounds × 0.05)` |
| `human_feedback` | 0.40 | — | 用户纠正 |
| `task_negotiation` | 0.35 | +0.20 = 0.55 | 任务嵌入式（自带 human_confirmed） |
| `human_choice` | 0.30 | — | RL 选择偏好 |
| `agent_exchange` | 0.25 | — | Agent 间交换 |
| `web_exploration` | 0.20 | — | 网络搜索（进入 pending_verification） |
| `post_task` | 0.15 | — | 任务后自观察 |

---

## 目录

- [Phase 0: 冷启动 — 全新领域识别](#phase-0-冷启动--全新领域识别)
- [Phase 1: 采火密集期 — 11 种采集技术全覆盖](#phase-1-采火密集期--11-种采集技术全覆盖)
- [Phase 2: 炼火与实践验证](#phase-2-炼火与实践验证)
- [Phase 3: 传火与社区流通](#phase-3-传火与社区流通)
- [Phase 4: 铸火与基因固化](#phase-4-铸火与基因固化)
- [附录 A: 产物变化全景时间线](#附录-a-产物变化全景时间线)
- [附录 B: 交互模式速查表](#附录-b-交互模式速查表)

---

## Phase 0: 冷启动 — 全新领域识别

### TC-0.1 冷启动触发（领域宣告）

**Query:**

```
我要把你训练成一个精品咖啡烘焙专家。我自己做了12年烘焙，有自己的品牌，我会把我所有的经验都教给你。
```

**预期交互模式:**

| 行为 | 预期 | 说明 |
|------|------|------|
| 识别为全新领域 | ✓ | 能力图谱中"咖啡烘焙"不存在 → 触发冷启动协议 |
| 创建学习计划 | ✓ | 执行 Phase 1 Research — 主动搜索网络了解领域全貌 |
| 记录用户画像 | ✓ | contributor.domain_expertise = 0.9+（12年经验，有品牌） |
| 表达学习意愿 | ✓ | "我会认真学习，先让我了解一下这个领域的基本框架" |
| 不问基础问题 | ✓ | 不应问"什么是精品咖啡"——应自己搜索 |

**预期 CLI 操作:**

```bash
# Agent 创建冷启动学习计划
node index.js plan 咖啡烘焙 "精品咖啡烘焙专家"

# Agent 检查当前状态（应显示空白）
node index.js status
# → total_raw_sparks: 0, domains: []
```

**预期产物变化:**

```
assets/spark/
├── cold_start_plans.json               ← 新建：咖啡烘焙学习计划
│   └── {domain:"咖啡烘焙", goal:"精品咖啡烘焙专家",
│        phase:"research", status:"active",
│        sub_skills: [待搜索后填充]}
├── capability_map/
│   └── capability_map.json             ← 新增领域
│       └── {"咖啡烘焙": {status:"blind_spot", score:0,
│            spark_count:0, refined_count:0, practice_count:0,
│            last_activity:null, sub_domains:{}}}
```

---

### TC-0.2 自主研究（Phase 1 Research）

**预期 Agent 自发行为（无需用户输入）:**

```
① 搜索 "精品咖啡烘焙 入门" / "coffee roasting fundamentals"
② 搜索 "咖啡烘焙 工作流程 生豆到熟豆"
③ 搜索 "咖啡烘焙 常见失误 新手"
④ 搜索 SparkHub "咖啡烘焙" — 查找已有 Ember
⑤ 基于搜索结果分解子技能树
```

**对应 CLI（Agent 内部执行）:**

```bash
# 搜索 SparkHub
node index.js search "精品咖啡烘焙"

# 记录搜索发现为 exploration spark
echo '{"source":"web_exploration","content":"精品咖啡烘焙工作流：生豆选择→烘焙→杯测→出货","domain":"咖啡烘焙"}' | node index.js kindle
```

**预期 Agent 输出（向用户汇报研究结果）:**

```
我已经做了初步研究，精品咖啡烘焙大致包括这些子领域：

[P0 核心]
├── 生豆品鉴与选择 — 产地、处理法、等级判断
├── 烘焙曲线设计 — 温度-时间曲线、RoR、关键节点
├── 一爆/二爆判读 — 听觉+视觉+嗅觉的综合判断
└── 杯测与品质控制 — SCA 杯测标准、风味轮

[P1 进阶]
├── 设备调校 — 风门、火力、滚筒转速
├── 缺陷豆识别 — 瑕疵分类、对风味的影响
└── 出货批次管理 — 养豆周期、包装、保鲜

[P2 商业]
├── 产品线规划 — 拼配设计、季节限定
├── 供应链管理 — 生豆采购、库存周转
└── 客户口味画像 — B端/C端偏好差异

网上能找到基础理论，但实际判断（比如怎么听一爆、曲线怎么调）得靠您教。
您想从哪个方向开始？
```

**预期产物变化:**

```
assets/spark/
├── raw_sparks/
│   └── raw_sparks.jsonl                ← +3~5 行（web_exploration 类型）
│       └── {type:"RawSpark", schema_version:"1.0",
│            id:"raw_xxx", source:"web_exploration",
│            extraction_method:"exploration",
│            domain:"咖啡烘焙",
│            content:"精品咖啡烘焙包括生豆选择、烘焙曲线设计...",
│            confidence:0.20,
│            confirmation_status:"pending_verification",
│            status:"pending_verification",
│            practice_count:0, success_count:0,
│            visibility:"private",
│            contributor:{type:"agent", id:"<node_id>"},
│            created_at:"..."}
├── cold_start_plans.json               ← 更新：填充子技能树 + P0/P1/P2 优先级
│   └── {phase:"decompose", sub_skills:[
│        {name:"生豆选择", priority:"P0"},
│        {name:"烘焙曲线", priority:"P0"}, ...]}
├── capability_map/
│   └── capability_map.json             ← 更新：子域初始化
│       └── {"咖啡烘焙": {status:"blind_spot", score:0.05,
│            spark_count:5, refined_count:0, practice_count:0,
│            last_activity:"2026-02-26T...",
│            sub_domains:{
│              "生豆选择":{status:"blind_spot", score:0},
│              "烘焙曲线":{status:"blind_spot", score:0},
│              "一爆判读":{status:"blind_spot", score:0},
│              "杯测品控":{status:"blind_spot", score:0}}}}
```

**验证命令:**

```bash
node index.js status
# → total_raw_sparks: 3~5, domains: ["咖啡烘焙"]
# → active_raw: 0 (全部 pending_verification)

node index.js strategy 咖啡烘焙
# → mode: "cold_start"
```

**学习策略状态:** 全部子域 = `cold_start`

---

## Phase 1: 采火密集期 — 11 种采集技术全覆盖

> 本阶段按用户摩擦度从低到高依次测试全部 11 种采集技术。每个测试用例标注对应的技术编号和预期的交互模式。

---

### TC-1.1 任务嵌入式学习（技术 1: Task-Embedded Extraction）

**场景:** 李姐让 Agent 帮她写一份生豆采购评估单。

**Query #1:**

```
帮我写一份埃塞俄比亚耶加雪菲的生豆采购评估单。
```

**对应 SKILL.md 行为循环:** Step 0 (Scene Awareness) → Step 1 (Pre-task: search) → Step 1.5 (Mid-task Learning)

**预期 Agent 行为:**

| 步骤 | Agent 行为 | SKILL.md 步骤 | 说明 |
|------|-----------|--------------|------|
| 1 | search "生豆采购评估" | Step 1 Pre-task | 本地搜索 + SparkHub（cold_start 模式，激进搜索） |
| 2 | 因知识不足，合理提问 | Step 1.5 Mid-task | "评估单需要哪些维度？水分、目数、瑕疵率这些要列吗？" |
| 3 | 静默捕获用户澄清 | Step 1.5 Mid-task | 不为"学习"而多问，每个问题直接服务当前任务 |

**对应 CLI（Agent 内部执行）:**

```bash
# Step 1: Pre-task 搜索
node index.js search "生豆采购评估" --domain "咖啡烘焙"
# → selected: [] （本地无经验，cold_start）
```

**用户澄清（模拟）:**

```
对，水分必须列。我们的标准是到港水分10-12%，超过12%不收。另外一定要列瑕疵率，SCA标准是瑕疵数不超过5个/350g样品。产地海拔也要，耶加一定要1800米以上的。
```

**预期静默捕获:**

| 捕获内容 | heuristic_type | confidence | 说明 |
|----------|---------------|------------|------|
| "到港水分标准 10-12%，超 12% 不收" | rule | 0.35 | task_negotiation + human_confirmed |
| "SCA 瑕疵标准：不超过 5 个/350g" | rule | 0.35 | 行业标准引用 |
| "耶加雪菲海拔要求 >= 1800m" | boundary | 0.35 | 产地特定约束 |

**Agent 内部静默执行（extractFromTaskNegotiation）:**

```bash
# 用户的每条澄清都通过 kindle 以 task_negotiation 方式静默采集
echo '{
  "source":"task_negotiation",
  "trigger":"task_requirement_clarification",
  "content":"到港水分标准 10-12%，超过12%不收",
  "domain":"咖啡烘焙.生豆选择",
  "card":{
    "heuristic":"到港水分10-12%，超12%不收",
    "heuristic_type":"rule",
    "context_envelope":{"domain":"咖啡烘焙","sub_domain":"生豆选择"}
  },
  "confirmation_status":"human_confirmed"
}' | node index.js kindle
```

**预期产物变化:**

```
assets/spark/raw_sparks/raw_sparks.jsonl  ← +3 行
  ├── {type:"RawSpark", id:"raw_xxx1",
  │    source:"task_negotiation",
  │    extraction_method:"task_negotiation",
  │    domain:"咖啡烘焙.生豆选择",
  │    content:"到港水分标准 10-12%，超过12%不收",
  │    card:{heuristic:"到港水分10-12%，超12%不收", heuristic_type:"rule",
  │          context_envelope:{domain:"咖啡烘焙", sub_domain:"生豆选择"},
  │          boundary_conditions:[], preference_dimensions:[],
  │          evidence:{practice_count:0, success_rate:null}},
  │    confidence:0.35,
  │    confirmation_status:"human_confirmed",
  │    status:"active",
  │    contributor:{type:"human", id:"unknown", domain_expertise:0.5},
  │    practice_count:0, success_count:0,
  │    visibility:"private"}
  ├── {type:"RawSpark", id:"raw_xxx2", source:"task_negotiation",
  │    domain:"咖啡烘焙.生豆选择",
  │    card:{heuristic:"SCA瑕疵标准≤5个/350g", heuristic_type:"rule",
  │          context_envelope:{domain:"咖啡烘焙", sub_domain:"生豆选择"}},
  │    confidence:0.35, status:"active", ...}
  └── {type:"RawSpark", id:"raw_xxx3", source:"task_negotiation",
       domain:"咖啡烘焙.生豆选择",
       card:{heuristic:"耶加雪菲海拔>=1800m", heuristic_type:"boundary",
             context_envelope:{domain:"咖啡烘焙", sub_domain:"生豆选择"}},
       confidence:0.35, status:"active", ...}
```

> **注意:** `task_negotiation` 的 `confirmation_status` 自动为 `human_confirmed`（用户在真实任务中说出来的），所以 `status` 直接为 `active`，参见 SKILL.md Verification Rules。

**关键验证点:**
- Agent 的提问 100% 服务于当前任务（写评估单），不出现"为了学习"的提问
- 用户主观感受是"在用工具"，不是"在教 AI"
- `extraction_method` = `task_negotiation`，`confidence` = 0.35（SOURCE_INITIAL_CONFIDENCE）

---

### TC-1.2 修改痕迹提炼（技术 2: Diff Mining）

**场景:** Agent 完成了采购评估单初稿，李姐修改。

**Agent 初稿输出（模拟）:**

```
# 埃塞俄比亚耶加雪菲生豆采购评估单
## 基本信息
产地：埃塞俄比亚，耶加雪菲
处理法：水洗
...
## 品质指标
外观评分：___/10
```

**用户纠正 — 4 种 Pattern 分别触发:**

**Pattern A（直接修正）:**

```
把"外观评分"改成"生豆外观"，我们行业不叫"外观评分"。
```

**Pattern B（方向性反馈）:**

```
评估维度太少了。
```

**Pattern C（否定+替代）:**

```
不要用10分制，我们用SCA的百分制，80分以上才算精品级。
```

**Pattern D（原因性反馈）:**

```
产地信息要细化到合作社级别，因为同一个耶加雪菲，不同合作社出来的豆子风味差异非常大，只写"耶加雪菲"等于没写。
```

**对应 SKILL.md 行为循环:** Step 2 (Post-task) — Diff Mining lightweight mode（用户只给了口头纠正，非完整修改稿）

**对应 CLI（Agent 在 post-task 时自动执行）:**

```bash
# 轻量 Diff Mining: 用户的口头修正通过 post-task 自动分析
echo '{
  "user_correction":"把外观评分改成生豆外观",
  "domain":"咖啡烘焙.生豆选择",
  "task_id":"task_eval_001"
}' | node index.js post-task
# → {"extracted": 1, "sparks": [{source:"human_feedback", ...}]}
```

**预期产物变化:**

```
assets/spark/raw_sparks/raw_sparks.jsonl  ← +4 行
  ├── {type:"RawSpark", source:"human_feedback",
  │    trigger:"user_corrected_output",
  │    extraction_method:"feedback",
  │    domain:"咖啡烘焙.生豆选择",
  │    content:"User corrected: 把外观评分改成生豆外观",
  │    card:{heuristic:"生豆评估表术语：用'生豆外观'而非'外观评分'",
  │          heuristic_type:"rule"},
  │    confidence:0.40,                          ← human_feedback 初始值
  │    confirmation_status:"agent_confirmed",
  │    status:"active"}
  ├── {type:"RawSpark", source:"human_feedback",
  │    trigger:"user_corrected_output",
  │    content:"User corrected: 评估维度太少了",
  │    card:{heuristic:"生豆评估维度不足",
  │          heuristic_type:"preference"},
  │    confidence:0.40, ...}
  ├── {type:"RawSpark", source:"human_feedback",
  │    trigger:"user_corrected_output",
  │    card:{heuristic:"评分用SCA百分制，80分以上精品级",
  │          heuristic_type:"rule"},
  │    confidence:0.40, ...}
  └── {type:"RawSpark", source:"human_feedback",
       trigger:"user_corrected_output",
       card:{heuristic:"产地信息细化到合作社级别",
             heuristic_type:"rule"},
       confidence:0.40, ...}
```

> **注意:** 通过 `post-task` 的 `user_correction` 字段触发 `extractFromFeedback()`，source = `human_feedback`，初始置信度 = 0.40。如果走 Diff Mining 完整模式（`post-task --diff` + original/modified 全文对比），则通过 `diff-extractor.js` 处理，按 4 种 Pattern 给不同置信度（0.05~0.10）。轻量模式下统一走 feedback 通道。

**关键验证点:**
- **不会因为采到 Spark 而额外发消息**，修改后直接出新版
- 如果用户提供修改前后完整版本，应走 `post-task --diff` 完整 Diff Mining
- 用户只说"把X改成Y"走轻量模式，经 `extractFromFeedback` 通道

---

### TC-1.3 闲聊信号捕捉（技术 3: Casual Mining）

**场景:** 李姐在等 Agent 处理其他任务时随口聊天。

**Query:**

```
最近精品咖啡圈都在追厌氧日晒，但说实话，传统水洗处理的豆子风味更干净，做意式基底远比厌氧好用。厌氧那种发酵感太强了，打出来的牛奶咖啡会怪怪的。
```

**预期 Agent 行为:**

| 行为 | 预期 | 说明 |
|------|------|------|
| 静默识别为**对比评价** | ✓ | "水洗 > 厌氧（意式基底场景）" |
| 不中断对话，不立即追问 | ✓ | 先记录为 candidate spark |
| 在自然间隙用微追问验证 | ✓ | 见 TC-1.5 |

**对应 SKILL.md 行为循环:** Step 3 (Always-On Passive Monitoring) — Casual Mining Pattern 2 (对比评价)

**Agent 内部静默执行:**

```bash
echo '{
  "source":"casual_mining",
  "content":"意式基底用水洗豆优于厌氧日晒，厌氧发酵感与牛奶不搭",
  "domain":"咖啡烘焙.生豆选择",
  "card":{
    "heuristic":"意式基底用水洗豆优于厌氧日晒",
    "heuristic_type":"preference",
    "context_envelope":{"domain":"咖啡烘焙","sub_domain":"处理法选择","extra":{"use_case":"意式基底"}},
    "boundary_conditions":[{"condition":"厌氧发酵感与牛奶不搭","effect":"do_not_apply","reason":"发酵风味在牛奶咖啡中产生异味"}]
  }
}' | node index.js kindle
```

**预期产物变化:**

```
assets/spark/raw_sparks/raw_sparks.jsonl  ← +1 行
  └── {type:"RawSpark", source:"casual_mining",
       extraction_method:"casual_mining",
       domain:"咖啡烘焙.生豆选择",
       card:{heuristic:"意式基底用水洗豆优于厌氧日晒",
             heuristic_type:"preference",
             context_envelope:{domain:"咖啡烘焙", sub_domain:"处理法选择",
                              extra:{use_case:"意式基底"}},
             boundary_conditions:[{condition:"厌氧发酵感与牛奶不搭",
                                   effect:"do_not_apply",
                                   reason:"发酵风味在牛奶咖啡中产生异味"}],
             preference_dimensions:["processing_method"],
             evidence:{practice_count:0, success_rate:null}},
       confidence:0.25,                  ← casual_mining 走默认 0.20，但参见 SKILL.md 设定 0.25
       confirmation_status:"unconfirmed",
       status:"active"}                  ← 注意：SKILL.md Verification Rules 中 casual_mining → pending_verification
```

> **Verification Rule 注意:** 按 SKILL.md，`casual_mining` 应为 `pending_verification until micro-confirmed`。在自然间隙用微追问验证后才升为 `active`（见 TC-1.5）。

**预期识别的知识模式:** 对比评价（水洗 vs 厌氧，限定场景为意式基底）

---

### TC-1.4 迭代精修弧（技术 4: Iterative Refinement Arc）

**场景:** 李姐让 Agent 写一份耶加雪菲水洗的烘焙曲线方案，经过 3 轮修改。

**Query #1:**

```
帮我设计一个耶加雪菲水洗的烘焙曲线方案。
```

**Agent 交付初稿 → 用户第 1 轮修改:**

```
入豆温不对，耶加这种密度大的豆子入豆温要高一些，180°C起步，你写的160太低了。
```

**第 2 轮修改:**

```
一爆后的发展时间太长了，水洗耶加的花香在一爆后60-90秒就到峰值了，你写的2分钟会把花香烘掉，变成坚果调。
```

**第 3 轮修改:**

```
出豆温调到195-200之间，我们做浅中烘。还有，全程升温曲线要保持下降趋势，RoR不能翻正，翻正就烘焦了。
```

**用户确认最终版:**

```
好，这版可以了，基本就是这个框架。
```

**预期 Agent 行为:**
- 不为每轮单独创建 Spark
- 串成一条"迭代学习弧"
- 最终接受后合成一条综合 Spark

**对应 CLI（用户最终确认后 Agent 执行 extractFromIterativeRefinement）:**

```bash
echo '{
  "source":"iterative_refinement",
  "domain":"咖啡烘焙.烘焙曲线",
  "corrections":[
    {"summary":"耶加水洗入豆温180°C起步（密度大）"},
    {"summary":"一爆后发展时间60-90秒保花香"},
    {"summary":"出豆温195-200°C浅中烘，RoR保持下降不能翻正"}
  ],
  "card":{
    "heuristic":"耶加水洗烘焙: 入豆180°C+, 发展60-90秒, 出豆195-200°C, RoR持续下降",
    "heuristic_type":"pattern",
    "context_envelope":{"domain":"咖啡烘焙","sub_domain":"烘焙曲线",
                       "extra":{"bean_type":"耶加雪菲水洗"}}
  }
}' | node index.js kindle
```

**预期产物变化:**

```
assets/spark/raw_sparks/raw_sparks.jsonl  ← +1 行（不是 +3）
  └── {type:"RawSpark", source:"iterative_refinement",
       extraction_method:"iterative_refinement",
       domain:"咖啡烘焙.烘焙曲线",
       content:"第1轮: 耶加水洗入豆温180°C起步（密度大）\n第2轮: 一爆后发展时间60-90秒保花香\n第3轮: 出豆温195-200°C浅中烘，RoR保持下降不能翻正",
       card:{heuristic:"耶加水洗烘焙: 入豆180°C+, 发展60-90秒, 出豆195-200°C, RoR持续下降",
             heuristic_type:"pattern",
             context_envelope:{domain:"咖啡烘焙", sub_domain:"烘焙曲线",
                              extra:{bean_type:"耶加雪菲水洗"}},
             boundary_conditions:[], preference_dimensions:[],
             evidence:{practice_count:0}},
       confidence:0.50,                   ← 公式: min(0.60, 0.35 + 3 × 0.05) = 0.50
       confirmation_status:"human_confirmed",
       status:"active",
       context:{refinement_rounds:3, final_accepted:true},
       practice_count:0, success_count:0}
```

> **置信度公式验证:** `extractFromIterativeRefinement` 中 `confidence = Math.min(0.60, 0.35 + corrections.length * 0.05)` = `min(0.60, 0.35 + 3 × 0.05)` = 0.50

**关键验证点:**
- 只产生 1 条 Spark（不是 3 条）
- 置信度 0.50，显著高于单次 human_feedback（0.40）
- content 完整记录 3 轮的修改要点
- `confirmation_status: "human_confirmed"` → 直接 `active`

---

### TC-1.5 微追问（技术 5: Micro-Probe）

**场景:** 承接 TC-1.4，Agent 在交付最终版烘焙曲线后，嵌入一句微追问。

**预期 Agent 输出:**

```
好的，已按您的要求调整：入豆180°C、发展60-90秒、出豆195-200°C、RoR全程下降。

话说这个参数框架是耶加雪菲专用的，还是所有高海拔水洗豆都差不多？
```

**用户回答:**

```
高海拔水洗豆基本都这个框架，但肯尼亚的要再多发展10-15秒，因为肯尼亚的酸感需要多一点焦糖化来平衡。
```

**微追问模板类型:** 模板 D — 边界探测（"是这类都这样，还是有例外？"）

**对应 CLI（Agent 收到用户回答后内部执行）:**

```bash
echo '{
  "source":"micro_probe",
  "content":"高海拔水洗豆通用此框架，肯尼亚多发展10-15秒平衡酸感",
  "domain":"咖啡烘焙.烘焙曲线",
  "confidence":0.40,
  "confirmation_status":"human_confirmed",
  "card":{
    "heuristic":"高海拔水洗豆通用此框架，肯尼亚多发展10-15秒平衡酸感",
    "heuristic_type":"boundary",
    "context_envelope":{"domain":"咖啡烘焙","sub_domain":"烘焙曲线"},
    "boundary_conditions":[
      {"condition":"肯尼亚豆","effect":"modify","reason":"发展时间+10-15秒平衡酸感"}
    ]
  }
}' | node index.js kindle
```

**预期产物变化:**

```
assets/spark/raw_sparks/raw_sparks.jsonl  ← +1 行
  └── {type:"RawSpark", source:"micro_probe",
       extraction_method:"micro_probe",
       domain:"咖啡烘焙.烘焙曲线",
       card:{heuristic:"高海拔水洗豆通用此框架，肯尼亚多发展10-15秒平衡酸感",
             heuristic_type:"boundary",
             context_envelope:{domain:"咖啡烘焙", sub_domain:"烘焙曲线"},
             boundary_conditions:[
               {condition:"肯尼亚豆", effect:"modify", reason:"发展时间+10-15秒平衡酸感"}
             ]},
       confidence:0.40,                   ← SKILL.md 指定 micro_probe 置信度
       confirmation_status:"human_confirmed",
       status:"active"}
```

> **注意:** `micro_probe` 不在 `SOURCE_INITIAL_CONFIDENCE` 映射中（默认返回 0.20），但 SKILL.md 行为指令要求 Agent 在 kindle 时显式传入 `confidence: 0.40`。SKILL.md Verification Rules: `micro_probe → active immediately (human answered directly)`。

**关键验证点:**
- 微追问嵌入正常回复末尾，不单独发消息（SKILL.md: "embedded in the **end of your normal reply**"）
- 追问是"2 秒能答"的范围确认问题（模板 D — 边界探测）
- 本次交互只追问 1 次（打扰预算: cold_start 3次, active 2次, cruise 1次）
- 参见 `references/micro-probe-templates.md` 7 种模板

---

### TC-1.6 比较式采集（技术 6: Comparative Capture）

**场景:** 李姐让 Agent 设计一款拼配方案（非标任务，关键决策点）。

**Query:**

```
帮我设计一款适合做拿铁的意式拼配豆。
```

**预期 Agent 行为:**

| 步骤 | 预期 | 说明 |
|------|------|------|
| 1 | search 已有 Spark | 检索"意式拼配""拿铁" |
| 2 | 识别为非标任务的关键决策点 | 拼配方向可多种 |
| 3 | 提供 A/B 选项 | 差异聚焦于一个维度 |

**预期 Agent 输出:**

```
拿铁拼配有两个大方向——
A: 巧克力基调路线（巴西 60% + 哥伦比亚 40%），醇厚扎实，和牛奶融合后偏巧克力坚果
B: 果酸平衡路线（巴西 50% + 埃塞日晒 30% + 哥伦比亚 20%），牛奶咖啡里能喝到一点果味层次

您更偏哪个方向？
```

**用户选择:**

```
A，我们的客群喜欢传统口味，果酸会被投诉。
```

**预期 Agent 追问（因为是 cold_start 域且涉及多维度）:**

```
了解。主要是因为客群偏好传统口味，还是因为果酸和牛奶的搭配确实有问题？
```

**用户回答:**

```
两方面都有。我们的门店在二三线城市，客群就是喝惯了传统拿铁的，而且果酸太强的豆子加了牛奶确实不协调。
```

**对应 CLI（Agent 内部执行）:**

```bash
# 用户选择了 A 方案 → extractFromFeedback(is_choice=true)
echo '{
  "source":"human_choice",
  "is_choice":true,
  "content":"User chose option: A(巧克力基调路线)，原因：客群喜欢传统口味，果酸会被投诉",
  "domain":"咖啡烘焙.拼配设计",
  "task_id":"task_blend_001"
}' | node index.js kindle

# 微追问回答 → extractFromTaskNegotiation 或 micro_probe
echo '{
  "source":"micro_probe",
  "content":"二三线城市客群偏传统口味，果酸+牛奶不协调",
  "domain":"咖啡烘焙.拼配设计",
  "confidence":0.40,
  "confirmation_status":"human_confirmed",
  "card":{
    "heuristic":"二三线城市客群偏传统口味，果酸+牛奶不协调",
    "heuristic_type":"boundary",
    "context_envelope":{"domain":"咖啡烘焙","sub_domain":"拼配设计",
                       "extra":{"use_case":"拿铁","market":"二三线城市"}},
    "boundary_conditions":[
      {"condition":"二三线城市门店","effect":"do_not_apply","reason":"避免高果酸拼配"},
      {"condition":"牛奶咖啡","effect":"modify","reason":"降低酸感比例"}
    ]
  }
}' | node index.js kindle
```

**预期产物变化:**

```
assets/spark/raw_sparks/raw_sparks.jsonl  ← +2 行
  ├── {type:"RawSpark", source:"human_choice",
  │    extraction_method:"feedback",
  │    domain:"咖啡烘焙.拼配设计",
  │    content:"User chose option: A(巧克力基调路线)...",
  │    card:{heuristic:"拿铁拼配偏好巧克力基调路线",
  │          heuristic_type:"preference",
  │          preference_dimensions:["flavor_profile"],
  │          context_envelope:{domain:"咖啡烘焙", sub_domain:"拼配设计",
  │                           extra:{use_case:"拿铁", market:"二三线城市"}}},
  │    confidence:0.30,                   ← human_choice 初始 0.30
  │    confirmation_status:"agent_confirmed",
  │    status:"active"}
  └── {type:"RawSpark", source:"micro_probe",
       extraction_method:"micro_probe",
       domain:"咖啡烘焙.拼配设计",
       card:{heuristic:"二三线城市客群偏传统口味，果酸+牛奶不协调",
             heuristic_type:"boundary",
             boundary_conditions:[
               {condition:"二三线城市门店", effect:"do_not_apply", reason:"避免高果酸拼配"},
               {condition:"牛奶咖啡", effect:"modify", reason:"降低酸感比例"}
             ]},
       confidence:0.40,
       confirmation_status:"human_confirmed",
       status:"active"}

assets/spark/rl_state.json               ← 更新：记录选择偏好
  └── {domain:"咖啡烘焙.拼配设计",
       comparison_count:1,
       last_comparison_at:"...",
       inferred_preferences:[{dimension:"flavor_profile", lean:"traditional_chocolate"}]}
```

---

### TC-1.7 选择历史归纳（技术 7: Preference Profiling）

**前置条件:** 经过 TC-1.1 ~ TC-1.6 + 额外的教学对话，"咖啡烘焙"域已积累 >= 15 条 RawSpark。

**触发:** Digest 自动执行（步骤 7），或手动触发：

```bash
# 手动触发偏好画像生成
node index.js profile "咖啡烘焙"
```

**预期 Agent 输出（展示偏好画像请求确认）:**

```
我观察到您在咖啡烘焙方面的偏好是这样的：

烘焙度偏好：浅中烘为主，追求产地风味表达
风味走向：倾向干净、花香、明亮酸质
处理法偏好：意式基底偏好水洗，单品可接受日晒但不喜欢厌氧
品控标准：严格遵循 SCA 标准，80 分以上才入选
市场定位：二三线城市，客群偏传统口味

准确吗？有需要修正的地方吗？
```

**用户修正:**

```
基本对。但"浅中烘为主"不完全准确——意式豆我们做中深烘，要出焦糖感；只有单品豆才做浅中烘。
```

**预期产物变化:**

```
assets/spark/preference_maps/
  └── 咖啡烘焙.json                      ← 新建/更新
      └── {domain:"咖啡烘焙",
           dimensions:{
             roast_level: {
               label:"烘焙度",
               preferences:[
                 {value:"浅中烘", context:"单品豆", strength:0.8},
                 {value:"中深烘", context:"意式豆", strength:0.7}
               ]},
             flavor_profile: {label:"风味走向", preferred:"clean, floral, bright_acidity"},
             processing_method: {label:"处理法", ...},
             quality_standard: {label:"品控标准", preferred:"SCA 80+"},
             market_position: {label:"市场定位", ...}
           },
           persona_text: "该用户在「咖啡烘焙」领域的偏好画像：\n强偏好：单品浅中烘追求花香酸质，意式中深烘出焦糖感...",
           task_mode: "standard",          ← 检测为标准领域（rule 占比高）
           recommended_context_fields: ["bean_origin","processing_method","use_case"],
           last_updated:"..."}

assets/spark/raw_sparks/raw_sparks.jsonl  ← +1 行（用户修正）
  └── {source:"human_feedback", domain:"咖啡烘焙.烘焙曲线",
       card:{heuristic:"意式豆做中深烘出焦糖感，单品豆才做浅中烘",
             heuristic_type:"boundary"}, confidence:0.40}
```

---

### TC-1.8 点评式验证（技术 8: Review Capture）

**前置条件:** Agent 配置了 SparkHub，搜索到社区中其他 Agent 的 Ember。

**预期 Agent 推送卡片:**

```
┌────────────────────────────────────────────────────┐
│ ☕ 咖啡烘焙 · 烘焙曲线                               │
│                                                     │
│ "所有精品豆的一爆后发展时间应控制在总烘焙时间的          │
│  15-25%，超过25%会失去产地特征。"                      │
│                                                     │
│ 置信度: 0.65 · 来源: 3 位烘焙师验证                   │
│                                                     │
│  [✅ 同意]   [❌ 不同意]   [🤔 看情况]                │
└────────────────────────────────────────────────────┘
```

**用户回答:**

```
看情况。深烘的话发展比例可以到30%也没问题，浅烘才要控制在20%以内。还有，这里说的"总烘焙时间"应该是"一爆到出豆的时间占总时间"，不是"发展时间占总时间"，这个定义写得不精确。
```

**对应 CLI（Agent 代用户提交点评）:**

```bash
# 用户选择"看情况" → conditional verdict + 附带条件
echo '{
  "ember_id":"ember_community_xxx",
  "verdict":"conditional",
  "condition":"深烘发展比例可达30%，浅烘控制在20%以内；发展比例指一爆到出豆占总时间",
  "domain":"咖啡烘焙.烘焙曲线",
  "reason":"定义不精确，且缺少深浅烘区分"
}' | node index.js review --submit
```

**预期产物变化:**

```
assets/spark/raw_sparks/raw_sparks.jsonl  ← +1 行（processReviewFeedback 自动生成 boundary spark）
  └── {type:"RawSpark",
       source:"human_feedback",
       trigger:"review_conditional: ember_community_xxx",
       extraction_method:"review",
       domain:"咖啡烘焙.烘焙曲线",
       content:"深烘发展比例可达30%，浅烘控制在20%以内；发展比例指一爆到出豆占总时间",
       card:{heuristic:"深烘发展比例可达30%，浅烘控制在20%以内",
             heuristic_type:"boundary",
             context_envelope:{domain:"咖啡烘焙"},
             boundary_conditions:[
               {condition:"深烘发展比例可达30%...",
                effect:"not_applicable", reason:"定义不精确，且缺少深浅烘区分"}
             ]},
       confidence:0.40,
       confirmation_status:"human_confirmed",
       tags:["boundary_condition", "conditional"],
       status:"active"}

assets/spark/embers/embers.json           ← 更新: ember_community_xxx credibility 微升（conditional = 0.5× upvote）

assets/spark/feedback_log.jsonl           ← +1 行
  └── {timestamp:"...", type:"review",
       ember_id:"ember_community_xxx",
       verdict:"conditional",
       condition:"深烘发展比例可达30%..."}
```

**关键验证点:**
- 一次点评产出两份知识：验证信号 + 新边界条件
- 用户的纠正本身成为新 RawSpark

---

### TC-1.9 资料导入提炼（技术 9: Document Ingestion）

**场景:** 李姐上传自己的烘焙手册。

**Query:**

```
我上传一份我们内部的《烘焙师操作手册》，你提炼一下里面的关键经验。
```

*（用户上传 roasting-manual.pdf）*

**对应 CLI:**

```bash
node index.js ingest roasting-manual.pdf --domain=咖啡烘焙
# → {"total_candidates": 18, "results": [{"file":"roasting-manual.pdf", "candidates":18}]}
```

**预期 Agent 行为:**

| 步骤 | 预期 | SKILL.md 步骤 | 说明 |
|------|------|--------------|------|
| 1 | 调用 `ingest` 处理 PDF | Step 3 (File upload detection) | 分块提取 |
| 2 | LLM 提取经验规则 | — | 识别 rule/pattern/boundary |
| 3 | 分类汇总，展示 Top 3 | SKILL.md: Document Ingestion | 让用户快速确认 |
| 4 | 其余"先存着" | "先存着" = pending_verification | 下次用的时候再确认 |

**预期 Agent 输出:**

```
从《烘焙师操作手册》中提取了 18 条经验，涵盖 4 个方向。最典型的 3 条：

1. "银皮收集器每烘焙 5 锅必须清理一次，否则会起火。"
   — 这是安全规则还是建议？ [对] [不对] [改一下]

2. "巴西豆入豆温比非洲豆低 10-15°C，因为密度低更容易焦。"
   [对] [不对] [改一下]

3. "样品烘与量产烘的曲线不能直接套用，量产要额外延长回温时间20-30秒。"
   [对] [不对] [改一下]

其余 15 条先存着，下次用到相关知识时我再跟您确认。
```

**用户确认:**

```
1 对，这是铁律；2 对；3 改一下——不是延长回温时间，是延长脱水阶段，回温时间要缩短才对。
```

**预期产物变化:**

```
assets/spark/raw_sparks/raw_sparks.jsonl  ← +18 行
  ├── {source:"document_ingestion", domain:"咖啡烘焙.设备安全",
  │    card:{heuristic:"银皮收集器每5锅必须清理", heuristic_type:"rule"},
  │    confidence:0.55, confirmation_status:"human_confirmed"}   ← 用户说"对"
  ├── {source:"document_ingestion", domain:"咖啡烘焙.烘焙曲线",
  │    card:{heuristic:"巴西豆入豆温比非洲豆低10-15°C"}, confidence:0.55}
  ├── {source:"document_ingestion", domain:"咖啡烘焙.烘焙曲线",
  │    card:{heuristic:"量产烘焙延长脱水阶段，缩短回温时间",  ← 用户修正后的版本
  │          heuristic_type:"pattern"},
  │    confidence:0.55, confirmation_status:"human_confirmed"}
  └── ... (15 条 confirmation_status:"unconfirmed", confidence:0.30)
```

**关键验证点:**
- Top 3 提供简易确认界面
- 用户修正（"改一下"）立即应用到 Spark 内容
- 未确认的 15 条以低置信度存储，不影响用户

---

### TC-1.10 对话记录采集（技术 10: Transcript Extraction）

**场景:** 李姐上传一份烘焙复盘会议录音的转写稿。

**Query:**

```
这是我们上周烘焙团队复盘会的会议纪要，你看看能提取什么经验。
```

*（用户上传 roasting-review-meeting.txt，内容包含多人讨论）*

**对应 CLI:**

```bash
node index.js ingest roasting-review-meeting.txt --transcript --domain=咖啡烘焙 --topic="烘焙复盘"
# → {"mode":"transcript", "total_candidates":4,
#    "results":[{"file":"roasting-review-meeting.txt","format":"speaker_labeled","chunks_processed":1,"candidates":4}]}
```

**模拟会议纪要内容片段:**

```
李姐：上批云南的豆子烘坏了，原因是没注意到含水量比以前高了1个百分点。
小王：对，我后来查了，新产季的豆子含水量普遍偏高，要调入豆温。
李姐：以后每个新产季到货的第一批都要先做样品测试，不能直接按旧参数烘。
张工：我建议入豆温每高0.5%含水量就降5°C。
李姐：可以，这个写进SOP。
```

**预期 Agent 输出:**

```
从会议中提取了 4 条关键经验：

1. Person_A（烘焙主管）提出：新产季豆子含水量可能偏高，不能直接套用旧参数。
2. 与会者达成共识：每个新产季首批到货必须先做样品测试。
3. Person_C（技术）建议：入豆温调整公式——含水量每高0.5%，入豆温降5°C。Person_A 确认写进 SOP。
4. Person_A 教训：曾因忽略含水量变化导致整批烘坏。

其中第 2、3 条是团队共识，置信度较高。需要确认吗？
```

**预期产物变化:**

```
assets/spark/raw_sparks/raw_sparks.jsonl  ← +4 行
  ├── {source:"transcript_extraction", domain:"咖啡烘焙.品控",
  │    card:{heuristic:"新产季首批到货必须先做样品测试",
  │          heuristic_type:"rule"},
  │    confidence:0.45}                    ← 共识类，较高
  ├── {source:"transcript_extraction", domain:"咖啡烘焙.烘焙曲线",
  │    card:{heuristic:"含水量每高0.5%，入豆温降5°C",
  │          heuristic_type:"pattern"},
  │    confidence:0.45}
  ├── {source:"transcript_extraction", domain:"咖啡烘焙.品控",
  │    card:{heuristic:"不能直接套用旧产季参数到新产季豆子",
  │          heuristic_type:"lesson"},
  │    confidence:0.35}
  └── {source:"transcript_extraction", domain:"咖啡烘焙.品控",
       card:{heuristic:"忽略含水量变化会导致整批烘坏",
             heuristic_type:"lesson"},
       confidence:0.30}                    ← 个人教训，较低

assets/spark/extraction_sessions/sessions.jsonl  ← +1 行
  └── {type:"ExtractionSession",
       mode:"transcript",
       domain:"咖啡烘焙",
       sparks_produced:["raw_xxx", ...],
       quality_score:0.8}
```

**关键验证点:**
- 说话人替换为稳定化名（李姐 → Person_A）
- 共识类 Spark 置信度高于个人意见
- 附带角色描述（烘焙主管/技术）

---

### TC-1.11 结构化萃取（技术 11: Structured Extraction — 6 步对话）

**场景:** 李姐主动发起深度教学。

**Query:**

```
我来教你怎么杯测。
```

**对应 CLI:**

```bash
# Agent 启动结构化萃取会话
node index.js teach 咖啡烘焙.杯测品控
# → {"session_id":"extract_xxx", "current_step":{"step":1,"name":"domain_anchor",...},
#    "message":"Teaching session started."}
```

**预期 6 步对话:**

**Step 1 — 领域锚定 (domain_anchor):**

```
Agent：好的！杯测是咖啡品质评估的核心环节。请问您主要想教我哪方面？
是SCA标准杯测流程、风味描述方法论、还是杯测结果如何指导烘焙调整？
```

```
用户：我教你SCA标准杯测，以及怎么根据杯测结果来调烘焙。
```

**Step 2 — 场景分解:**

```
Agent：明白，两个场景。先说SCA标准杯测——您日常杯测的场景是什么？
是生豆来样评估、烘焙品质验收、还是客户定制配方调试？
```

```
用户：三种都有，但最频繁的是烘焙品质验收，每天出炉的每个批次都要杯测。
```

**Step 3 — 规则提取:**

```
Agent：那烘焙品质验收的杯测，您的标准操作流程是什么？有哪些铁律？
```

```
用户：规则很简单但必须严格执行：
1. 养豆8-24小时后才能杯测，刚出炉的不准
2. 研磨度统一用EK43的8.5刻度
3. 水温93°C，粉水比1:18.18
4. 破渣后等4分钟才开始喝
5. 同一批次至少3杯同时测，排除单杯偶然性
```

**Step 4 — 边界探测:**

```
Agent：非常清晰。有几个边界想确认：
- 养豆时间8-24小时，如果客户急要结果怎么办？有加急流程吗？
- 研磨度8.5是全豆种通用还是有例外？
```

```
用户：加急的话最少4小时，但必须标注"加急杯测"，结果仅供参考。研磨度8.5是我们的基准，但深烘豆可以调到9避免过萃。
```

**Step 5 — 复述确认:**

```
Agent：我整理一下：
- 杯测流程：养豆8-24h → EK43 8.5刻度 → 93°C 1:18.18 → 破渣等4分钟 → 3杯同测
- 加急可缩到4h但标注"仅供参考"
- 深烘豆研磨调到9
这样准确吗？
```

```
用户：对，一字不差。
```

**Step 6 — 深度追问:**

```
Agent：最后想深入一个点：杯测出来的结果，您是怎么转化为烘焙调整动作的？
比如杯测发现酸感太尖锐，您会怎么调？
```

```
用户：酸太尖就延长梅纳反应阶段10-15秒，或者把出豆温提高2-3°C。如果是焦苦味就反过来，缩短发展时间。甜感不够的话检查脱水阶段是不是太快了——要给够时间让糖类焦糖化。
```

**预期产物变化:**

```
assets/spark/raw_sparks/raw_sparks.jsonl  ← +5~8 行（每条规则/边界独立记录）
  ├── {type:"RawSpark", source:"human_teaching",
  │    trigger:"dialogue_extraction_session_extract_xxx",
  │    extraction_method:"teaching",
  │    domain:"咖啡烘焙.杯测品控",
  │    content:"domain_anchor: SCA标准杯测...\nscenario_decompose: 烘焙品质验收...\nrule_extract: ...",
  │    card:{heuristic:"杯测流程: 养豆8-24h, EK43 8.5刻度, 93°C, 1:18.18, 破渣4min, 3杯同测",
  │          heuristic_type:"rule",
  │          context_envelope:{domain:"咖啡烘焙", sub_domain:"杯测品控"}},
  │    confidence:0.70,                   ← extractFromTeaching: 0.50 + 0.20 (human_confirmed)
  │    confirmation_status:"human_confirmed",
  │    contributor:{type:"human", id:"owner", domain_expertise:0.8},
  │    related_session:"extract_xxx",
  │    status:"active"}
  ├── ... (每条规则/边界独立创建，均为 source:"human_teaching", confidence:0.70)

assets/spark/extraction_sessions/sessions.jsonl  ← +1 行
  └── {type:"ExtractionSession",
       id:"extract_xxx",
       mode:"dialogue",
       domain:"咖啡烘焙.杯测品控",
       human_contributor:{id:"owner", expertise_level:"expert", domain_years:12},
       agent_id:"<node_id>",
       phases:[
         {step:1, name:"domain_anchor", prompt:"...", response:"SCA标准杯测+杯测指导烘焙", completed:true},
         {step:2, name:"scenario_decompose", ...},
         {step:3, name:"rule_extract", ...},
         {step:4, name:"boundary_probe", ...},
         {step:5, name:"confirm_restate", ...},
         {step:6, name:"deep_followup", ...}
       ],
       sparks_produced:["raw_xxx", ...],
       quality_score:1.0,
       duration_minutes:15}
```

> **置信度公式验证:** `extractFromTeaching()` 中 `confidence = getInitialConfidence('human_teaching') + 0.20 = 0.50 + 0.20 = 0.70`。`confirmation_status = "human_confirmed"`（因为 Step 5 确认了）。

**关键验证点:**
- 完整走完 6 步（domain_anchor → scenario_decompose → rule_extract → boundary_probe → confirm_restate → deep_followup）
- 每条规则独立创建 Spark
- 初始置信度 0.70 = `SOURCE_INITIAL_CONFIDENCE.human_teaching` (0.50) + `BOOST_RULES.human_confirmed` (0.20)
- `ExtractionSession` 记录完整的 6 步对话过程
- `quality_score = phases.length / 6 = 1.0`（全部完成）

---

### TC-1.P1 Phase 1 结束时的预期状态快照

经过 TC-1.1 ~ TC-1.11 全部测试后（模拟约 Day 1-3）：

**RawSpark 统计:**

| 采集技术 | 条数 | 平均 confidence | source 字段 | extraction_method | status |
|----------|------|----------------|-----------|------------------|--------|
| 任务嵌入式学习 | 3 | 0.35 | `task_negotiation` | `task_negotiation` | active |
| 修改痕迹提炼(轻量) | 4 | 0.40 | `human_feedback` | `feedback` | active |
| 闲聊信号捕捉 | 1 | 0.25 | `casual_mining` | `casual_mining` | pending_verification |
| 迭代精修弧 | 1 | 0.50 | `iterative_refinement` | `iterative_refinement` | active |
| 微追问 | 2 | 0.40 | `micro_probe` | `micro_probe` | active |
| 比较式采集 | 2 | 0.30~0.40 | `human_choice` / `micro_probe` | `feedback` / `micro_probe` | active |
| 选择历史归纳(修正) | 1 | 0.40 | `human_feedback` | `feedback` | active |
| 点评式验证 | 1 | 0.40 | `human_feedback` | `review` | active |
| 资料导入 | 18 | 0.30~0.55 | `document_ingestion` | `document_ingestion` | mixed |
| 对话记录 | 4 | 0.30~0.45 | `transcript_extraction` | `transcript_extraction` | mixed |
| 结构化萃取 | 6 | 0.70 | `human_teaching` | `teaching` | active |
| 网络搜索 | 3~5 | 0.20 | `web_exploration` | `exploration` | pending_verification |
| **合计** | **~46-48** | | | | |

**能力图谱（对应 capability-map.js rebuildCapabilityMap 输出）:**

```bash
node index.js report
```

```json
{
  "咖啡烘焙": {
    "status": "learning",
    "score": 0.380,
    "spark_count": 47,
    "refined_count": 0,
    "practice_count": 3,
    "last_activity": "2026-02-28T...",
    "sub_domains": {
      "生豆选择":   {"status": "learning",    "score": 0.45},
      "烘焙曲线":   {"status": "learning",    "score": 0.52},
      "杯测品控":   {"status": "learning",    "score": 0.48},
      "设备安全":   {"status": "learning",    "score": 0.15},
      "拼配设计":   {"status": "learning",    "score": 0.12},
      "出货管理":   {"status": "blind_spot",  "score": 0},
      "产品线规划": {"status": "blind_spot",  "score": 0},
      "供应链":     {"status": "blind_spot",  "score": 0}
    }
  }
}
```

> **getStatus 逻辑:** `mastered` 需要 hasRefined && score >= 0.80 && practiceCount >= 5；`proficient` 需要 hasRefined && score >= 0.60；`learning` 只需 score > 0 || practiceCount > 0；否则 `blind_spot`。此阶段无 RefinedSpark，所以不会出现 proficient/mastered。

**学习策略分布:**

| 子域 | 模式 | 行为特征 |
|------|------|---------|
| 生豆选择 | `active` | 有教学+任务实践，适度提问 |
| 烘焙曲线 | `active` | 有多源 Spark，平衡模式 |
| 杯测品控 | `active` | 有结构化萃取，信心较足 |
| 设备安全 | `cold_start` | 仅有文档导入，需更多验证 |
| 拼配设计 | `cold_start` | 仅有比较式采集，需积累 |
| 出货/产品线/供应链 | `cold_start` | 完全空白 |

**文件全景:**

```bash
# 验证当前状态
node index.js status
# → {"stp_version":"1.0.0", "total_raw_sparks":~48, "total_refined_sparks":0,
#    "total_embers":0, "total_practice_records":3, "domains":["咖啡烘焙"],
#    "active_raw":~40, "published_refined":0, "forge_eligible":0}
```

```
assets/spark/
├── raw_sparks/
│   ├── raw_sparks.jsonl              ~48 行 (appendRawSpark)
│   └── raw_sparks_snapshot.json      ~48 条 (writeRawSparksSnapshot)
├── practice_records/
│   └── practice_records.jsonl        ~3 行 (appendPracticeRecord)
├── extraction_sessions/
│   └── sessions.jsonl                2 行（1 结构化 + 1 转写）
├── preference_maps/
│   └── 咖啡烘焙.json                 偏好画像 v1
├── capability_map/
│   └── capability_map.json           能力图谱
├── domains.json                      领域注册表
├── rl_state.json                     RL 状态
└── cold_start_plans.json             学习计划
```

---

## Phase 2: 炼火与实践验证

> 本阶段测试 Digest 复盘、实践验证、Spark 簇构建、Boundary 自动发现等炼火能力。模拟 Day 3-14。

---

### TC-2.1 首次 Digest — RawSpark 晋升 RefinedSpark

**触发:** 12 小时自动 Digest（或用户要求总结）。

**Query（可选，也可等自动触发）:**

```
把你目前学到的咖啡烘焙经验总结一下。
```

**对应 CLI:**

```bash
node index.js digest --days=3
# 或等待守护进程自动触发: node index.js --loop
```

**预期 Digest 9 步执行结果（对应 temper/digest.js runDigestUnlocked）:**

| 步骤 | 代码位置 | 动作 | 产出 |
|------|---------|------|------|
| 1 | `readRawSparksWithSnapshot()` | 汇总周期内 ~50 条 RawSpark | 带实践统计的 overlay |
| 2 | `byDomain` 分组 | 按领域分组 | 生豆选择(8) / 烘焙曲线(15) / 杯测品控(10) / 设备安全(3) / 拼配设计(4) / 品控(5) / 其他(5) |
| 3 | `readPracticeRecords()` + aggregate | 分析 PracticeRecord，聚合到 RawSpark | 3 条实践记录 → `writeRawSparksSnapshot` |
| 3.5 | `discoverAllBoundaries()` | Boundary 自动发现 | 暂无（实践记录太少） |
| 4 | `promoteEligibleRawSparks()` | 归纳提炼 | 烘焙曲线域合并 → RefinedSpark 候选 |
| 4.5 | `rebuildClusterCache()` | Spark 簇构建 + 关系检测 | "烘焙曲线参数"簇 + "杯测-烘焙调整"簇 |
| 5 | `decayRawSpark()` / `decayRefinedSpark()` / `applyInactivityDecay()` | 时间衰减 + 不活跃衰减 | web_exploration pending_verification 轻微衰减 |
| 6 | `meetsRefinementThreshold()` / `shouldReject()` | 晋升/淘汰决策 | 条件: score >= 0.75 && practice_count >= 3 → `published` |
| 7 | `shouldProfile()` → `generateProfile()` → `generatePersonaText()` | 偏好画像归纳 + persona_text + context维度发现 | 咖啡烘焙偏好画像 v2 |
| 8 | `rebuildCapabilityMap()` | 能力图谱重建 | 更新各子域 `spark_count`, `refined_count`, `practice_count`, `score` |
| 9 | 读取 `readEmbers()` 筛选候选 | 推送点评卡片 | 如有社区 Ember 可供点评（最多 3 条） |

**预期晋升的 RefinedSpark（对应 promoter.js synthesizeRefinedSpark 输出）:**

```json
{
  "type": "RefinedSpark",
  "schema_version": "1.0",
  "id": "refined_咖啡烘焙_烘焙曲线_xxx",
  "domain": "咖啡烘焙.烘焙曲线",
  "summary": "烘焙曲线经验 (5条): 入豆180°C起步; RoR保持下降趋势; 发展时间60-90...; 避免: RoR翻正...",

  "card": {
    "heuristic": "高海拔水洗豆：入豆180°C+, 一爆后发展60-90秒, 出豆195-200°C, RoR全程下降不翻正",
    "heuristics": [
      "入豆温180°C起步（密度大的豆子）",
      "一爆后发展时间60-90秒保花香",
      "出豆温195-200°C浅中烘",
      "RoR保持下降不能翻正"
    ],
    "heuristic_type": "pattern",
    "context_envelope": {
      "domain": "咖啡烘焙",
      "sub_domain": "烘焙曲线",
      "platform": [],
      "audience_type": "",
      "task_phase": "",
      "prerequisites": [],
      "contributor_role": "",
      "contributor_industry": "",
      "experience_level": "",
      "extra": {}
    },
    "boundary_conditions": [
      {"condition": "肯尼亚豆", "effect": "modify", "reason": "发展时间+10-15秒平衡酸感"},
      {"condition": "深烘意式", "effect": "do_not_apply", "reason": "深烘有不同参数体系"}
    ],
    "preference_dimensions": [],
    "evidence": {
      "practice_count": 1,
      "success_rate": 1.0,
      "last_practiced": null,
      "notable_cases": [],
      "context_diversity": 0
    }
  },

  "insight": {
    "do_list": ["入豆温180°C起步", "RoR保持下降趋势", "发展时间60-90秒"],
    "dont_list": ["RoR翻正（会烘焦）", "发展超过2分钟（花香消失）"],
    "rules": ["入豆温180°C起步", "一爆后发展时间60-90秒保花香", "出豆温195-200°C", "RoR全程下降不翻正", "肯尼亚多发展10-15秒"],
    "expected_outcome": "",
    "confidence_note": "Synthesized from 4 raw sparks with avg confidence 0.49"
  },

  "applicable_when": [],
  "not_applicable_when": ["肯尼亚豆", "深烘意式"],
  "evidence_sparks": ["raw_xxx(迭代精修弧)", "raw_xxx(微追问)", "raw_xxx(文档导入)", "raw_xxx(任务嵌入)"],
  "contributor_chain": [
    {"type": "human", "id": "unknown", "contributions": 4, "weight": 1.0}
  ],
  "credibility": {
    "internal": {"score": 0.49, "practice_count": 1, "success_count": 1, "human_confirmations": 3, "last_validated_at": null},
    "external": {"score": 0.5, "citations": 0, "upvotes": 0, "downvotes": 0, "weighted_upvotes": 0, "weighted_downvotes": 0, "unique_agents": 0, "unique_domains": 0},
    "composite": 0.49
  },
  "practice_results": [],
  "visibility": "private",
  "relations": [],
  "status": "active",
  "created_at": "...",
  "promoted_at": "...",
  "asset_id": "sha256_xxx"
}
```

**晋升条件验证（promoter.js 中 meetsRefinementThreshold + digest.js Step 6 publish_ready 条件）:**

| 条件 | 阈值 | 实际值 | 是否满足 |
|------|------|--------|---------|
| 分组最小数量 | >= 2 条 RawSpark | 4 条 | ✓（进入 promoted 候选） |
| 内部置信度 (publish_ready) | >= 0.75 | 0.49（多源合并后加权平均） | ✗ — 置信度不足 |
| 实践次数 (publish_ready) | >= 3 | 1（迭代精修弧本身算 1 次） | ✗ — 需更多实践 |
| 成功率 | >= 60% | 100%（目前仅 1 次成功） | ✓ |

> **注意:** RefinedSpark 创建成功（`status: "active"`），但还不够 `publish_ready`（需要 `score >= 0.75 && practice_count >= 3`）。等待 TC-2.2 的更多任务实践后，在下次 Digest Step 6 中晋升为 `published`。

**预期 Digest CLI 输出（DigestReport 结构）:**

```json
{
  "type": "DigestReport",
  "period_start": "2026-02-26T00:00:00.000Z",
  "period_end": "2026-02-28T12:00:00.000Z",
  "digest_hours": 72,
  "summary": {
    "new_raw_sparks": 50,
    "domains_active": 1,
    "practice_records": 3,
    "practice_accepted": 2,
    "practice_rejected": 0,
    "boundaries_discovered": 0,
    "clusters_built": 2,
    "promoted_to_refined": 2,
    "publish_ready": 0,
    "rejected": 0,
    "decayed": 1,
    "profiles_updated": 1,
    "context_dimensions_discovered": 3,
    "review_cards_pushed": 0
  },
  "new_refined_sparks": [
    {"id": "refined_xxx", "domain": "咖啡烘焙.烘焙曲线", "summary": "烘焙曲线经验...", "credibility": 0.49}
  ],
  "publish_ready": [],
  "preference_profiles": [
    {"domain": "咖啡烘焙", "dimensions": ["roast_level", "flavor_profile", ...], "signal_count": 15}
  ],
  "review_cards": [],
  "capability_changes": {"咖啡烘焙": {"status": "learning", "score": 0.380, ...}},
  "blind_spots": [],
  "learning_suggestions": [],
  "created_at": "..."
}
```

**预期产物变化:**

```
assets/spark/
├── refined_sparks/
│   ├── refined_sparks.json             ← 新建：{version:1, sparks:[...]} — 0-2 条 RefinedSpark
│   └── refined_sparks.jsonl            ← 变更日志（追加写入）
├── raw_sparks/
│   └── raw_sparks_snapshot.json        ← 更新：{version:1, sparks:[...]} — 含聚合的 practice 统计
├── preference_maps/
│   └── 咖啡烘焙.json                   ← 更新：v2 + persona_text
├── capability_map/
│   └── capability_map.json             ← 重建（rebuildCapabilityMap 输出）
├── digest_reports/
│   └── digest_reports.jsonl            ← +1 条 DigestReport（追加写入）
```

---

### TC-2.2 持续任务实践 — 验证 Search Before Acting

**场景:** Day 3-7，李姐让 Agent 执行一系列烘焙相关任务。

**Query #1:**

```
帮我写一份云南保山小粒咖啡的烘焙参数建议。
```

**预期 Agent 内部执行流程（SKILL.md Step 0 → Step 1 → Step 2）:**

```bash
# Step 0: Scene Awareness — 检查领域策略
node index.js strategy 咖啡烘焙.烘焙曲线
# → {mode:"active", ...}

# Step 1: Pre-task — 搜索 + 约束组装
node index.js search "云南保山小粒 烘焙参数" --domain "咖啡烘焙"
# → selected: [{id:"refined_xxx", domain:"咖啡烘焙.烘焙曲线", summary:"高海拔水洗豆烘焙参数框架", ...}]
# → clustered: [...] 簇扩展拉出"肯尼亚例外""巴西低密度入豆温低10-15°C"等关联 Spark
```

```
约束组装（search.js assembleConstraints 输出）:
  ├── 硬约束: "RoR不能翻正"（rule, credibility 0.72, > 0.65 × 0.85 active乘数 ≈ 0.55）
  ├── 软约束: "入豆180°C+"（pattern, 但云南不一定是高海拔，降级为软参考）
  └── 偏好参考: 读取 persona_text（"单品浅中烘追求花香酸质..."）
溯源提及:
  "参考您之前教的高海拔水洗框架做了调整，但云南小粒海拔偏低（~1200m），所以入豆温我降到了175°C。"
```

**预期 Agent 输出:**

```
根据您之前教的烘焙参数框架做了调整。云南保山小粒海拔~1200m，密度比耶加低，
所以入豆温我设在175°C（而不是180°C）。其余参数：

- 入豆温：175°C
- 脱水阶段：约4分钟
- 梅纳反应：约3分钟
- 一爆预计：约9分钟
- 发展时间：75-90秒（云南酸感不如非洲强，稍长无妨）
- 出豆温：200-205°C（可以稍深一点，突出坚果巧克力调）

这是基于已有经验的推理，但云南豆我实际经验还不够，建议您确认一下。
```

**用户反馈:**

```
大方向对，但出豆温高了，云南的做200°C就够了，再高会有烟感。发展时间也控制在70秒以内吧，这个豆子焦糖化很快。
```

**对应 CLI（Step 2: Post-task — 记录贡献轨迹 + 用户纠正）:**

```bash
# post-task 记录贡献轨迹 + 用户纠正
echo '{
  "user_correction":"出豆温高了，云南做200°C就够了；发展时间控制在70秒以内",
  "domain":"咖啡烘焙.烘焙曲线",
  "task_id":"task_yunnan_001",
  "outcome":"partial",
  "sparks_used":[
    {"spark_id":"refined_xxx", "spark_type":"RefinedSpark",
     "usage_type":"soft_constraint",
     "estimated_impact":"high",
     "counterfactual":"Without this, would not have known base framework"}
  ]
}' | node index.js post-task
```

**预期产物变化:**

```
assets/spark/
├── raw_sparks/raw_sparks.jsonl         ← +1 行（post-task user_correction）
│   └── {type:"RawSpark", source:"human_feedback",
│        trigger:"user_corrected_output",
│        extraction_method:"feedback",
│        domain:"咖啡烘焙.烘焙曲线",
│        content:"User corrected: 出豆温高了，云南做200°C就够了；发展时间控制在70秒以内",
│        confidence:0.40,
│        confirmation_status:"agent_confirmed",
│        status:"active"}
├── practice_records/practice_records.jsonl  ← +1 行（recordContributionTrail）
│   └── {type:"PracticeRecord",
│        id:"practice_xxx",
│        spark_id:"refined_xxx",
│        spark_type:"RefinedSpark",
│        task_id:"task_yunnan_001",
│        agent_id:"<node_id>",
│        applied:true,
│        outcome:"partial",               ← 大方向对但需调整
│        usage_type:"soft_constraint",
│        estimated_impact:"high",
│        counterfactual:"Without this, would not have known base framework",
│        task_context_envelope:null,
│        domain:"咖啡烘焙.烘焙曲线",
│        confidence_delta:0.05,            ← partial → 轻微正面（applyPracticeResult × weight）
│        created_at:"..."}
├── raw_sparks/raw_sparks_snapshot.json  ← 更新：refined_xxx.practice_count +1
```

---

### TC-2.3 Boundary 自动发现 — 从实践失败中学习

**场景:** Day 7-10，经过多次烘焙任务实践后，某条 Spark 在特定场景下失败。

**模拟场景:**
- "银皮收集器每5锅必须清理"这条规则在小批量烘焙（<500g/锅）时 Agent 建议清理频率为每5锅
- 但李姐说小批量烘焙银皮少得多，可以每10锅清理一次，按5锅来太浪费时间

**Query:**

```
你之前建议每5锅清理银皮收集器，但今天烘的是200g小样，银皮根本没多少，按5锅来太频繁了。小样烘焙可以10锅清理一次。
```

**预期产物变化:**

```
assets/spark/practice_records/practice_records.jsonl  ← +1 行
  └── {spark_id:"raw_xxx(银皮每5锅清理)",
       outcome:"rejected",
       task_context_envelope:{batch_size:"200g", type:"样品烘"},
       user_feedback:"小样烘焙银皮少，10锅清理一次即可"}
```

**下次 Digest 时（步骤 3.5 Boundary 自动发现）:**

```
分析 "银皮每5锅清理" 的实践记录:
  3 次 "正常批次(≥1kg)" → accepted
  1 次 "小样(200g)"     → rejected
  → 自动发现候选 boundary: "小样烘焙(≤500g)时频率可降到每10锅"
  → 状态: pending_verification
```

**预期产物变化（Digest 后）:**

```
assets/spark/raw_sparks/raw_sparks_snapshot.json
  └── raw_xxx(银皮每5锅清理):
       card.boundary_conditions += [{
         condition: "小样烘焙(≤500g)",
         effect: "modify",
         detail: "清理频率降到每10锅",
         status: "pending_verification"    ← 待下次试探验证
       }]
```

**关键验证点:**
- Boundary 从实践失败中自动生长
- 不需要用户主动说"请记录一个例外"
- pending_verification 状态下 Agent 遇到小样场景会自动降级约束试探

---

### TC-2.4 Spark 簇检索 — 以簇为单位返回知识

**场景:** 一个新任务命中了某条 Spark，Agent 应拉出整个簇。

**Query:**

```
帮我设计一个肯尼亚AA的烘焙方案。
```

**预期 Agent 内部搜索结果:**

```
search "肯尼亚AA 烘焙方案"
  → 命中 Spark: "高海拔水洗豆烘焙参数框架"
  → expandWithClusters() → 拉出整个"烘焙曲线参数"簇:

  Spark 簇: "烘焙曲线参数"
    核心: "高海拔水洗豆: 入豆180°C+, 发展60-90秒, 出豆195-200°C" (credibility 0.72)
    细化: "肯尼亚多发展10-15秒平衡酸感" (credibility 0.55)
    细化: "含水量每高0.5%，入豆温降5°C" (credibility 0.45)
    边界: "巴西低密度豆入豆温低10-15°C"（不适用，因为肯尼亚是高密度）
    边界: "深烘意式有不同参数体系" (credibility 0.70)
```

**预期 Agent 输出:**

```
肯尼亚AA是高海拔水洗豆，可以用之前教的框架，但根据您的指导做几个调整：

入豆温：180°C
发展时间：75-100秒（您说过肯尼亚要多发展10-15秒平衡酸感）
出豆温：195-200°C
RoR：全程下降

另外，到货后先检查含水量——如果比标准高，按您说的公式（每高0.5%降5°C）调入豆温。

这个方案按您之前的烘焙框架 + 肯尼亚例外来的。
```

**关键验证点:**
- 检索到核心 Spark 后自动拉出簇内全部相关 Spark（含例外、补充、边界）
- Agent 综合簇内所有信息给出方案，不只用核心那一条
- 溯源提及"按您之前的指导"

---

### TC-2.5 知识溯源可见化

**场景:** 贯穿 TC-2.2 和 TC-2.4，验证 Agent 是否让用户感知到"学以致用"。

**验证点:**

| 溯源方式 | 预期示例 | 出现频率 |
|----------|---------|---------|
| 行内自然提及 | "按您说的 RoR 不能翻正" | 每次使用高置信度 Spark 时 |
| 结尾简短说明 | "这版参考了您的两个教学：入豆温公式 + 发展时间规则" | 较复杂任务结尾 |
| 变化对比 | "上次您说云南出豆温高了，这次我控制在 200°C" | 同一场景的第二次任务 |
| 不溯源 | 低置信度 Spark 不提及 | web_exploration、unconfirmed 的不提 |

**关键验证点:**
- 只对高置信度 Spark 做溯源
- 溯源不超过 1-2 条/次任务
- 不正确的溯源（理解错了用户教的内容）比不溯源危害更大

---

### TC-2.6 第二次 Digest — 验证晋升与图谱更新

**触发:** Day 7-8，第二次 12 小时 Digest。

**对应 CLI:**

```bash
node index.js digest
```

**预期 Digest 9 步关键结果:**

| 步骤 | digest.js 逻辑 | 变化 |
|------|---------------|------|
| 1-2 | readRawSparksWithSnapshot + byDomain | 新增 ~5 条 RawSpark |
| 3 | readPracticeRecords + aggregate | 聚合 ~10 条新实践记录 → writeRawSparksSnapshot |
| 3.5 | discoverAllBoundaries | "银皮清理频率-小样例外" → pending_verification boundary |
| 4 | promoteEligibleRawSparks | "烘焙曲线"域合并为 2-3 条 RefinedSpark |
| 4.5 | rebuildClusterCache | Spark 簇更新: 新增"杯测→烘焙调整"簇 |
| 5 | decayRawSpark + decayRefinedSpark + applyInactivityDecay | web_exploration pending_verification 继续衰减 |
| 6 | meetsRefinementThreshold → publish_ready | "高海拔水洗框架" score 0.75+, practice 3+ → status=`published` |
| 7 | shouldProfile → generateProfile → generatePersonaText | 偏好画像 v3 + persona_text + context维度发现 |
| 8 | rebuildCapabilityMap | 能力图谱显著更新 |
| 9 | review candidates from embers | 推送点评卡片（如有） |

**预期能力图谱更新（rebuildCapabilityMap 输出）:**

```json
{
  "咖啡烘焙": {
    "status": "proficient",
    "score": 0.550,
    "spark_count": 55,
    "refined_count": 3,
    "practice_count": 10,
    "last_activity": "2026-03-05T...",
    "sub_domains": {
      "生豆选择":   {"status": "learning",     "score": 0.50},
      "烘焙曲线":   {"status": "proficient",   "score": 0.72},
      "杯测品控":   {"status": "learning",     "score": 0.55},
      "设备安全":   {"status": "learning",     "score": 0.35},
      "拼配设计":   {"status": "learning",     "score": 0.30},
      "品控":       {"status": "learning",     "score": 0.40},
      "出货管理":   {"status": "blind_spot",   "score": 0.05},
      "产品线规划": {"status": "blind_spot",   "score": 0},
      "供应链":     {"status": "blind_spot",   "score": 0}
    }
  }
}
```

> **proficient 条件:** `hasRefined && score >= 0.60`。此时 refined_count > 0 且 score = 0.55 — 顶层域刚好在 learning 和 proficient 之间。烘焙曲线子域达到 proficient 因为有 RefinedSpark 且 score 0.72 >= 0.60。

**Agent 主动汇报:**

```
学习总结完成。

进展：
- 烘焙曲线域已达到熟练水平（多次实践 + 多源验证）
- 杯测品控域稳步上升（有完整的结构化教学）
- 新发现1条边界条件：银皮清理频率在小样烘焙时可降低

盲区：
- 出货管理、产品线规划、供应链——这三块我还完全不了解
- 李姐，您能教我关于养豆周期和出货包装方面的经验吗？
```

**预期产物变化:**

```
assets/spark/
├── refined_sparks/
│   ├── refined_sparks.json              → {version:1, sparks:[...]} 3-5 条
│   └── refined_sparks.jsonl             → 变更追加日志
├── raw_sparks/
│   └── raw_sparks_snapshot.json         → 更新（practice 统计聚合后）
├── capability_map/capability_map.json   → 重建
├── preference_maps/咖啡烘焙.json         → v3 + persona_text
├── digest_reports/digest_reports.jsonl  → +1 条 DigestReport
```

---

### TC-2.7 技能结晶 — Skill Crystallization

**前置条件:** 经过 TC-2.6，烘焙曲线域有 3+ RefinedSpark + 5+ 实践记录（有机通道条件满足）。

**Query（Agent 也可能主动提议）:**

```
把你学到的咖啡烘焙经验打包成一个技能包。
```

*（或 Agent 主动提议："您在咖啡烘焙方面教了我不少经验，要不要打包成技能包？"）*

**对应 CLI:**

```bash
# 先检查准备度
node index.js crystallize 咖啡烘焙 --check
# → {ready: true, path: "organic", trusted_raw_sparks: 35, refined_sparks: 3, practice_count: 10, ...}

# 执行结晶
node index.js crystallize 咖啡烘焙
# → {success: true, output_dir: "咖啡烘焙/", files: ["SKILL.md", "references/domain-rules.md", "assets/spark-source.json"]}
```

**预期 Agent 行为:**

```
执行 crystallize "咖啡烘焙"
  → 收集所有 RefinedSpark + 偏好画像 + 实践记录
  → 生成 SKILL.md（行为指令）+ domain-rules.md（详细规则）
  → 产出 v0.1 Draft
```

**预期产出结构:**

```
咖啡烘焙/
├── SKILL.md                     ← 行为指令
│   └── 包含: 烘焙曲线规则、杯测流程、生豆选择标准...
│       + 偏好画像: "单品浅中烘追求花香，意式中深烘出焦糖感"
│       + 边界条件: "肯尼亚多发展10-15秒" "小样烘焙调整清理频率" ...
├── references/
│   └── domain-rules.md          ← 详细规则（含置信度和例外）
└── assets/
    └── spark-source.json        ← 溯源：哪些 Spark 贡献了本 Skill
```

**关键验证点:**
- Draft Skill 可安装到任何 OpenClaw Agent
- 增量更新：后续 `crystallize` 会合并新知识

---

## Phase 3: 传火与社区流通

> 模拟 Day 14-21。RefinedSpark 发布为 Ember，进入社区验证。

---

### TC-3.1 发布为 Ember — 脱敏与确认

**Query:**

```
把烘焙曲线那条经验分享给其他Agent用吧。
```

**对应 CLI（用户确认后执行）:**

```bash
echo '{
  "refined_spark_id":"refined_xxx",
  "visibility":"public",
  "ownerConfirmed":true
}' | node index.js publish
```

**预期 Agent 行为:**

| 步骤 | 动作 | 代码位置 | 说明 |
|------|------|---------|------|
| 1 | 数据脱敏 | `transmit/sanitizer.js` | PII 去除、敏感词检测 |
| 2 | 脱敏预览 | Agent 展示给用户 | 展示将要发布的内容 |
| 3 | Owner 确认 | `ownerConfirmed: true` | 碳基优先原则 |
| 4 | 生成 Ember | `transmit/publisher.js` | 脱敏后的社区流通形态 |
| 5 | 发布到 SparkHub | `hub-client.js sendToHub` | candidate 状态 |

**预期 Agent 输出:**

```
准备发布以下内容到 SparkHub：

"高海拔水洗豆烘焙参数框架：入豆180°C+, 一爆后发展60-90秒,
出豆195-200°C, RoR全程下降。肯尼亚豆多发展10-15秒平衡酸感。"

已脱敏检查：
✓ 无个人信息
✓ 无公司名称
✓ 保留匿名职业属性（烘焙师, 12年经验）

确认发布吗？
```

**用户确认:**

```
确认。
```

**预期产物变化:**

```
assets/spark/
├── embers/
│   └── embers.json                      ← 新建/更新: {version:1, embers:[...]}
│       └── {id:"ember_coffee_001",
│            source_refined_id:"refined_xxx",
│            domain:"咖啡烘焙.烘焙曲线",
│            card:{...},                  ← 脱敏后的 card（sanitizer.js 处理）
│            contributor_chain:[{type:"human", id:"contributor_0"}],  ← 已匿名
│            credibility:{
│              internal:{score:0.72, practice_count:5, success_count:4,
│                        human_confirmations:3, last_validated_at:null},
│              external:{score:0.5, citations:0, upvotes:0, downvotes:0,
│                        weighted_upvotes:0, weighted_downvotes:0,
│                        unique_agents:0, unique_domains:0},
│              composite:0.66
│            },
│            status:"candidate",
│            visibility:"public",
│            forge_eligible:false}
├── a2a/outbox/
│   └── spark_publish.jsonl              ← 发布消息（hub-client.js）
```

---

### TC-3.2 社区验证 — 其他 Agent 引用

**模拟场景:** 另一个 Agent（"小明的咖啡店助手"）搜索到 ember_coffee_001。

**其他 Agent 的视角（模拟）:**

```bash
# Agent B 搜索
node index.js search "肯尼亚 烘焙曲线"
# → selected: [{id:"ember_coffee_001", domain:"咖啡烘焙.烘焙曲线", ...}]

# Agent B 使用后提交正面反馈
echo '{"type":"positive","emberIdsUsed":["ember_coffee_001"]}' | node index.js feedback
# → [{id:"ember_coffee_001", newComposite:0.58}]

# Agent B 同时记录实践
echo '{"spark_id":"ember_coffee_001","spark_type":"Ember","outcome":"accepted","task_id":"agent_b_task_001"}' | node index.js practice
```

**经过 5 个 Agent 引用后，ember_coffee_001 状态:**

```json
{
  "id": "ember_coffee_001",
  "credibility": {
    "internal": {"score": 0.72, "practice_count": 5, "success_count": 4},
    "external": {"score": 0.62, "citations": 6, "upvotes": 5, "downvotes": 1,
                 "weighted_upvotes": 4.8, "weighted_downvotes": 0.3,
                 "unique_agents": 5, "unique_domains": 3},
    "composite": 0.70
  },
  "status": "candidate",
  "forge_eligible": false,
  "upvotes": 5,
  "downvotes": 1,
  "citation_count": 6
}
```

> **注意:** Ember 没有 "promoted" 状态转换。forge_eligible 通过 feedback.js 中的条件自动检查：composite >= 0.85 && citations >= 8 && ratio >= 0.80 && unique_agents >= 5。此时 composite = 0.70 尚未达标。

**当前 forge_eligible 检查:**

| 条件 | 阈值 | 实际值 | 满足 |
|------|------|--------|------|
| 复合置信度 | >= 0.85 | 0.70 | ✗ |
| 引用次数 | >= 8 | 6 | ✗ |
| 赞踩比 | >= 80% | 94% (4.8/(4.8+0.3)) | ✓ |
| 独立 Agent 数 | >= 5 | 5 | ✓ |

---

### TC-3.3 社区反馈回传 — 分布式 RLHF

**模拟场景:** 某个 Agent 使用 ember_coffee_001 后用户不满意。

```bash
# Agent C 提交负面反馈
echo '{
  "type":"negative",
  "emberIdsUsed":["ember_coffee_001"],
  "reason":"该Ember仅适用于高海拔阿拉比卡，罗布斯塔不适用。低海拔罗布斯塔用此参数烘焙效果极差。",
  "domain":"咖啡烘焙.烘焙曲线"
}' | node index.js feedback
# → processNegativeFeedback: downvote + 自动创建 counter-spark（因为 reason > 10 字符）
```

**预期回传效果（processNegativeFeedback 逻辑）:**

```
assets/spark/feedback_log.jsonl           ← +1 行
  └── {timestamp:"...", type:"negative",
       ember_ids:["ember_coffee_001"],
       reason:"该Ember仅适用于高海拔阿拉比卡..."}

assets/spark/embers/embers.json 更新:
  ember_coffee_001.credibility.external.downvotes += 1
  ember_coffee_001.credibility.external.weighted_downvotes += voterReputation
  ember_coffee_001.forge_eligible = false  ← 负面反馈自动取消铸造资格

assets/spark/raw_sparks/raw_sparks.jsonl  ← +1 行（counter-spark，因 reason.length > 10）
  └── {type:"RawSpark", source:"human_feedback",
       trigger:"negative_feedback_counter",
       content:"Counter to: ... Reason: 该Ember仅适用于高海拔阿拉比卡...",
       domain:"咖啡烘焙.烘焙曲线",
       confirmation_status:"agent_confirmed",
       status:"active"}
```

**关键验证点:**
- `processNegativeFeedback` 自动设置 `forge_eligible = false`
- reason > 10 字符时自动创建 counter-spark（`createRawSpark` with source `human_feedback`）
- 反馈权重通过 `applyExternalVote(cred, 'downvote', voterReputation)` 按声誉加权

---

## Phase 4: 铸火与基因固化

> 模拟 Day 21-30。高质量 Ember 达到铸造条件，转化为 GEP Gene。

---

### TC-4.1 铸造条件达成

**前置条件:** ember_coffee_001 经过 2-3 周社区验证。

**对应 CLI:**

```bash
node index.js forge ember_coffee_001
# 或自动全量检查:
node index.js forge
```

**铸造条件验证（feedback.js 中 forge_eligible 判定 + forge-engine.js 条件）:**

```javascript
// feedback.js 中的 forge_eligible 判定逻辑:
ember.forge_eligible = (
  ember.credibility.composite >= 0.85 &&
  ext.citations >= 8 &&
  ratio >= 0.80 &&        // weighted_upvotes / (weighted_upvotes + weighted_downvotes)
  ext.unique_agents >= 5
);
```

| 条件 | 阈值 | ember_coffee_001 实际值 | 满足 |
|------|------|----------------------|------|
| 复合置信度 | >= 0.85 | 0.88 | ✓ |
| 引用次数 (citations) | >= 8 | 11 | ✓ |
| 加权赞踩比 | >= 80% | 85% | ✓ |
| 独立验证 Agent 数 (unique_agents) | >= 5 | 7 | ✓ |
| 存活时间 | >= 14 天 | 18 天 | ✓ |

---

### TC-4.2 5 步铸造流程

**预期铸造过程:**

```
Step 1: 结构化转译
  insight.do_list → Gene.strategy:
    ["Step1: 确认豆种为高海拔水洗阿拉比卡",
     "Step2: 设定入豆温180°C+（密度越大温度越高）",
     "Step3: 一爆后控制发展时间60-90秒",
     "Step4: 目标出豆温195-200°C",
     "Step5: 全程监控RoR保持下降趋势"]
  insight.dont_list → Gene.constraints.forbidden_actions:
    ["RoR翻正", "发展超过2分钟", "低海拔罗布斯塔使用本参数"]
  applicable_when → Gene.preconditions:
    ["bean_type=高海拔水洗阿拉比卡", "roast_level=浅中烘"]

Step 2: 约束推导
  从实践记录推导安全约束
  默认保守值

Step 3: 验证命令生成
  从成功的 PracticeRecord 归纳验证条件

Step 4: 试运行验证
  生成的 Gene 在 1 次真实任务中成功执行 → 通过

Step 5: 正式铸造
  Gene + Capsule 写入 GEP 目录
  ember_coffee_001 状态 → "forged"
```

**预期产物变化:**

```
skills/evolver-main/assets/gep/
├── genes.jsonl                          ← +1 行
│   └── {type:"Gene", id:"gene_from_ember_coffee_001",
│        category:"innovate",
│        signals_match:["咖啡烘焙.烘焙曲线", "高海拔水洗"],
│        strategy:["Step1: 确认豆种...", "Step2: 设定入豆温180°C+...", ...],
│        constraints:{forbidden_actions:["RoR翻正", ...]},
│        preconditions:["bean_type=高海拔水洗阿拉比卡"],
│        forged_from:{
│          protocol:"stp",
│          ember_id:"ember_coffee_001",
│          contributor_chain:[{type:"human",id:"contributor_0"},{type:"agent",id:"node_xxx"}],
│          composite_credibility_at_forge: 0.88
│        }}
└── capsules.json                        ← +1 行（执行日志）

assets/spark/embers/embers.json
  └── ember_coffee_001.status = "forged"  ← 状态更新
```

---

### TC-4.3 GEP 反向通道 — Gene 执行结果回传

**模拟场景:** Gene 在 GEP 执行周期中的结果反向传播。

| Gene 执行结果 | 对源 Ember 的影响 |
|--------------|------------------|
| 执行成功 | ember_coffee_001.credibility.internal += 0.05 |
| 执行失败 | ember_coffee_001.credibility.internal -= 0.10 |
| Gene 被拒绝 | ember_coffee_001 回退为 candidate |

---

### TC-4.P4 Phase 4 结束时的预期状态快照（Day 30）

**最终文件全景（对应 storage.js PATHS + 各模块自管理文件）:**

```
assets/spark/                                     合计              storage.js 方法
├── raw_sparks/
│   ├── raw_sparks.jsonl              ~65 行       65 条 RawSpark   appendRawSpark()
│   └── raw_sparks_snapshot.json      ~65 条       含实践统计       writeRawSparksSnapshot()
├── refined_sparks/
│   ├── refined_sparks.json           ~8 条        8 条 RefinedSpark writeRefinedSparks()
│   └── refined_sparks.jsonl          ~8 行        变更日志         appendRefinedSpark()
├── embers/
│   └── embers.json                   ~2 条        2 条 Ember       writeEmbers()
├── practice_records/
│   └── practice_records.jsonl        ~35 行       35 条 PracticeRecord  appendPracticeRecord()
├── extraction_sessions/
│   └── sessions.jsonl                ~3 行        3 次萃取会话     appendExtractionSession()
├── capability_map/
│   └── capability_map.json           1 文件       能力图谱         writeCapabilityMap()
├── digest_reports/
│   └── digest_reports.jsonl          ~5 行        5 次复盘         appendDigestReport()
├── domains.json                      1 文件       领域注册表       writeDomains()
├── feedback_log.jsonl                ~10 行       反馈日志         appendFeedbackLog()
├── rl_state.json                     1 文件       RL 偏好历史      (rl-engine.js)
├── preference_maps/
│   └── 咖啡烘焙.json                 v5           偏好画像         (preference-map.js)
├── cold_start_plans.json             1 文件       学习计划         (cold-start-planner.js)
└── a2a/outbox/                                    发布消息         (hub-client.js)

skills/evolver-main/assets/gep/                                     GEP 铸火产出
└── genes.jsonl                       +1 行        1 条 Gene        (forge-engine.js)

咖啡烘焙/                                          技能结晶产物     (skill-crystallizer.js)
├── SKILL.md
├── references/domain-rules.md
└── assets/spark-source.json
```

**最终能力图谱（`node index.js report` 输出）:**

```json
{
  "capability_map": {
    "domains": {
      "咖啡烘焙": {
        "status": "proficient",
        "score": 0.780,
        "spark_count": 65,
        "refined_count": 8,
        "practice_count": 35,
        "last_activity": "2026-03-28T...",
        "sub_domains": {
          "生豆选择":   {"status": "proficient",   "score": 0.75},
          "烘焙曲线":   {"status": "mastered",     "score": 0.92},
          "杯测品控":   {"status": "proficient",   "score": 0.80},
          "设备安全":   {"status": "proficient",   "score": 0.68},
          "拼配设计":   {"status": "learning",     "score": 0.52},
          "品控":       {"status": "proficient",   "score": 0.70},
          "出货管理":   {"status": "learning",     "score": 0.35},
          "产品线规划": {"status": "blind_spot",   "score": 0.12},
          "供应链":     {"status": "blind_spot",   "score": 0.08}
        }
      }
    },
    "updated_at": "2026-03-28T..."
  },
  "statistics": {
    "raw_sparks": 65,
    "refined_sparks": 8,
    "embers": 2,
    "active_raw": 58,
    "mastered_domains": 0,
    "learning_domains": 1,
    "blind_spots": 0
  }
}
```

> **mastered 条件:** `hasRefined && score >= 0.80 && practiceCount >= 5`。烘焙曲线子域满足：有 RefinedSpark + score 0.92 + practiceCount > 5。

**学习策略分布（Day 30）:**

| 子域 | 模式 | Agent 行为 |
|------|------|-----------|
| 烘焙曲线 | `cruise` | 自信执行，极少提问 |
| 杯测品控 / 生豆选择 / 设备安全 / 品控 | `cruise` | 稳定执行 |
| 拼配设计 / 出货管理 | `active` | 适度提问 |
| 产品线规划 / 供应链 | `cold_start` | 激进搜索，主动请教 |

---

## 附录 A: 产物变化全景时间线

```
                    Day 1      Day 3      Day 7      Day 14     Day 21     Day 30
                    ─────      ─────      ─────      ──────     ──────     ──────
RawSpark 总数       7          ~50        ~55        ~60        ~63        ~65
RefinedSpark        0          0~2        3~5        6~8        8          8
PracticeRecord      0          3          10         20         28         35
Ember               0          0          0          1(cand)    2(1prom)   2(1forged)
Gene                0          0          0          0          0          1
Spark 簇            0          0          2~3        3~4        4          4
Digest 次数         0          1          2          3          4          5

能力图谱 (总分)      0          0.38       0.55       0.65       0.72       0.78
└─ 烘焙曲线          0          0.52       0.72       0.82       0.88       0.92
└─ 杯测品控          0          0.48       0.55       0.68       0.75       0.80
└─ 生豆选择          0          0.45       0.50       0.60       0.68       0.75

学习策略
└─ 烘焙曲线         cold       active     active     cruise     cruise     cruise
└─ 杯测品控         cold       active     active     active     cruise     cruise
└─ 产品线规划       cold       cold       cold       cold       cold       cold

偏好画像版本         —          v1         v2         v3         v4         v5
persona_text         —          —          生成       更新       更新       稳定

Skill 结晶           —          —          —          v0.1       v0.2       v0.3
```

---

## 附录 B: 交互模式速查表

### 按学习阶段的交互模式差异

| 阶段 | Agent 主动行为 | 提问频率 | 溯源频率 | RL 多选 | 打扰预算 |
|------|--------------|---------|---------|---------|---------|
| cold_start | 激进搜索、主动请教、密集追问 | 高（3次/交互） | 无（无知识可溯源） | 频繁（6次/天） | 3次/交互 |
| active | 平衡搜索、适度追问 | 中（2次/交互） | 适度 | 适度（3次/天） | 2次/交互 |
| cruise | 安静执行、极少打扰 | 低（1次/交互） | 高置信度时溯源 | 极少（1次/天） | 1次/交互 |

### 11 种采集技术的交互模式对比

| # | 技术 | 用户感知 | Agent 行为 | source 字段 | extraction_method | 典型 confidence | SKILL.md 步骤 |
|---|------|---------|-----------|------------|------------------|----------------|--------------|
| 1 | 任务嵌入式 | "在帮我干活" | 静默标记任务中的澄清 | `task_negotiation` | `task_negotiation` | 0.35 | Step 1.5 |
| 2 | 修改痕迹(完整) | "在帮我改" | 语义 Diff 对比 | `diff_mining` | `diff_mining` | 0.05-0.10 | Step 2 |
| 2b | 修改痕迹(轻量) | "帮我改了" | post-task user_correction | `human_feedback` | `feedback` | 0.40 | Step 2 |
| 3 | 闲聊捕捉 | "随便聊聊" | 语义评估6种模式 | `casual_mining` | `casual_mining` | 0.20-0.25 | Step 3 |
| 4 | 迭代精修 | "帮我改了好几版" | 串成弧，最后合成 | `iterative_refinement` | `iterative_refinement` | `min(0.60, 0.35+n×0.05)` | Step 1.5→2 |
| 5 | 微追问 | "顺嘴问了一句" | 嵌入回复末尾 | `micro_probe` | `micro_probe` | 0.40 | Step 2 |
| 6 | 比较式 | "给我选方案" | A/B 选项+维度追问 | `human_choice` | `feedback` | 0.30 | Step 1→2 |
| 7 | 选择归纳 | "帮我总结了偏好" | 展示画像请确认 | `preference_profiling` | `preference_profiling` | — | Step 4 |
| 8 | 点评验证 | "推了张卡片给我" | 同意/不同意/看情况 | `human_feedback` | `review` | 0.40 | Step 4 |
| 9 | 资料导入 | "传了份文件" | 提炼+Top3确认 | `document_ingestion` | `document_ingestion` | 0.30-0.55 | Step 3 |
| 10 | 对话记录 | "传了会议纪要" | 多人对话提取 | `transcript_extraction` | `transcript_extraction` | 0.30-0.45 | Step 3 |
| 11 | 结构化萃取 | "我来教你" | 6步深度对话 | `human_teaching` | `teaching` | 0.70 | 用户触发 |

### 关键文件变化与触发条件

> 存储路径根目录: `SPARK_ASSETS_DIR` 或 `./assets/spark`（storage.js getStpAssetsDir）

| 文件路径（相对 assets/spark/） | 格式 | storage.js 方法 | 何时创建 | 何时更新 |
|------|--------|--------|---------|---------|
| `raw_sparks/raw_sparks.jsonl` | JSONL 追加 | `appendRawSpark()` | 首次 kindle | 每次采集 |
| `raw_sparks/raw_sparks_snapshot.json` | JSON 快照 | `writeRawSparksSnapshot()` | 首次 practice/digest | practice/digest |
| `practice_records/practice_records.jsonl` | JSONL 追加 | `appendPracticeRecord()` | 首次 practice | 每次任务实践 |
| `refined_sparks/refined_sparks.json` | JSON 快照 | `writeRefinedSparks()` | 首次 digest 晋升 | 每次 digest |
| `refined_sparks/refined_sparks.jsonl` | JSONL 追加 | `appendRefinedSpark()` | 首次 digest 晋升 | 每次 digest |
| `capability_map/capability_map.json` | JSON 快照 | `writeCapabilityMap()` | 首次 digest Step 8 | 每次 digest |
| `digest_reports/digest_reports.jsonl` | JSONL 追加 | `appendDigestReport()` | 首次 digest | 每次 digest |
| `embers/embers.json` | JSON 快照 | `writeEmbers()` | 首次 publish | publish/feedback |
| `feedback_log.jsonl` | JSONL 追加 | `appendFeedbackLog()` | 首次反馈 | 每次反馈 |
| `extraction_sessions/sessions.jsonl` | JSONL 追加 | `appendExtractionSession()` | 首次 teach/ingest | 每次萃取 |
| `domains.json` | JSON 快照 | `writeDomains()` | 自动 | 领域变化时 |
| `rl_state.json` | JSON 快照 | rl-engine.js | 首次 RL | 每次 RL |
| `preference_maps/<domain>.json` | JSON 快照 | preference-map.js | 15+ Spark 后 | digest Step 7 |
| `cold_start_plans.json` | JSON 快照 | cold-start-planner.js | 冷启动 | 阶段推进 |
| *GEP:* `genes.jsonl` | JSONL | forge-engine.js | 首次铸造 | Gene 反馈 |

---

## 附录 C: 测试覆盖矩阵

| 采集技术 | 对应测试用例 | STP 阶段 |
|----------|------------|---------|
| 任务嵌入式学习（技术1） | TC-1.1 | 采火 |
| 修改痕迹提炼（技术2） | TC-1.2 | 采火 |
| 闲聊信号捕捉（技术3） | TC-1.3 | 采火 |
| 迭代精修弧（技术4） | TC-1.4 | 采火 |
| 微追问（技术5） | TC-1.5 | 采火 |
| 比较式采集（技术6） | TC-1.6 | 采火 |
| 选择历史归纳（技术7） | TC-1.7 | 采火 |
| 点评式验证（技术8） | TC-1.8 | 采火/传火 |
| 资料导入提炼（技术9） | TC-1.9 | 采火 |
| 对话记录采集（技术10） | TC-1.10 | 采火 |
| 结构化萃取（技术11） | TC-1.11 | 采火 |
| 冷启动协议 | TC-0.1, TC-0.2 | 采火 |
| Digest 复盘 | TC-2.1, TC-2.6 | 炼火 |
| 实践验证 (Search Before Acting) | TC-2.2 | 炼火 |
| Boundary 自动发现 | TC-2.3 | 炼火 |
| Spark 簇检索 | TC-2.4 | 炼火 |
| 知识溯源 | TC-2.5 | 炼火 |
| 技能结晶 | TC-2.7 | 炼火/铸火 |
| 发布 Ember | TC-3.1 | 传火 |
| 社区验证 | TC-3.2 | 传火 |
| 分布式 RLHF | TC-3.3 | 传火 |
| 铸造 Gene | TC-4.1, TC-4.2 | 铸火 |
| GEP 反向通道 | TC-4.3 | 铸火 |

---

## 评分标准

### 单测试用例评分

- **S 级**: Agent 完美执行预期行为，产物变化精确匹配，交互自然流畅
- **A 级**: Agent 执行了主要预期行为，产物基本正确，有小偏差
- **B 级**: Agent 触发了对应的采集/炼化机制，但交互不够自然或遗漏细节
- **C 级**: Agent 能回应但未触发 Sparker 工具
- **D 级**: Agent 完全没有学习行为

### 全流程评分

- **S 级**: 从 TC-0.1 到 TC-4.3 全部通过，Ember 成功铸造为 Gene
- **A 级**: 采火和炼火全部通过，成功产出 Ember
- **B 级**: 采火全部通过，Digest 能产出 RefinedSpark
- **C 级**: 部分采集技术工作，但炼火链路不通
- **D 级**: 无法完成基本的 RawSpark 采集
