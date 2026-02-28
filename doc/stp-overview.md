# STP 火种传递协议 — 四阶段全景介绍

**"人类智慧点燃 AI 能力的开放标准"**

STP（Spark Transmit Protocol）定义了人类知识流入 AI 世界的完整路径。它的核心理念是：人类大量的行业 know-how、经验判断、审美偏好、case-by-case 的解决方案，这些 LLM 预训练数据里没有、prompt 也写不完的"隐性知识"，需要一条标准化的路径被 Agent 系统性地采集、验证、共享、固化。

Sparker 是 STP 的参考实现（开源 skill），安装到任何 OpenClaw Agent 即可获得完整的四阶段能力。

---

## 依赖与配置


| 需求                  | 必需/可选     | 说明                                                                       |
| ------------------- | --------- | ------------------------------------------------------------------------ |
| Node.js >= 18       | 必需        | 运行时环境                                                                    |
| LLM API             | 强烈推荐      | Diff Mining、文档导入、Transcript 提取、偏好画像、铸火均需要 LLM。OpenClaw 用户自动从宿主继承配置，零额外配置 |
| mammoth / pdf-parse | 可选 npm 依赖 | 支持 .docx / .pdf 导入。未安装时自动降级到 pdftotext/pandoc 命令行工具                      |
| SparkHub 服务         | 可选        | 启用社区传火能力。不配置时所有功能在本地运行                                                   |
| Evolver (GEP)       | 可选        | 启用铸火阶段，将高质量 Ember 铸造为 Gene                                               |


**关键环境变量**：


| 变量                          | 默认值              | 说明                                                                       |
| --------------------------- | ---------------- | ------------------------------------------------------------------------ |
| `SPARK_ASSETS_DIR`          | `./assets/spark` | 资产根目录。兼容旧 `STP_ASSETS_DIR`；若 `assets/stp` 存在且 `assets/spark` 不存在，自动使用旧目录 |
| `STP_DIGEST_LOCK_STALE_MS`  | `7200000`（2h）    | Digest 文件锁过期时间（毫秒），防止崩溃后死锁                                               |
| `STP_USER_CONTEXT_CACHE_MS` | `300000`（5min）   | 用户 Memory 画像缓存时长，避免每次创建 Spark 都重新读取                                      |


---

## 架构全景

```
人类 Owner
    │
    │ 使用工具/修改产出/闲聊/教学/上传资料
    ▼
┌────────────────────────────────────────────────────────────────┐
│                     Sparker (STP 实现)                          │
│                                                                │
│  ① 采火 Kindle ──→ ② 炼火 Temper ──→ ③ 传火 Transmit ──→ ④ 铸火 Forge │
│  RawSpark           RefinedSpark       Ember               Gene    │
│  (原始火种)          (精炼火种)         (流通火种)          (能力基因) │
│                                          │                         │
│                                          ▼                         │
│                                     SparkHub                       │
│                                   (全网 Agent 社区)                │
└──────────────────────────────────────┬─────────────────────────────┘
                                       │
                                       ▼
                              Evolver (GEP 基因表达协议)
                             Gene / Capsule / EvoMap
```

---

## 第一阶段：采火 Kindle

> **一句话概括：从人类的日常交互中，用最低的摩擦采集最高密度的隐性知识。**

### 1.1 设计理念与核心优势

用户不喜欢"教 AI"，但喜欢"让 AI 帮我干活然后挑毛病"。采火阶段的核心设计是**把"教学"伪装成"使用"**——用户的主观体验始终是在使用工具，而系统在后台持续捕获知识信号。

**为什么这套机制有效：**

- **基于真实反馈的 RL 学习**：不同于传统的人类标注（expensive, artificial），STP 从用户的真实工作流中采集反馈——每次纠正、每次选择、每次需求澄清都是一个天然的 reward signal。Agent 的行为模式和交付结果会随使用逐步对齐人类偏好，而不是一成不变地输出预训练的"通用最优解"。
- **反馈驱动社区知识优胜劣汰**：用户的满意/不满意反馈不仅改善本地 Agent，还会回传给社区 Spark 的置信度系统。好的经验被不断强化（credibility 上升），不适用的经验自然淘汰（credibility 衰减）。这是一个全网分布式 RLHF。
- **Agent 生态通用性**：STP 捕获的不是 Agent 的工具操作（UI 点击、API 调用、代码编辑），而是**用户对结果的自然语言反馈**。无论 Agent 是在操作手机、写代码、查数据还是画图——纠正和偏好表达始终通过人类语言传递。因此 11 种采集技术天然跨模态，无需为不同 Agent 类型做适配。

### 1.2 十一种采集技术

总览（按用户摩擦度排列）：

| # | 技术 | 摩擦度 | 触发方式 | 代码入口 |
|---|------|--------|---------|---------|
| 1 | 任务嵌入式学习 | ☆☆☆☆☆ | 自动 | `extractor.js`（task_negotiation） |
| 2 | 修改痕迹提炼 | ★☆☆☆☆ | 自动 | `diff-extractor.js` |
| 3 | 闲聊信号捕捉 | ★☆☆☆☆ | 被动 | SKILL.md 行为指令 |
| 4 | 迭代精修弧 | ★☆☆☆☆ | 自动 | `extractor.js`（iterative_refinement） |
| 5 | 微追问 | ★★☆☆☆ | 事件触发 | SKILL.md + `micro-probe-templates.md` |
| 6 | 比较式采集 | ★★☆☆☆ | 决策点 | `rl-engine.js` |
| 7 | 选择历史归纳 | ★★☆☆☆ | 周期 | `preference-map.js` |
| 8 | 点评式验证 | ★★☆☆☆ | 推送 | `feedback.js` |
| 9 | 资料导入提炼 | ★★★☆☆ | 用户主动 | `ingest.js` |
| 10 | 对话记录采集 | ★★★☆☆ | 用户主动 | `transcript-extractor.js` |
| 11 | 结构化萃取 | ★★★★★ | 用户主动 | `extractor.js`（6 步对话） |

---

#### 技术 1：任务嵌入式学习（Task-Embedded Extraction）

**做法**：Agent 在帮用户完成任务的过程中，将每一次需求澄清、中途纠正、参考资料分享静默标记为 Spark。不多问一句为了"学习"的话——所有提问都直接服务于当前任务。

**交互示例**：
> 用户："帮我写一份行业分析报告。"
> Agent："好的，请问目标读者是谁？"
> 用户："给投资人看的，语言要正式，不要口语化。"  ← **静默捕获**：`rule: 投资报告用正式语气`
> Agent（完成初稿后）
> 用户："等等，应该先写结论再展开分析。"  ← **静默捕获**：`pattern: 投资报告结构=结论先行`

**置信度**：0.35（`task_negotiation`，`human_confirmed`）。用户在真实任务中说的话，比闲聊中随口提到的更可靠。

---

#### 技术 2：修改痕迹提炼（Diff Mining）

**做法**：用户修改了 Agent 的输出后，系统分析两个版本的语义差异，提取用户的隐含偏好。聊天场景中用户只给口头修正时，自动归类为 4 种纠正模式。

**交互示例**：
> Agent 交付了一段直播开场白（问候式寒暄）
> 用户："把开场白改成直接报价。"  ← **Pattern A**：直接修正（confidence 0.08）
> 用户："太长了。"  ← **Pattern B**：方向性反馈（confidence 0.05）
> 用户："不要用寒暄，直接上福利。"  ← **Pattern C**：否定+替代（confidence 0.08）
> 用户："因为这个平台用户不吃这套。"  ← **Pattern D**：原因性反馈（confidence 0.10）

单条置信度很低，但 **3+ 条同维度信号在 Digest 中自动归纳**为 confirmed preference。原则：宁可少采，不打断对话流。

---

#### 技术 3：闲聊信号捕捉（Casual Mining）

**做法**：每轮对话中对用户消息做语义级评估（非关键词匹配），识别 6 种知识模式：因果判断、对比评价、条件限制、失败经验、行业惯例、个人偏好。

**交互示例**：
> 用户（闲聊中随口说）："直接报价比先讲故事好使多了。"
> → 静默识别为**对比评价**，创建 candidate spark: `preference: 直接报价 > 先讲故事`（confidence 0.25）
> → 在对话自然间隙用微追问验证（见技术 5）

---

#### 技术 4：迭代精修弧（Iterative Refinement Arc）

**做法**：用户对同一份交付物修改 2 轮以上时，不为每轮单独创建 Spark，而是串成一条"迭代学习弧"，在用户接受最终版本后合成一条综合 Spark。

**交互示例**：
> 第 1 轮：用户要求缩短到 3 页  
> 第 2 轮：用户要求先写结论再分析  
> 第 3 轮：用户删除多余图表  
> 最终接受 → 合成一条 Spark：`pattern: 报告=结论先行，3页以内，控制图表数量`

**置信度**：0.45 起步（随轮次递增，上限 0.60）。经过多轮真实修改确认，极为可靠。

---

#### 技术 5：微追问（Micro-Probe）

**做法**：用户纠正或选择后，嵌入一句"顺嘴就能答"的问题在回复末尾（不单独发消息），确认 Spark 的适用范围。

**交互示例**：
> 用户："把产品介绍压缩到一段。"
> Agent："好的，压缩版来了。话说这是所有品类都这样，还是今天这种低客单价的？"  ← **微追问**
> 用户："低客单价的都这样。"  ← `boundary: 仅限低客单价品类`（confidence 0.40）

每次交互最多 2 次微追问。7 种模板详见 `references/micro-probe-templates.md`。

---

#### 技术 6：比较式采集（Comparative Capture）

**做法**：在非标任务的关键决策点，提供 A/B 选项，从用户选择中推断偏好维度。选项设计上刻意让差异聚焦于一个维度，以获得干净的偏好信号。

**交互示例**：
> Agent："开场有两个方向——A: 紧迫感话术（限时限量），B: 故事引入（场景带入）。你觉得哪个？"
> 用户："A。"  ← `preference: tone维度偏好urgent`
> （如果是 cold_start 域且选项涉及多维度）追问一句："主要是觉得语气更对，还是结构更顺？"

---

#### 技术 7：选择历史归纳（Preference Profiling）

**做法**：当某领域积累 >= 15 条 RawSpark 且距上次画像 >= 7 天时，自动归纳用户偏好维度地图，展示给用户确认。系统预置 4 个通用维度（detail_level / tone / structure / risk_tolerance）用于冷启动，并自动从累积信号中发现领域特有维度。

**交互示例**：
> Agent（Digest 后展示）："我观察到你在直播策划中的偏好是这样的：语气偏紧迫、节奏偏快开慢收、信息密度偏高。准确吗？"
> 用户："信息密度看情况，高客单价的要详细点。"  ← `boundary: 高客单价时信息密度调高`

---

#### 技术 8：点评式验证（Review Capture）

**做法**：向用户推送社区或本地的 Spark 卡片，让用户用"同意/不同意/看情况"进行轻量审阅。一次点评产出两份知识：对被点评 Spark 的验证信号 + 用户回答本身可能是新的边界条件。

**交互示例**：
> Agent 推送卡片："电商直播开场应用紧迫感话术，前30秒留住观众。 [同意] [不同意] [看情况]"
> 用户："看情况。知识分享类直播不能这样。"  ← 验证信号 + 新 Spark: `boundary: 知识分享类直播不适用`

---

#### 技术 9：资料导入提炼（Document Ingestion）

**做法**：用户上传已有文档（PDF/DOCX/PPT/Markdown 等），LLM 自动提取经验规则。分类汇总后展示 Top 3 让用户快速确认，其余"先存着下次用的时候再确认"。

**交互示例**：
> 用户上传《直播运营手册.pdf》
> Agent："提取了 12 条经验，涵盖 3 个方向。最典型的 3 条：
> 1. 客单价 200 以下的品，开场直接报价效果最好。 [对] [不对] [改一下]
> 2. ..."

---

#### 技术 10：对话记录采集（Transcript Extraction）

**做法**：处理会议纪要、录音转写、聊天导出等多人对话数据。使用对话感知 LLM prompt 提取决策、教训、共识和分歧。说话人替换为稳定化名（张总→Person_A）并附带角色描述，保护隐私同时保留跨发言关联性。

**交互示例**：
> 用户上传一份复盘会议纪要
> Agent："从会议中提取了 5 条关键经验：
> 1. Person_A（运营总监）提出：秒杀品放在第 3 个位讲解效果最好。
> 2. 与会者达成共识：开场紧迫感话术仅限百元以下品类。"

长文分块处理（6000 字/块 + 500 字重叠），跨块去重。

---

#### 技术 11：结构化萃取（Structured Extraction）

**做法**：用户主动说"我来教你"时启动的深度模式，通过 6 步对话系统性地提取领域经验。仅在用户主动触发或 Agent 检测到盲区域且用户同意时使用。

**交互示例**：
> Agent："请问您想分享哪个领域的经验？"  ← Step 1: 领域锚定
> 用户："直播开场策略。"
> Agent："具体是什么场景？遇到什么问题？"  ← Step 2: 场景分解
> ...（共 6 步：领域 → 场景 → 规则 → 边界 → 确认 → 深度追问）

---

### 1.3 核心优势

#### 优势一：低门槛、高效率地将人类专家经验转化为 Agent 能力

**这是 STP 最核心的价值主张。**

一个 10 年经验的行业专家，TA 的专业判断力、行业直觉、踩坑教训——这些隐性知识过去只存在于 TA 的脑子里，无法规模化复用。传统的知识转移方式（写 SOP、录课程、带徒弟）成本高、覆盖窄、更新慢。STP 改变了这个等式：

**教学零门槛**：专家不需要懂 AI、不需要写 prompt、不需要学新工具。只要正常使用 Agent 干活——纠正结果、给出偏好、分享经验——知识就在后台被持续捕获。11 种技术中前 4 种对用户**完全无感**，剩下的也只是"顺嘴回答一两个小问题"。

**转化极速**：一个专家花 1-2 小时与 Agent 协作完成几个真实任务，期间自然产出的 Spark 就足以通过 `crystallize` 结晶为一个可安装的领域 Skill。不需要等几周的训练周期——小时级见效。

**一人教学，全网受益**：专家教会了自己的 Agent，这些经验通过 Spark → RefinedSpark → Ember → 社区 → Skill 的路径，可以让全网任何 Agent 获得同样的能力。**一个人的 10 年经验，可以同时赋能 10000 个 Agent。**

这意味着什么：
- **个人层面**：任何行业专家都能快速"复制"一个懂自己的 AI 助手——它了解你的行业规则、审美偏好、决策逻辑，越用越像你带出来的徒弟
- **组织层面**：核心员工的经验不再随离职流失，而是沉淀为可执行的 Skill，新人 + Agent 即刻具备老手的判断力
- **生态层面**：行业专家成为知识的"火种"——TA 不需要亲自服务 1000 个客户，TA 的经验通过 Spark 网络为 1000 个 Agent 赋能，每个 Agent 再服务各自的用户

#### 优势二：基于真实反馈的 RL 式持续进化

STP 构建了一个从"个体反馈"到"群体验证"的闭环：

```
用户使用 Agent → Agent 交付结果 → 用户纠正/选择/评价
                                        │
                     ┌──────────────────┴──────────────────┐
                     ▼                                      ▼
              本地 Spark 积累                         社区 Ember 置信度更新
     (Agent 行为越来越符合该用户偏好)          (好经验被强化，差经验被淘汰)
                     │                                      │
                     ▼                                      ▼
        Preference Map 偏好画像               全网 Agent 共享验证后的知识
        Skill Crystallization                  分布式 RLHF 优胜劣汰
```

不同于传统 RLHF（昂贵的人工标注、脱离真实场景），STP 的每一个 reward signal 都来自用户的真实工作流——每次纠正、每次选择、每次需求澄清。这保证了：

- **个体层面**：Agent 的行为模式和交付结果逐步对齐该用户的真实偏好，而非输出"通用最优解"
- **社区层面**：用户的满意/不满意反馈回传到 Ember 的 credibility 系统，好经验被不断强化，不适用的经验自然淘汰——全网分布式 RLHF
- **持续进化**：不是一次性训练，而是随着使用持续学习。Agent 用得越久，越懂用户；社区越活跃，知识质量越高

### 1.4 冷启动策略：从零开始掌握新领域

当用户要求 Agent 掌握一个全新领域（如"把你打造成 AI 短剧制作师"），系统启动 **5 阶段自主学习协议**：

| 阶段 | 名称 | 方式 | 产出 |
|------|------|------|------|
| Phase 1 | **Research**（调研） | 主动搜索网络 + SparkHub，了解领域全貌 | `web_exploration` 类型 Spark（confidence 0.20） |
| Phase 2 | **Decompose**（拆解） | 将领域拆为子技能树，标注优先级 | 带 P0/P1/P2 的技能拆解图 |
| Phase 3 | **Tooling**（工具盘点） | 盘点所需工具/API/资源，记录能力缺口 | 工具清单 + 缺口报告 |
| Phase 4 | **Skill Crystallization**（技能结晶） | 积累足够知识后打包为可安装 Skill | 领域 Skill 包（见下节） |
| Phase 5 | **Teach**（邀请教学） | 定向邀请用户补充盲区知识 | 高质量 `human_teaching` Spark |

**关键行为**：Agent 在不确定的领域知识上应**主动搜索网络**而非猜测或问用户基础问题。搜索到的有价值结论记录为 `web_exploration` Spark，在后续实践中验证。这一原则不仅限于冷启动——任何阶段遇到知识盲区都应先搜索。

**自适应学习策略**：每个领域独立维护学习阶段，自动切换行为模式：

| 阶段 | 触发条件 | Agent 行为 |
|------|---------|-----------|
| `cold_start` | 领域为盲区或初见 | 最大学习强度：主动提问、密集搜索、多选项对比 |
| `active` | 有一定积累但未熟练 | 平衡模式：任务前先搜 Spark，适度提问 |
| `cruise` | 领域已熟练 | 执行优先：自信使用已有知识，仅在真正不确定时提问 |

### 1.5 技能结晶：将专家经验打包为可安装 Skill

当某领域积累了足够多的 Spark，系统可以将这些散落的知识**打包为一个独立的 OpenClaw Skill**（`SKILL.md` + `references/` + `assets/`），安装到任何 Agent 上即刻具备该领域的专业能力。

**双通道设计**：

| 通道 | 触发条件 | 速度 | 场景 |
|------|---------|------|------|
| 快速通道 | 5+ 条来自可信来源的 RawSpark | 分钟级 | 专家集中教学后立即产出 Draft Skill |
| 有机通道 | 3+ RefinedSpark + 5+ 实践记录 | 积累后 | 日常使用中自然沉淀 |

**交互示例**：
> Agent（检测到用户在"直播策划"领域已教了 12 条经验）：
> "你在直播策划方面教了我不少经验，要不要我帮你打包成一个技能包？以后新的 Agent 装上就能直接用。"
> 用户："好啊。"
> Agent 执行 `crystallize` → 产出 `直播策划/SKILL.md` + `references/domain-rules.md`

**增量更新**：Skill 不是一次性产物。每次重新 `crystallize`，新积累的知识合并进已有 Skill，持续进化：

```
v0.1 (Draft) ← 专家教了 1 小时
  → v0.2 ← 做了 10 个任务，学到更多偏好
    → v0.3 ← 用户纠正了几条规则，新增边界条件
      → v1.0 ← 经过充分实践验证，晋升为正式版
```

**产出结构**：

```
<domain>/
├── SKILL.md              ← 行为指令（规则、偏好、模式、边界条件）
├── references/
│   └── domain-rules.md   ← 详细规则（含置信度和例外）
└── assets/
    └── spark-source.json ← 溯源（哪些 Spark 贡献了本 Skill）
```

代码入口：`src/forge/skill-crystallizer.js`，CLI 命令 `crystallize`。

### 1.6 通用原则与保护机制

**打扰预算**：所有需要用户回应的技术共享预算——cold_start 域 3 次/交互，active 域 2 次，cruise 域 1 次。预算用完后未确认 Spark 排队到下次 Digest。

**Patience-adaptive 机制**：预算上限根据 `patience_score`（用户耐心分）动态调整：

| 用户行为 | 耐心变化 | 效果 |
|---------|---------|------|
| 详细回答追问 | +1 | 预算 +1（乐于教学） |
| 简短回答 | 0 | 不变 |
| 忽略追问 | -2 | 预算 -1 |
| 明确拒绝 | -5 | 切换为静默观察模式 |

**Privacy-by-Design**：
- 绝不提取 PII（姓名、公司、地址、手机号、邮箱）
- `contributor.id` 始终为 `"unknown"`
- 自动注入匿名职业画像（role / industry / experience_level）丰富 Spark 上下文
- 发布为 Ember 时 `sanitizer.js` 再次清理残留 PII
- 对话记录中的说话人替换为稳定化名（Person_A / Person_B）

**常驻学习层**：SKILL.md 定义 5 步核心行为循环（Step 0 → 1 → 1.5 → 2 → 3），覆盖场景感知 → 任务前检索 → 任务中嵌入式学习 → 任务后采集 → 全程被动监听。Agent 启动时自动加载，每轮对话执行。

### 1.7 统一数据结构：Spark Card

所有采集技术的产出统一为 **Spark Card** 结构（定义在 `src/core/spark-card-schema.js`），贯穿从 RawSpark 到 Gene 的全生命周期：

```
heuristic:             一句可操作的规则/偏好/模式
heuristic_type:        rule | preference | pattern | boundary | lesson | data_point
context_envelope:      适用情境（domain, platform, task_phase, 匿名职业画像...）
boundary_conditions:   不适用条件 + 原因
preference_dimensions: 涉及的偏好维度标签（如 tone, detail_level）
evidence:              实践统计（practice_count, success_rate, context_diversity）
```

归纳合并时：`context_envelope` 取**交集**（更严格），`boundary_conditions` 取**并集**（更全面）。

### 1.6 产物与文件结构

**产物**：
- **RawSpark**（原始火种）：人类经验的最小捕获单元
- **ExtractionSession**（萃取会话）：结构化萃取的完整对话记录

**文件结构**：

```
assets/spark/
├── raw_sparks/
│   ├── raw_sparks.jsonl           ← 追加写入日志（永不删除）
│   └── raw_sparks_snapshot.json   ← 最新状态快照
├── extraction_sessions/
│   └── sessions.jsonl             ← 萃取会话日志
├── rl_state.json                  ← RL 引擎状态
├── preference_maps/
│   └── <domain>.json              ← 偏好维度地图
└── .locks/                        ← 文件锁目录（并发保护）
```

### 1.7 代码模块

| 模块 | 作用 |
|------|------|
| `src/kindle/extractor.js` | 统一 RawSpark 创建器：7 种来源模式 + 六步对话萃取 + Memory 画像自动注入 |
| `src/kindle/diff-extractor.js` | 语义 Diff 引擎 + 聊天场景 4 种 pattern 分类 |
| `src/kindle/ingest.js` | 文档导入引擎（.md/.txt/.csv/.json/.docx/.pdf/.pptx） |
| `src/kindle/transcript-extractor.js` | 对话记录采集：对话感知 LLM 提取 + 稳定化名 + 分块去重 |
| `src/kindle/rl-engine.js` | RL 偏好推断 + 维度分解 + patience_score 耐心追踪 |
| `src/kindle/cold-start-planner.js` | 5 阶段冷启动学习规划 |
| `src/core/spark-card-schema.js` | 统一 Spark Card Schema + 卡片合并逻辑 |
| `src/core/preference-map.js` | 偏好画像引擎：4 通用维度冷启动 + 自动维度发现 |
| `src/core/adaptive-strategy.js` | 自适应学习策略：cold_start / active / cruise |
| `src/core/user-context.js` | 匿名职业画像适配器（读取 OpenClaw memory/） |
| `src/core/file-lock.js` | 文件锁：防止并发写冲突 |


---

## 第二阶段：炼火 Temper

> **一句话概括：让采集到的知识在本地高效炼化、沉淀，保证 Agent 在每次任务中都能调出对的 Spark、在对的场景下用对的方式影响输出。**

### 2.1 核心目标与设计思路

采火阶段产出的 RawSpark 是"可能有用"的状态——有些来自推断（Diff Mining），有些来自只说了一次的经验。**知识被采集了不等于知识会被使用，使用了不等于用对了。** 炼火阶段要解决的是：让 Spark 在用户后续任务中真正发挥作用。

**正向循环的关键翻转**：Spark 被有效使用 → 用户看到 AI 变聪明了 → 用户更愿意教/给反馈 → 更多高质量 Spark → 更有效的使用。翻转这个循环的杠杆点在**检索 → 组装 → 应用 → 反馈**这条链路的质量。

### 2.2 智能检索：任务意图解析

**问题**：TF-IDF 关键词匹配对语义相关但表述不同的 Spark 会大量漏检（如"吸引观众停留的开头" vs "电商直播开场紧迫感话术"）。

**方案**：在 TF-IDF 之前加一层任务意图解析（`task-intent-parser.js`），将用户任务描述展开为结构化检索键，匹配 Spark Card 的 `context_envelope`：

```
用户: "帮我写一段吸引观众停留的开头"
  → 意图解析（LLM轻量/规则降级）:
    domain: "直播策划", sub_domain: "开场策略", objective: "提升观众停留"
  → context_envelope 匹配 → 命中 "电商直播开场应用紧迫感话术"
  → 再用 TF-IDF 精排
```

成本极低：LLM 调用仅需几十个输出 token；不可用时自动降级为关键词规则映射。

### 2.3 动态约束组装：冷启动门槛折扣

**问题**：固定阈值在冷启动期几乎无 Spark 能成为硬约束，用户觉得"教了白教"。

**方案**：约束分级从固定阈值改为 `heuristic_type × credibility × 领域阶段` 三维矩阵：

| heuristic_type | 硬约束基础阈值 | 软约束基础阈值 | 最低实践次数 |
|---------------|-----------|-----------|-----------|
| rule | 0.65 | 0.35 | 1 |
| pattern | 0.75 | 0.45 | 2 |
| preference | **永不**硬约束 | 0.40 | 0 |
| boundary | 0.55 | 0.25 | 1 |

**领域阶段乘数**：`cold_start` × 0.7、`active` × 0.85、`cruise` × 1.0。冷启动期一条 `human_teaching` 的 rule（初始 credibility ~0.50）只需 0.455 就能成为硬约束——用户几乎立刻就能看到 Agent "记住了"。

**关键设计**：boundary 门槛最低，因为"知道什么不该做"比"知道该怎么做"更有安全价值；preference 永不硬约束，因为偏好天然是 context-dependent 的。

### 2.4 Spark 簇：从散点到知识网络

**问题**：每条 Spark 检索和应用时都是孤立的。"开场用紧迫感话术"不知道系统里还有"但高端品除外"和"配合倒计时效果更好"。

**方案**：基于 `chain-detector.js` 已有的关系检测，将 supports/refines 关系相连的 Spark 聚合成"簇"（`spark-cluster.js`）。检索时以簇为单位返回：

```
Spark 簇: "开场策略"
  核心: "开场用紧迫感话术" (credibility 0.82)
  细化: "配合倒计时效果翻倍" (credibility 0.71)
  细化: "高端品除外，改用专业讲解式" (credibility 0.68)
  矛盾警告: "紧迫感过强会吓跑犹豫型客户" (credibility 0.35)
```

簇在 Digest 步骤 4.5 自动构建和缓存（`clusters/clusters.json`）。**搜索时已完整接入**：`search.js` 在检索完成后调用 `expandWithClusters()` 自动扩展结果——命中一条 Spark 即拉出整个簇，Agent 拿到的不再是散点，而是完整的知识单元（核心规则 + 所有例外条件 + 补充细节 + 矛盾警告）。

### 2.5 知识溯源可见化

**问题**：即使 Spark 确实影响了输出，如果用户感知不到"AI 用了我之前教它的东西"，正向循环不会启动。

**方案**：在 SKILL.md 行为指令中加入溯源规则（每次任务最多提及 1-2 条）：

- **行内自然提及**："开场我用了紧迫感话术+倒计时——按你之前说的。"
- **结尾简短说明**："这版参考了你之前的两个反馈：开场直接上价格、互动插在第三品之后。"
- **变化对比**："上次你觉得产品介绍太长了，这次我精简到了每品90秒。长度还行吗？"

**关键约束**：只对高置信度 Spark 做溯源。错误的溯源（"按你之前说的XXX"但理解错了）比不溯源造成的信任损失更大。

### 2.6 标准/创意双模式约束策略

**自动模式检测**：`preference-map.js` 的 `detectTaskMode(domain)` 在 Digest 时自动分析该领域 Spark 的 `heuristic_type` 分布——preference/pattern 占比 > 50% 判定为创意领域，否则为标准领域。检测结果缓存在 `preference_maps/<domain>.json` 的 `task_mode` 字段，Agent 零成本读取。

**标准模式**（技术/流程类任务）：硬约束 > 软约束 > 偏好参考。偏好做 tie-breaking。

**创意模式**（策划/文案/审美类任务）：边界条件（避坑）> 偏好指导（匹配风格）> 规则参考。执行前加载用户**预生成偏好人设文本**注入 prompt：

```
该用户在「直播策划」领域的偏好画像：
强偏好：语气风格偏好紧迫感驱动、节奏偏好快节奏高密度。
明确反感：开场方面不喜欢冗长铺垫和寒暄式开场。
注意事项：高端品除外，改用专业讲解式。
```

**偏好人设预生成**：`generatePersonaText(domain)` 在 Digest 步骤 7.2 自动从偏好画像生成自然语言人设描述，缓存在 `preference_maps/<domain>.json` 的 `persona_text` 字段。Agent 直接读取，零 LLM 成本注入。

人设式注入比规则式更灵活——Agent 不是机械执行"开场用紧迫感"，而是理解用户偏好后自主判断，即使遇到未覆盖的新场景也能做出合理决策。

### 2.7 Boundary 自动发现

**问题**：Spark 的边界条件只靠用户主动教（采火阶段的 teach），覆盖不全。

**方案**：`boundary-discovery.js` 在 Digest 步骤 3.5 自动分析 PracticeRecord——对比同一 Spark 在 accepted 和 rejected 记录中的 `task_context_envelope` 差异，找出 rejected 记录共有但 accepted 记录没有的特征：

```
"开场用紧迫感话术":
  5 次 "日常促销" → accepted
  2 次 "新品首发" → rejected
  → 自动发现候选 boundary: "新品首发场景不适用"（pending_verification）
```

候选 boundary 先以 `pending_verification` 状态进入 Spark Card，下次遇到相同场景时 Agent 自动降级约束等级试探。用户满意 → 该 boundary 正式生效。**Spark 的边界条件从实践失败中自动生长，用户不需要事先想到所有例外。**

### 2.8 Context Envelope 渐进式发现

**问题**：`context_envelope` 的预定义字段（domain, platform 等）未必适用于所有领域，`extra` 字段又缺乏引导。

**方案**：`context-discovery.js` 在 Digest 步骤 7.5 统计每个领域 practice_records 中频繁出现的 `task_context_envelope` 字段。超过 30% 出现率的字段升级为该领域的"推荐字段"，写入 `preference_maps/<domain>.json` 的 `recommended_context_fields`。后续创建 Spark 时 LLM 会被显式要求提取这些字段。

### 2.9 归纳合并完整性检查（语义级）

Digest 步骤 4 将多条 RawSpark 合并为 RefinedSpark 时，`promoter.js` 自动执行完整性检查：

- 所有源 Spark 的 `boundary_conditions` 是否出现在合并结果中——使用 **TF-IDF 余弦相似度**（阈值 0.55）而非字符串匹配，因此"黄金时段前30分钟发"≈"高峰前半小时推送"能被识别为等价（缺失 → 自动补回 + 标记 `merge_issues`）
- 合并后的 `context_envelope` 是否过度泛化（源限定了平台但合并后丢失限制 → 中风险警告）

发现 issue 不会阻塞 Digest 流程，但会在下次复盘时提示用户确认。

### 2.10 提纯机制

**机制 A：持续实践验证 + 加权反馈 + 自动归因**

```
Agent 执行任务 → 检索相关 Spark（意图解析 + TF-IDF + 簇扩展）
  → 约束组装（动态阈值 × 领域阶段）
  → 应用到任务中（标准/创意双模式）
  → 溯源提及（高置信度 Spark）
  → 记录 PracticeRecord（含 task_context_envelope 快照）
    → outcome = accepted: confidence += 0.15 × impactWeight
    → outcome = rejected: 自动归因（见下方）+ confidence -= 0.20 × impactWeight
    → outcome = partial:  confidence += 0.05 × impactWeight
```

**加权反馈**：每条 Spark 的置信度变化按其 `usage_type` 加权——`hard_constraint`（权重 1.0）全额承担结果，`preference_guide`（权重 0.3）仅轻微影响，`background_reference`（权重 0.1）几乎不受影响。这避免了"背景参考的 Spark 因为主约束导致的失败而被误杀"。

**Rejected 自动归因**：当任务失败且涉及多条 Spark 时，`feedback.js` 的 `assignBlame()` 按 usage_type 权重自动计算每条 Spark 的 `blame_ratio`，标记 `primary_suspect`。权重极低的 Spark（blame_ratio < 0.15）的负面结果从 rejected 降级为 partial，避免无辜 Spark 被连坐。Agent 也可以在 `sparks_used` 中手动标记 `blamed: true` 精确归因。

**机制 B：周期性复盘（Digest，12 步流程）**

每 12 小时（可配置）自动触发：

| 步骤 | 动作 | 产出 |
|------|------|------|
| 1 | 汇总周期内所有 RawSpark | 按领域分组的 Spark 列表 |
| 2 | 按领域分组 | 跨领域归纳支持 |
| 3 | 分析 PracticeRecord | 每条 Spark 的实践统计 |
| 3.5 | **Boundary 自动发现** | 候选边界条件（pending_verification） |
| 4 | 归纳提炼 + **完整性检查** | 新 RefinedSpark（含 merge_issues） |
| 4.5 | **Spark 簇构建** | clusters.json 缓存 |
| 5 | 时间衰减 + 不活跃衰减 | 过时知识自然下沉 |
| 6 | 晋升/淘汰决策 | 标记 publish_ready 或 rejected |
| 7 | 偏好画像归纳 | 按领域的结构化偏好画像 |
| 7.2 | **偏好人设预生成 + 模式检测** | persona_text 缓存 + task_mode 标记 |
| 7.5 | **Context 维度发现** | 推荐情境字段列表 |
| 8 | 重建能力图谱 + 盲区检测 | 能力地图更新 |
| 9 | 推送点评卡片 | 社区 Spark 待审阅列表 |

**晋升条件（RawSpark → RefinedSpark）：**

- 内部置信度 >= 0.60
- 实践次数 >= 2
- 成功率 >= 60%
- 来源已确认（human_confirmed 或 practice_verified）

### 并发保护与数据安全

1. **文件锁（file-lock.js）**：Digest 通过 `mkdirSync` 原子创建锁目录，防止并发执行。支持过期清理（默认 2 小时）。
2. **原子写入（storage.js）**：所有 JSON 写入使用 `write-to-tmp + rename` 模式，避免并发读到半写文件。

### 沉淀形式

**RefinedSpark** 是信息密度最高的资产类型，包含：

```json
{
  "type": "RefinedSpark",
  "domain": "直播策划.开场策略",
  "summary": "电商直播开场应用紧迫感话术而非问候式寒暄",
  "card": { "heuristic": "...", "context_envelope": {}, "boundary_conditions": [] },
  "insight": {
    "do_list": ["开场30秒内抛出价格锚点", "使用倒计时制造紧迫感"],
    "dont_list": ["长时间寒暄", "铺垫超过1分钟"],
    "rules": ["开场话术 = 紧迫感 + 价格信息 + 时间限制"],
    "expected_outcome": "前30秒观众留存率提升40%"
  },
  "applicable_when": ["电商直播", "客单价 < 500"],
  "not_applicable_when": ["知识分享类直播", "客单价 > 500 需改用专业讲解式"],
  "merge_issues": [],
  "credibility": { "internal": {"score": 0.78}, "external": {"score": 0.5}, "composite": 0.72 }
}
```

### 保存形式

```
assets/spark/
├── refined_sparks/
│   ├── refined_sparks.json        ← 快照
│   └── refined_sparks.jsonl       ← 追加日志
├── practice_records/
│   └── practice_records.jsonl     ← 实践记录（含 task_context_envelope 快照）
├── clusters/
│   └── clusters.json              ← Spark 簇缓存
├── capability_map/
│   └── capability_map.json        ← 能力图谱
└── digest_reports/
    └── digest_reports.jsonl       ← 复盘报告
```

### 代码模块

| 模块 | 作用 |
|------|------|
| `src/temper/digest.js` | 12 步复盘流程主控制器 |
| `src/temper/promoter.js` | 晋升引擎：相似 Spark 分组 + 合成 RefinedSpark + **归纳完整性检查** |
| `src/temper/task-intent-parser.js` | **任务意图解析**：LLM 轻量解析 + 关键词规则降级 → 结构化检索键 |
| `src/temper/spark-cluster.js` | **Spark 簇聚合**：关系连通 Spark → 知识单元，搜索时以簇返回 |
| `src/temper/boundary-discovery.js` | **Boundary 自动发现**：从 practice 成功/失败对比中自动生长边界条件 |
| `src/temper/context-discovery.js` | **Context 维度发现**：统计 practice 中的高频情境字段，推荐给新 Spark |
| `src/temper/decay.js` | 时间衰减：置信度随时间和不活跃自然下降 |
| `src/temper/chain-detector.js` | 火种链检测：supports/contradicts/refines/supersedes 关系 |
| `src/core/credibility.js` | 双维度置信度引擎 + context_diversity 加成 |
| `src/core/capability-map.js` | 能力图谱：领域覆盖度、掌握等级、盲区检测 |


### 技能结晶（Skill Crystallization）

> **核心价值：将非 AI 专业人士的行业 know-how 快速转化为可安装、可迁移的 OpenClaw Skill。**

技能结晶是炼火阶段的一个重要产出——它把散落在 Spark 中的领域知识打包成一个独立的技能包（SKILL.md + references + assets），可以安装到任何 OpenClaw Agent 上，让一个什么都不懂的 Agent 立刻具备该领域的专业能力。

**双通道设计**：


| 通道   | 触发条件                      | 输入                  | 速度  | 场景       |
| ---- | ------------------------- | ------------------- | --- | -------- |
| 快速通道 | 5+ 条来自可信来源的 RawSpark      | RawSpark 直接使用       | 分钟级 | 专家集中教学后  |
| 有机通道 | 3+ RefinedSpark + 5+ 实践记录 | RefinedSpark + 偏好画像 | 积累后 | 日常使用自然沉淀 |


**快速通道是为行业专家设计的**。一个 10 年经验的直播策划师花 1 小时教 Agent（通过 teach 流程 + 上传资料 + 做几个任务），就能产出一个可用的 Draft Skill。不需要等 Digest 周期或实践验证。

**可信来源**：human_teaching、human_feedback、task_negotiation、iterative_refinement、document_ingestion、transcript_extraction、micro_probe、review。

**增量更新**：Skill 不是一次性产物。每次对同一领域重新执行 `crystallize`，新积累的知识会合并进已有 Skill。随着 Agent 持续学习，Skill 不断进化：

```
v0.1 (Draft) ← 专家教了1小时
  → v0.2 ← 做了10个任务，学到更多偏好
    → v0.3 ← 用户纠正了几条规则，新增边界条件
      → v1.0 ← 经过充分实践验证，晋升为正式版
```

**产出结构**：

```
<domain>/
├── SKILL.md              ← 行为指令：规则、偏好、模式、边界条件
├── references/
│   └── domain-rules.md   ← 详细规则（含置信度和例外）
└── assets/
    └── spark-source.json ← 溯源：哪些 Spark 贡献了本 Skill
```

**代码入口**：`src/forge/skill-crystallizer.js`，CLI 命令 `crystallize`。

---

## 第三阶段：传火 Transmit

> **一句话概括：将本地验证过的知识安全地发布到社区，通过全网 Agent 的分布式 RLHF 持续验证，让所有人类的经验能跨 Agent 流通。**

### 发布流程

```
RefinedSpark（本地精炼知识）
  → 数据脱敏（sanitizer.js）
      ✗ 移除：PII（姓名、公司、地址、邮箱、手机号）
      ✗ 移除：context 对象整体（可能含敏感任务细节）
      ✓ 保留：card.context_envelope 中的匿名职业属性
              （contributor_role, contributor_industry, experience_level）
      ✓ 匿名化：contributor.id → "contributor_0"
  → Owner 确认（碳基优先原则：人类有最终决策权）
  → 生成 Ember（脱敏后的社区流通形态）
  → 发布到 SparkHub
  → 进入 candidate 状态
```

### 隐私保护：三级分级


| 级别        | 流通范围        | 处理方式           |
| --------- | ----------- | -------------- |
| `private` | 仅本 Agent    | 不上传，不脱敏，完全本地   |
| `circle`  | 指定信任圈       | 加密存储，圈层密钥访问    |
| `public`  | SparkHub 全网 | 脱敏后发布，Owner 确认 |


**隐私级别只能提升（private → circle → public），不可降级。** 已公开的可以"撤回"（revoke），但已传播的副本由各节点自行决定是否保留。

**匿名职业上下文的流通**：发布为 Ember 后，Spark 的 `card.context_envelope` 仍携带 `contributor_role`（职业）、`contributor_industry`（行业）、`experience_level`（经验）。这些属于非个人标识的职业属性，有助于下游 Agent 判断 Spark 的适用性，同时不暴露贡献者身份。

### 全世界人类的分布式 RLHF

当任何 Agent 在任务中引用了某个 Ember，其用户的反馈自动更新该 Ember 的外部置信度：

```
Agent A 检索 Ember → 应用于任务 → 用户反馈（满意✓/不满意✗/有条件✤）
                                        │
                                        ▼
                                SparkHub 更新 Ember 可信度
                                        │
                                        ▼
                              全网 Agent 看到更新后的分数
```

**反馈权重按领域声誉加权**：一个在"直播策划"领域 credibility 0.9 的 Agent 的投票，比从未接触过直播的 Agent 的投票权重大得多。

### 使用其他 Agent 的 Spark

**搜索与约束组装**：Agent 执行任务前搜索相关 Ember，结果自动分为三层：

约束分级阈值**按 heuristic_type 动态调整**（preference 类永远不做硬约束）：


| heuristic_type  | 硬约束阈值                   | 软约束范围     |
| --------------- | ----------------------- | --------- |
| rule（规则类）       | >= 0.70 (practice >= 3) | 0.40-0.70 |
| pattern（模式类）    | >= 0.80 (practice >= 5) | 0.50-0.80 |
| preference（偏好类） | 不作为硬约束                  | >= 0.50   |
| boundary（边界类）   | >= 0.60 (作为排除规则)        | 0.30-0.60 |


```
【硬约束 — 直接应用（阈值按类型动态）】

【软约束 — 酌情参考】

【偏好参考 — 来自用户历史选择】
  来自本地 preference dimension map → 作为风格指导
```

搜索使用 **Top-p 核采样**而非简单排序——高质量 Ember 优先使用，但新发布的低排名 Ember 也有翻盘机会。

### 点评机制

```
┌────────────────────────────────────────────┐
│ 💡 直播策划 · 开场策略                       │
│                                            │
│ "电商直播开场应该用紧迫感话术，而不是         │
│  问候式寒暄，这样能在前30秒留住更多观众。"     │
│                                            │
│ 置信度: 0.72 · 来源: 5 位策划师验证           │
│                                            │
│  [✅ 同意]   [❌ 不同意]   [🤔 看情况]       │
└────────────────────────────────────────────┘
```

选择"看情况"时追问一句"什么情况下不适用？"——一次点评同时产生两份知识：

1. 对被点评 Spark 的验证信号（置信度更新）
2. 点评者的回答本身作为新的边界条件 RawSpark

### Ember 晋升条件（candidate → promoted）


| 条件    | 阈值      |
| ----- | ------- |
| 外部置信度 | >= 0.50 |
| 引用次数  | >= 3    |
| 点赞数   | >= 5    |
| 赞踩比   | >= 70%  |


### 保存形式

```
assets/spark/
├── embers/
│   └── embers.json                ← 已发布 Ember 的本地缓存
├── feedback_log.jsonl             ← 反馈事件日志
└── a2a/outbox/                    ← STP-A2A 协议发件箱
```

### SparkHub（社区基础设施）

SparkHub 是 Ember 的流通市场，已有初版实现，提供：

- 混合搜索：向量嵌入 + 全文检索 + 子串匹配三级降级
- 投票与声誉系统
- 领域目录与统计
- 火种链关系图谱查询
- REST API（20+ 端点）

### 代码模块


| 模块                           | 作用                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/transmit/sanitizer.js`  | 数据脱敏：PII 去除、敏感词检测、隐私保护                                                                           |
| `src/transmit/publisher.js`  | 发布引擎：RefinedSpark → Ember + Owner 确认流程                                                           |
| `src/transmit/hub-client.js` | SparkHub 客户端：stp-a2a 协议消息构建、HTTP/文件传输                                                            |
| `src/transmit/search.js`     | 搜索引擎：本地+远端混合搜索、Top-p 核采样、约束组装                                                                    |
| `src/transmit/feedback.js`   | 分布式 RLHF：positive/negative/suggestion/review 反馈 + Contribution Trail（含 `value_attribution` 预留字段） |


---

## 第四阶段：铸火 Forge

> **一句话概括：将经过全网充分验证的高质量 Ember 铸造为 GEP Gene——从人类经验到 Agent 永久可执行能力的最终转化，与 Evolver/EvoMap 无缝衔接。**

### 铸造条件（必须全部满足）


| 条件           | 阈值      | 含义                     |
| ------------ | ------- | ---------------------- |
| 复合置信度        | >= 0.85 | 内外部都充分验证               |
| 引用次数         | >= 8    | 被广泛使用                  |
| 加权赞踩比        | >= 80%  | 正面评价压倒性多数              |
| 独立验证 Agent 数 | >= 5    | 多个 Agent 独立验证          |
| 存活时间         | >= 14 天 | 经过时间考验                 |
| **情境多样性**    | >= 0.40 | 在至少 40% 不同类型情境中被验证（新增） |


### 铸造流程（5 步）

```
Step 1: 结构化转译（AI 辅助）
  insight.do_list → Gene.strategy（可执行步骤）
  insight.dont_list → Gene.constraints.forbidden_actions
  applicable_when → Gene.preconditions
  keywords + task_type → Gene.signals_match

Step 2: 约束推导
  从实践记录推导安全约束（max_files、forbidden_paths）
  默认保守值（比普通 Gene 更严格）

Step 3: 验证命令生成
  从成功的 PracticeRecord 归纳验证条件

Step 4: 试运行验证
  生成的 Gene 至少在 1 次真实任务中成功执行
  失败 → 退回 Ember，标记 forge_failed

Step 5: 正式铸造
  Gene + Capsule 写入 GEP 目录
  Ember 状态更新为 "forged"
  携带 forged_from 溯源元数据
```

### 与 Evolver/EvoMap 的联动

**STP → GEP（铸火通道）**

铸造产生的 Gene 写入 Evolver 的 `assets/gep/` 目录，携带 STP 溯源信息：

```json
{
  "type": "Gene",
  "forged_from": {
    "protocol": "stp",
    "ember_id": "ember_xxx",
    "contributor_chain": [{"type":"human","id":"owner"}, {"type":"agent","id":"node_xxx"}],
    "composite_credibility_at_forge": 0.88
  }
}
```

Evolver 在后续的进化周期中会将这些 Gene 纳入选择池。如果配置了 EvoMap，Gene 还会被发布到 EvoMap 市场，供全网 Agent 使用和交易。

**GEP → STP（反馈通道）**

Gene 在 GEP 执行周期中的结果反向传播到源 Ember：


| Gene 执行结果   | 对源 Ember 的影响               |
| ----------- | -------------------------- |
| 执行成功        | internal credibility +0.05 |
| 执行失败        | internal credibility -0.10 |
| Gene 被拒绝/撤销 | Ember 回退为 candidate 状态     |


**GEP 选择阶段的 Spark 影响**

STP 在 GEP 进化生命周期的"选择"阶段注入一个额外评分维度——`spark_relevance`。这使得 Agent 在选择 Gene 时会参考相关 Spark 的建议，形成"人类经验指导 Agent 进化"的效果。

### 保存形式

铸造产生的 Gene 写入 Evolver 的目录：

```
skills/evolver-main/assets/gep/
├── genes.json    ← Gene 快照
├── genes.jsonl   ← Gene 追加日志
├── capsules.json ← Capsule（Gene 的执行日志）
└── events.jsonl  ← 进化事件日志
```

### 代码模块


| 模块                                | 作用                                             |
| --------------------------------- | ---------------------------------------------- |
| `src/forge/forge-engine.js`       | 铸造引擎：5 步铸造流程、AI 辅助结构化转译 + 机械回退、Gene 构建与验证      |
| `src/forge/skill-crystallizer.js` | 技能结晶：领域知识 → 可安装 Skill（快速/有机双通道 + 增量更新）         |
| `src/forge/gep-bridge.js`         | GEP 桥接：STP↔GEP 双向互操作、反向信号通道、spark_relevance 注入 |


---

## 双螺旋关系：STP × GEP

STP 和 GEP 是 ACEP（AI 文明演进大协议）的双螺旋：


| 维度   | GEP（基因表达协议）    | STP（火种传递协议）                   |
| ---- | -------------- | ----------------------------- |
| 进化隐喻 | 生物进化（突变+选择）    | 文化进化（传承+验证）                   |
| 知识来源 | Agent 自身实践     | 人类经验 + 社区智慧                   |
| 核心资产 | Gene, Capsule  | RawSpark, RefinedSpark, Ember |
| 人类角色 | 审查者（可选）        | **老师和贡献者**（核心）                |
| 核心价值 | 让 Agent 更**强** | 让 Agent 更**智**                |
| 社区   | EvoMap         | SparkHub                      |
| 可迁移性 | .gepx          | .stpx                         |
| 交汇点  | ← 接收铸火产出       | 铸火 → 输出到 GEP                  |


GEP 管 Agent 自己怎么进化（自下而上），STP 管人类知识怎么注入（自上而下）。两者通过铸火通道和反馈通道双向互操作，形成完整的知识闭环。

---

## 完整代码架构

```
sparker/
├── SKILL.md                          # Agent 系统提示词（注入 Agent 行为指令）
├── README.md                         # 人类文档
├── package.json                      # 元数据 + 可选依赖（mammoth, pdf-parse）
├── index.js                          # CLI 主入口（24 个命令，含 ingest --transcript）
│
├── src/
│   ├── core/                         # ═══ 基础设施层 ═══
│   │   ├── asset-id.js               # 内容寻址：SHA-256 哈希
│   │   ├── storage.js                # 统一存储层：JSONL + JSON（原子写入）
│   │   ├── credibility.js            # 双维度置信度 + context_diversity
│   │   ├── capability-map.js         # 能力图谱
│   │   ├── spark-card-schema.js      # 统一 Spark Card Schema（全生命周期 + 合并逻辑）
│   │   ├── preference-map.js         # 偏好维度地图（4 通用维度 + 自动维度发现 + 模式检测 + 人设预生成）
│   │   ├── adaptive-strategy.js      # 自适应学习策略
│   │   ├── similarity.js             # CJK bigram TF-IDF
│   │   ├── openclaw-config.js        # LLM/Embedding 配置自动检测
│   │   ├── user-context.js           # 职业画像适配器：读取 memory/ 注入匿名专业上下文
│   │   └── file-lock.js              # 文件锁：防止 daemon 与 gateway 并发写冲突
│   │
│   ├── kindle/                       # ═══ 阶段1: 采火 ═══
│   │   ├── extractor.js              # 7 种采集模式（含任务嵌入+迭代精修）+ Spark Card + Memory 画像注入
│   │   ├── diff-extractor.js         # 语义 Diff + 聊天 4 种 pattern 细粒度分类
│   │   ├── ingest.js                 # 文档导入引擎（支持 PDF/DOCX/PPTX）
│   │   ├── transcript-extractor.js   # 对话记录采集：会议纪要/录音转写/稳定化名
│   │   ├── rl-engine.js              # RL 偏好推断 + 维度分解 + patience_score 耐心追踪
│   │   └── cold-start-planner.js     # 5 阶段冷启动学习规划
│   │
│   ├── temper/                       # ═══ 阶段2: 炼火 ═══
│   │   ├── digest.js                 # 12 步复盘流程（含 boundary 发现 + 簇构建 + context 发现）
│   │   ├── promoter.js               # 晋升引擎（合并 + 语义完整性检查 + 自动补回丢失 boundary）
│   │   ├── task-intent-parser.js     # 任务意图解析：LLM 轻量解析 + 规则降级
│   │   ├── spark-cluster.js          # Spark 簇聚合：关系连通 Spark → 知识单元
│   │   ├── boundary-discovery.js     # Boundary 自动发现：practice 成功/失败对比
│   │   ├── context-discovery.js      # Context 维度发现：高频情境字段推荐
│   │   ├── decay.js                  # 时间衰减
│   │   └── chain-detector.js         # 火种链检测
│   │
│   ├── transmit/                     # ═══ 阶段3: 传火 ═══
│   │   ├── sanitizer.js              # 数据脱敏
│   │   ├── publisher.js              # 发布引擎
│   │   ├── hub-client.js             # SparkHub 客户端
│   │   ├── search.js                 # 意图增强搜索 + 动态阈值×领域阶段约束组装 + 簇扩展（已接入）
│   │   └── feedback.js               # 分布式 RLHF + Contribution Trail + 加权反馈 + 自动归因
│   │
│   ├── forge/                        # ═══ 阶段4: 铸火 + 结晶 ═══
│   │   ├── forge-engine.js           # 5 步铸造 + context_diversity 门槛
│   │   ├── skill-crystallizer.js     # 技能结晶：领域知识→可安装 Skill（快速+有机双通道）
│   │   └── gep-bridge.js             # STP↔GEP 双向桥接
│   │
│   └── ops/                          # ═══ 运维工具 ═══
│       ├── migration.js              # 旧系统迁移
│       ├── stpx-export.js            # .stpx 导出
│       ├── stpx-import.js            # .stpx 导入
│       └── lifecycle.js              # 守护进程
│
└── references/                       # ═══ 参考文档 ═══
    ├── stp-spec.md                   # 协议原始规范
    ├── stp-schema.md                 # 配置变量参考
    ├── stp-overview.md               # 四阶段全景介绍（本文档）
    ├── micro-probe-templates.md      # 7 种微追问模板库（按场景分类）
    └── test-playbook.md              # 测试用例
```

