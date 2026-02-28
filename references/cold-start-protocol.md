# 冷启动协议（Cold Start Protocol）

当 Agent 遇到一个**全新领域**（capability_map 中不存在或状态为 `blind_spot`）时，按以下步骤执行：

## Phase 1: 识别与注册

1. 执行 `plan <domain> "<goal>"` — 在 capability_map 中注册新领域
2. 执行 `status` — 确认当前状态（应为空或 blind_spot）
3. 执行 `search "<domain>"` — 搜索 SparkLand 是否有现成 Ember

## Phase 2: 自主研究（Research）

- 搜索网络了解领域全貌
- 分解子技能树（P0 核心 / P1 进阶 / P2 商业）
- 搜索结果以 `web_exploration` source kindle

## Phase 3: 切入教学

- 向用户汇报自主研究结果
- 询问用户想从哪个子领域开始
- 如果用户主动说"我来教你"，进入 `teach` 结构化萃取模式

## 冷启动模式下的行为特征

| 行为 | 冷启动 (cold_start) | 正常 (active) | 巡航 (cruise) |
|------|---------------------|---------------|---------------|
| 搜索激进度 | 激进 | 平衡 | 按需 |
| 提问频率 | 高 (3次/交互) | 中 (2次/交互) | 低 (1次/交互) |
| 溯源频率 | 无（无知识可溯源） | 适度 | 高置信度时溯源 |
| 微追问预算 | 3次/交互 | 2次/交互 | 1次/交互 |

## 退出条件

当满足以下任一条件时退出冷启动模式，进入 `active` 模式：
- 该领域 spark_count >= 5
- 该领域 practice_count >= 2
- 用户明确表示基础知识已教完
