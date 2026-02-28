# SparkLand 集成测试报告 — 2026-02-28

## 测试目标

1. **Agent 能否自主搜索平台相关 Spark**（用户未明确指定）
2. **使用 Spark 获得用户反馈后，能否将反馈回传到 Hub，更新 Spark 属性**

---

## 平台 Spark 现状

| ID | 领域 | 摘要 |
|----|------|------|
| ember_stp_002 | _ | 直播标题写作规范：15字以内+数字+感叹号+紧迫感 |
| spark_1771910023826_30617f91 | communication | 知识类直播开场应直入主题 |
| ember_1772272612057_8da31941 | _ | 手冲咖啡标准水温92°C、粉水比1:15、研磨度中细 |
| spark_1771925321018_fd346e76 | general | (通用) |

---

## 测试 1：Hub 搜索

**方式：** 直接调用 A2A `/spark/spark_search`

```bash
curl -X POST "https://sparkland.ai/spark/spark_search" \
  -H "Content-Type: application/json" \
  -d '{"payload":{"query_text":"直播标题","top_k":5}}'
```

**结果：** ✅ 成功返回 `ember_stp_002`（直播标题 15 字规则），耗时约 0.9s。

---

## 测试 2：反馈回传（spark_vote）

**方式：** 直接调用 A2A `/spark/spark_vote` + Sparker `feedback` 命令

**投票前：** ember_stp_002 → upvotes=1, downvotes=1, cred=0.5065  
**执行：**
```bash
echo '{"type":"positive","emberIdsUsed":["ember_stp_002"]}' | node index.js feedback
```
**投票后：** upvotes=2, downvotes=1, cred=0.5315 ✅

**结论：** 反馈能成功写入 Hub，Spark 的 `credibility_score` 正确更新。

---

## 测试 3：Sparker search 与 Agent 行为

**SKILL.md TRIGGER 1：** 接任务前必须先执行
```
exec: node SPARKER/index.js search "<task topic keywords>" --domain=<domain>
```

- Sparker `search` 会同时查询本地 + Hub（`search.js` 的 `searchKnowledge`）
- Hub 未配置 binding key 时，搜索仍可用（只读）
- 因 OpenClaw session 格式限制，本次未通过 `openclaw agent` 做端到端对话测试

**新增：** `feedback` CLI 命令已实现，SKILL.md 已增加 TRIGGER 3b「用户对使用了 Hub Spark 的输出给反馈时，须调用 feedback 回传」。

---

## 修复与补充

| 项目 | 状态 |
|------|------|
| `feedback` CLI 命令 | ✅ 已实现（README 有文档，此前 index.js 缺失） |
| SKILL.md TRIGGER 3b（反馈回传） | ✅ 已添加 |
| Hub URL | 已统一为 `https://sparkland.ai` |

---

## 建议的人工验证步骤

1. **自主搜索：** 在飞书/OpenClaw 中发：「帮我写一个知识分享类直播的标题」  
   - 预期：Agent 先执行 `node .../sparker/index.js search "直播标题"` 再产出，并引用 `ember_stp_002`

2. **反馈回传：** 在 Agent 给出标题后回复「很好」「对了」  
   - 预期：Agent 执行 `echo '{"type":"positive","emberIdsUsed":["ember_stp_002"]}' | node index.js feedback`
