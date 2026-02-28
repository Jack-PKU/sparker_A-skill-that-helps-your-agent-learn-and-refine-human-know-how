# 对话测试偏差报告 V2（修复后）

> **测试时间**: 2026-02-26  
> **Session ID**: coffee-e2e-1772121561  
> **模型**: MiniMax-M2.5 (195k ctx)  
> **修复内容**: SOUL.md 新增 Learning 段落 / AGENTS.md 内联 Sparker 行为循环 + CLI 模板 / SKILL.md frontmatter `always:true` / storage.js CWD bug fix  
> **对比基准**: test-e2e-coffee-roasting.md  

---

## 改善总结

与 V1 测试相比：

| 指标 | V1（修复前） | V2（修复后） | 变化 |
|------|------------|------------|------|
| Spark 捕获总数 | 0（需显式指令才创建 7 条低质量 spark） | **8 条**（自动触发） | ✅ 大幅改善 |
| 自动触发 Kindle | ✗ 从未自动触发 | **部分自动触发**（约 50% 教学轮次） | ✅ 改善 |
| Spark 质量 | card=null, domain=English, contributor_expertise=默认 | **card 有效, domain 合理, heuristic 精练** | ✅ 大幅改善 |
| 冷启动计划 | ✗ 未触发 | ✗ 仍未触发 | ➖ 未改善 |
| 多源 source 识别 | ✗ 仅 human_teaching | ✗ 仍仅 human_teaching | ➖ 未改善 |

---

## 偏差明细

### D-1: 冷启动协议未触发 [Critical]

**TC**: TC-0.1  
**预期**: Agent 识别全新领域 → `plan 咖啡烘焙 "精品咖啡烘焙专家"` + `status` → 创建 cold_start_plans.json + capability_map 初始化  
**实际**: Agent 直接回复"我准备好了，来第一课"，未执行 `plan` 或 `status`，无 cold_start_plans.json，无 capability_map  
**Spark 产出**: 0 条（预期 0 条，但应有 plan 产物）

**根因**: AGENTS.md 的 Sparker 行为循环中有 `plan` 命令模板，但触发条件（"当新领域首次出现时"）对 MiniMax-M2.5 来说不够明确。模型不理解"12年烘焙经验"意味着这是一个全新领域的教学开始。

---

### D-2: 任务嵌入式学习未静默捕获（TC-1.1）[High]

**TC**: TC-1.1  
**预期**: 用户给出采购标准（水分10-12%、瑕疵≤5/350g、海拔≥1800m）→ Agent 静默 kindle 3 条 spark，source=`task_negotiation`, confidence=0.35  
**实际**: Agent 完成任务（更新 markdown 文件），但**未执行任何 kindle 命令**。用户的采购标准完全丢失。  
**Spark 产出**: 0 条（预期 3 条）

**根因**: 模型在任务模式（写文件/更新 markdown）时不会同步执行 kindle。AGENTS.md 说"当用户教/纠正时静默捕获"，但模型把"帮我写评估单 → 用户给标准"理解为任务执行，不是教学。

---

### D-3: Diff Mining 四种修正模式均未捕获（TC-1.2）[High]

**TC**: TC-1.2  
**预期**: 4 种修正模式（直接修正、方向性反馈、否定+替代、原因性反馈）各产生 1 条 spark，source=`human_feedback`, confidence=0.40  
**实际**: Agent 成功执行了所有修改（更新 markdown），但**0 条 spark 被捕获**。  
**Spark 产出**: 0 条（预期 4 条）

**根因**: 同 D-2。模型在"修改文件"任务流程中不会额外执行 kindle。用户的行业术语纠正、维度补充、评分标准修正、合作社细化要求全部丢失。

---

### D-4: 闲聊信号 source 分类错误（TC-1.3）[Medium]

**TC**: TC-1.3  
**预期**: 用户闲聊中提到"水洗 vs 厌氧做意式基底"→ source=`casual_mining`, confidence=0.25, confirmation_status=`unconfirmed`  
**实际**: ✅ 成功捕获 1 条 spark，但 source=`human_teaching`（非 casual_mining）, confidence=0.7（非 0.25）, confirmation_status=`human_confirmed`  
**Spark 产出**: 1 条（预期 1 条）✅

| 字段 | 预期 | 实际 |
|------|------|------|
| source | `casual_mining` | `human_teaching` ❌ |
| confidence | 0.25 | 0.70 ❌ |
| confirmation_status | `unconfirmed` | `human_confirmed` ❌ |
| heuristic_type | `preference` | `preference` ✅ |
| card.boundary_conditions | 包含厌氧牛奶不搭条件 | 无 ❌ |
| card.context_envelope | 含 use_case:"意式基底" | 无 ❌ |

**根因**: AGENTS.md 中的 source type 列表虽然包含 `casual_mining`，但模型默认所有知识捕获都用 `human_teaching`。card 的高级字段（boundary_conditions, context_envelope）也未使用。

---

### D-5: 迭代精修未合并为弧线（TC-1.4）[Medium]

**TC**: TC-1.4  
**预期**: 3 轮修正不单独创建 spark → 最终确认后合成 1 条综合 spark，source=`iterative_refinement`, confidence=0.50，content 包含 3 轮修改要点  
**实际**: 最终确认后创建了 1 条 spark ✅，但 source=`human_teaching`（非 iterative_refinement），confidence=0.7（非 0.50），3 轮修改合并到了 heuristic 中（部分正确）  
**Spark 产出**: 1 条（预期 1 条）✅

| 字段 | 预期 | 实际 |
|------|------|------|
| source | `iterative_refinement` | `human_teaching` ❌ |
| confidence | 0.50 (min(0.60, 0.35+3×0.05)) | 0.70 ❌ |
| content | 3 轮修改要点分段记录 | 合并为一条 heuristic ✅（部分） |
| context.refinement_rounds | 3 | 无 ❌ |

**根因**: 模型没有识别到这是一个多轮迭代修正场景。它在最终确认时用 `human_teaching` 做了一次性捕获，而不是作为 `iterative_refinement` 弧线合成。

---

### D-6: 微追问未嵌入回复末尾（TC-1.5）[Medium]

**TC**: TC-1.5  
**预期**: Agent 在交付烘焙曲线最终版后，自发嵌入一句微追问（如"这个参数框架是耶加专用的，还是所有高海拔水洗豆都差不多？"）  
**实际**: Agent 在 TC-1.4 最终确认后只说"记录在案了"+"接下来要做什么？"，**没有嵌入微追问**。用户主动提供了肯尼亚例外信息后，Agent 正确捕获了 spark（source 仍为 human_teaching）。  
**Spark 产出**: 1 条（预期 1 条）✅，但触发方式不同

**根因**: 微追问（Micro-Probe）需要 Agent 主动发起边界探测，但 MiniMax-M2.5 倾向于被动响应而非主动提问。AGENTS.md 的 Sparker 循环中没有微追问的具体模板指令。

---

### D-7: 比较式采集缺少 A/B 选项生成前的 search（TC-1.6）[Low]

**TC**: TC-1.6  
**预期**: Agent 先 `search "意式拼配" "拿铁"`，基于已有 spark 生成 A/B 选项，用户选择后 kindle human_choice（confidence=0.30）  
**实际**: Agent 直接生成了 3 个方案（A/B/C），**未执行 search**。用户选择 A 后，**捕获了 1 条 spark** ✅，但 source=`human_teaching`（非 human_choice），confidence=0.7（非 0.30）  
**Spark 产出**: 1 条（预期 2 条，含 micro_probe 追问回答）

| 字段 | 预期 | 实际 |
|------|------|------|
| source | `human_choice` | `human_teaching` ❌ |
| confidence | 0.30 | 0.70 ❌ |
| domain | 咖啡烘焙.拼配设计 | coffee_blend ❌（英文+独立域） |
| 追问 spark | 1 条 micro_probe (boundary: 二三线城市) | 无单独 spark ❌ |

**根因**: 同 D-4，模型不区分 source 类型。用户选择偏好（human_choice）和追问边界条件（二三线城市+果酸不协调）均未被独立捕获。

---

### D-8: 结构化萃取未走 6 步框架（TC-1.11）[High]

**TC**: TC-1.11  
**预期**: Agent 启动 `teach` 会话，按 6 步引导用户（领域锚定 → 场景分解 → 规则提取 → 边界探测 → 复述确认 → 深度追问）  
**实际**: Agent 简单说"来，我准备好记录了"，然后**被动接收**用户逐条教学。**未执行 `teach` 命令**，未走结构化 6 步框架，未引导提问。  
**Spark 产出**: 4 条 ✅（杯测规则 + 边界 + 烘焙调整），质量尚可

| 步骤 | 预期 | 实际 |
|------|------|------|
| Step 1 领域锚定 | Agent 主动问方向 | ❌ 未执行 |
| Step 2 场景分解 | Agent 问常用场景 | ❌ 未执行 |
| Step 3 规则提取 | Agent 问标准流程 | ✅ 被动接收用户给的规则 |
| Step 4 边界探测 | Agent 问边界/例外 | ❌ 用户主动给的边界 |
| Step 5 复述确认 | Agent 整理复述让用户确认 | ❌ 未复述 |
| Step 6 深度追问 | Agent 追问深层关联 | ❌ 用户主动教的 |

**根因**: `teach` 命令的存在和用法没有出现在 AGENTS.md 的 Sparker 行为循环中。模型不知道有 teach 引导流程可用。

---

### D-9: source 类型全部为 human_teaching [High]

**TC**: 全部  
**预期**: 8 种不同 source 类型分布（human_teaching, casual_mining, human_feedback, iterative_refinement, task_negotiation, human_choice, micro_probe）  
**实际**: 全部 8 条 spark 的 source 均为 `human_teaching`

| 预期 Source | 预期条数 | 实际条数 |
|------------|---------|---------|
| task_negotiation | 3 | 0 |
| human_feedback | 4 | 0 |
| casual_mining | 1 | 0 |
| iterative_refinement | 1 | 0 |
| micro_probe | 2 | 0 |
| human_choice | 1 | 0 |
| human_teaching | ~6 | **8** |

**根因**: AGENTS.md 虽然列出了 source 类型及其含义，但 MiniMax-M2.5 统一使用 `human_teaching` 而不区分细粒度 source。模型缺乏对不同知识来源场景的语义区分能力。

---

### D-10: confidence 全部为 0.70，缺乏差异化 [Medium]

**TC**: 全部  
**预期**: confidence 根据 source 类型差异化（0.25~0.70 范围）  
**实际**: 全部 8 条 spark 的 confidence 均为 0.70

**根因**: 模型统一使用 `human_teaching` source → index.js 内部 `extractFromTeaching()` 自动设置 confidence=0.50+0.20(human_confirmed)=0.70。缺乏 source 差异化导致 confidence 无法差异化。

---

### D-11: domain 使用英文而非中文 [Low]

**TC**: 全部  
**预期**: domain 为中文（如 "咖啡烘焙.生豆选择"、"咖啡烘焙.烘焙曲线"）  
**实际**: domain 使用英文（如 "coffee_roasting"、"coffee_cupping"、"coffee_blend"），且为独立域而非子域

| 预期 domain | 实际 domain |
|------------|------------|
| 咖啡烘焙.生豆选择 | coffee_roasting |
| 咖啡烘焙.烘焙曲线 | coffee_roasting |
| 咖啡烘焙.杯测品控 | coffee_cupping |
| 咖啡烘焙.拼配设计 | coffee_blend |

**根因**: AGENTS.md 中的 kindle 模板使用 `"domain":"<domain>"` 占位符，模型自行决定使用英文命名。且未使用子域（dot notation）结构。

---

### D-12: card 高级字段（boundary_conditions, context_envelope）未使用 [Medium]

**TC**: TC-1.3, TC-1.5, TC-1.6  
**预期**: card 中包含 context_envelope（domain, sub_domain, extra.use_case 等）和 boundary_conditions（condition, effect, reason）  
**实际**: card 仅包含 heuristic 和 heuristic_type，无 context_envelope / boundary_conditions / preference_dimensions

**根因**: AGENTS.md 的 kindle 模板只展示了基础 card 格式 `{"heuristic":"...", "heuristic_type":"..."}`, 未包含高级字段。模型按模板填充，不会自行扩展。

---

### D-13: digest 未调用 CLI 命令 [Medium]

**TC**: TC-2.1  
**预期**: Agent 调用 `node index.js digest` 触发 9 步 digest 流程（归纳、晋升、衰减、画像更新、能力图谱重建）  
**实际**: Agent 从记忆中人工总结并写入 markdown 文件，**未调用 `digest` CLI**。无 RefinedSpark、无 DigestReport、无偏好画像更新。

**根因**: AGENTS.md 中的 digest 触发条件是"当用户说总结/digest时"，模型看到用户说"总结一下"，但选择了自己写 markdown 总结，而非调用 `digest` 命令。

---

### D-14: Spark #5 heuristic 为空 [Low]

**TC**: TC-1.11  
**预期**: 每条 spark 的 card.heuristic 应为非空的一句话规则  
**实际**: Spark #5 (id: raw_1772122668473) 的 heuristic 为空字符串 ""

**根因**: 模型在 kindle 命令中传入了空 heuristic 字段。可能是首次杯测教学信号（"我来教你怎么杯测"）时的误触发。

---

## 总结评分

| 维度 | V1 评分 | V2 评分 | 说明 |
|------|--------|--------|------|
| **Spark 自动捕获** | 0/10 | 5/10 | 约 50% 教学轮次自动触发 kindle |
| **Source 分类** | 0/10 | 1/10 | 全部 human_teaching，无差异化 |
| **Confidence 差异化** | 0/10 | 1/10 | 全部 0.70，无差异化 |
| **Card 质量** | 1/10 | 6/10 | heuristic 精练有效，但缺高级字段 |
| **冷启动协议** | 0/10 | 0/10 | 未触发 plan/status |
| **Digest/Temper** | 0/10 | 0/10 | 未调用 digest CLI |
| **微追问** | 0/10 | 0/10 | 未主动发起 |
| **结构化萃取** | 0/10 | 2/10 | 未走 6 步，但被动采集有效 |
| **任务融合** | 0/10 | 0/10 | 任务执行中不捕获 |
| **总体** | **0.1/10** | **3.5/10** | 从完全不工作到部分工作 |

---

## 核心差距分析

### ✅ 已解决
1. **storage.js CWD bug** — spark 现在能正确持久化
2. **SKILL.md 可见性** — frontmatter `always:true` 确保出现在 skill 列表
3. **CLI 命令可见性** — AGENTS.md 内联了 kindle/search/digest/plan 模板

### ❌ 仍未解决

#### P0: MiniMax-M2.5 的 source 语义区分
模型将所有知识来源统一归为 `human_teaching`。需要:
- 在 AGENTS.md 中提供更明确的场景→source 映射示例
- 或在 index.js 层面通过上下文自动推断 source（减少对模型判断的依赖）

#### P0: 任务执行中不捕获
模型在 "帮我写X" → "用户给标准" 的任务流中，100% 聚焦于任务完成，不并行执行 kindle。需要:
- post-task hook（任务完成后自动分析对话提取 spark）
- 或将 kindle 逻辑嵌入 post-task 命令（已存在但模型不调用）

#### P1: 主动行为（微追问、plan、teach）
模型不会主动发起行为。所有捕获都是对用户显式教学的响应。需要:
- 更强的模型能力（Claude/GPT-4 级别）
- 或代码层面的 hook/trigger（如"检测到新域→自动 plan"）

#### P2: card 高级字段
模型只使用 heuristic + heuristic_type，不使用 boundary_conditions / context_envelope。需要:
- AGENTS.md 中提供带高级字段的完整示例
- 或 index.js 层面根据 content 自动推断并填充这些字段

---

## 推荐修复优先级

| 优先级 | 修复项 | 投入 | 影响 |
|--------|--------|------|------|
| P0 | index.js 层面自动推断 source（分析 content 关键词） | 中 | 解决 D-4/D-5/D-7/D-9/D-10 |
| P0 | post-task 自动捕获 hook | 中 | 解决 D-2/D-3 |
| P1 | AGENTS.md 增加完整 kindle 示例（含高级字段） | 低 | 解决 D-12 |
| P1 | AGENTS.md 增加 teach/plan 触发指令 | 低 | 部分解决 D-1/D-8 |
| P2 | 替换更强模型（Claude/GPT-4） | 高 | 可能解决全部 |
| P2 | index.js 自动填充 boundary_conditions/context_envelope | 中 | 解决 D-12 |
