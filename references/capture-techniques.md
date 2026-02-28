# 11 种知识采集技术（Capture Techniques）

## 技术速查表

| # | 技术名称 | source 字段 | 触发场景 | confidence | extraction_method |
|---|---------|------------|---------|-----------|------------------|
| 1 | 任务嵌入式学习 | `task_negotiation` | 任务执行中用户给出标准/要求 | 0.35 | `task_negotiation` |
| 2 | 修改痕迹提炼 | `human_feedback` | 用户纠正 Agent 输出 | 0.40 | `feedback` |
| 3 | 闲聊信号捕捉 | `casual_mining` | 用户闲聊中随口提到经验 | 0.25 | `casual_mining` |
| 4 | 迭代精修弧 | `iterative_refinement` | 多轮修改后最终确认 | min(0.60, 0.35+n×0.05) | `iterative_refinement` |
| 5 | 微追问 | `micro_probe` | Agent 在回复末尾嵌入追问 | 0.40 | `micro_probe` |
| 6 | 比较式采集 | `human_choice` | 用户从 A/B 选项中选择 | 0.30 | `feedback` |
| 7 | 选择历史归纳 | — | 15+ spark 后自动执行 | — | `preference_profiling` |
| 8 | 点评式验证 | `human_feedback` | 用户点评社区 Ember | 0.40 | `review` |
| 9 | 资料导入提炼 | `document_ingestion` | 用户上传文件 | 0.30~0.55 | `document_ingestion` |
| 10 | 对话记录采集 | `transcript_extraction` | 用户上传会议纪要 | 0.30~0.45 | `transcript_extraction` |
| 11 | 结构化萃取 | `human_teaching` | 用户说"我来教你" | 0.70 | `teaching` |

## Source → 场景映射规则

**判断逻辑**（按优先级）：

1. 用户说"我来教你/让我教你" → `human_teaching`
2. 用户纠正 Agent 输出（"不对/改成/太X了"） → `human_feedback`
3. 用户在任务执行中给出标准（"我们的标准是..."） → `task_negotiation`
4. 多轮修改的最终确认（"好，可以了"） → `iterative_refinement`
5. Agent 追问后用户回答 → `micro_probe`
6. 用户从 A/B 选项中选择 → `human_choice`
7. 用户闲聊中随口提到经验（非任务、非教学） → `casual_mining`
8. Agent 自己搜索网络获得 → `web_exploration`

## Kindle 调用模板

### task_negotiation（用户在任务中给出标准）
```bash
echo '{
  "source": "task_negotiation",
  "content": "到港水分标准 10-12%，超过12%不收",
  "domain": "咖啡烘焙.生豆选择",
  "card": {
    "heuristic": "到港水分10-12%，超12%不收",
    "heuristic_type": "rule",
    "context_envelope": {"domain": "咖啡烘焙", "sub_domain": "生豆选择"}
  },
  "confirmation_status": "human_confirmed"
}' | node index.js kindle
```

### human_feedback（用户纠正输出）
```bash
echo '{
  "source": "human_feedback",
  "content": "User corrected: 把外观评分改成生豆外观",
  "domain": "咖啡烘焙.生豆选择",
  "card": {
    "heuristic": "生豆评估表用'生豆外观'而非'外观评分'",
    "heuristic_type": "rule"
  }
}' | node index.js kindle
```

### casual_mining（闲聊中的经验判断）
```bash
echo '{
  "source": "casual_mining",
  "content": "意式基底用水洗豆优于厌氧日晒",
  "domain": "咖啡烘焙.处理法选择",
  "card": {
    "heuristic": "意式基底用水洗豆优于厌氧日晒",
    "heuristic_type": "preference",
    "context_envelope": {"domain": "咖啡烘焙", "sub_domain": "处理法选择", "extra": {"use_case": "意式基底"}},
    "boundary_conditions": [{"condition": "厌氧发酵感与牛奶不搭", "effect": "do_not_apply", "reason": "发酵风味在牛奶咖啡中产生异味"}]
  }
}' | node index.js kindle
```

### iterative_refinement（多轮修改合成）
```bash
echo '{
  "source": "iterative_refinement",
  "domain": "咖啡烘焙.烘焙曲线",
  "corrections": [
    {"summary": "入豆温180°C起步"},
    {"summary": "发展时间60-90秒"},
    {"summary": "出豆温195-200°C，RoR不翻正"}
  ],
  "card": {
    "heuristic": "耶加水洗烘焙: 入豆180°C+, 发展60-90秒, 出豆195-200°C, RoR持续下降",
    "heuristic_type": "pattern",
    "context_envelope": {"domain": "咖啡烘焙", "sub_domain": "烘焙曲线"}
  }
}' | node index.js kindle
```

### micro_probe（追问获得的回答）
```bash
echo '{
  "source": "micro_probe",
  "content": "高海拔水洗豆通用此框架，肯尼亚多发展10-15秒",
  "domain": "咖啡烘焙.烘焙曲线",
  "confidence": 0.40,
  "confirmation_status": "human_confirmed",
  "card": {
    "heuristic": "肯尼亚豆比耶加多发展10-15秒平衡酸感",
    "heuristic_type": "boundary",
    "boundary_conditions": [{"condition": "肯尼亚豆", "effect": "modify", "reason": "发展时间+10-15秒平衡酸感"}]
  }
}' | node index.js kindle
```

## Domain 命名规范

- **使用中文**：`咖啡烘焙`（不用 `coffee_roasting`）
- **子域用点分隔**：`咖啡烘焙.生豆选择`、`咖啡烘焙.烘焙曲线`
- **保持一致性**：同一领域的所有 spark 使用相同的 root domain
