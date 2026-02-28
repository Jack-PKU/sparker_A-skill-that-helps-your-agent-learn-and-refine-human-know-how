# Sparker Skill 部署指南

> 将 sparker 技能部署到一个新的 openclaw agent 实例时，需要修改/配置的所有内容。

---

## 快速清单

```
1. 复制技能目录        → skills/sparker/
2. 修改 AGENTS.md      → 加读取 SKILL.md 指令
3. 修改 SOUL.md        → 加学习本能描述
4. 配置 openclaw.json  → LLM provider + API key + env
5. 配置 models.json    → 每 provider 的 apiKey
6. 安装 npm 依赖  → mammoth / pdf-parse
```

---

## 1. 复制技能目录

将 `openclaw/skills/sparker/` 整个目录复制到目标 agent 的 workspace：

```bash
cp -r /path/to/openclaw/skills/sparker/ /target/workspace/skills/sparker/

cd /target/workspace/skills/sparker/
npm install  # 安装 mammoth、pdf-parse（可选，用于文档导入）
```

要求: Node.js >= 18

SKILL.md 中的 CLI 命令使用 `SPARKER` 占位符代表技能目录。Agent 在读取 SKILL.md 时会自动根据文件实际路径推导出 `SPARKER` 的值，无需手动修改路径。

---

## 2. 修改 AGENTS.md

在 workspace 的 `AGENTS.md` 的 "Every Session" 中添加：

```markdown
## Every Session

Before doing anything else:

1. Read `SOUL.md` — this is who you are
2. Read `USER.md` — this is who you're helping
3. Read `memory/YYYY-MM-DD.md` (today + yesterday) for recent context
4. If in MAIN SESSION: Also read `MEMORY.md`
5. **Read `skills/sparker/SKILL.md` IN FULL** — this is your learning engine. You are a learner; every session you must load the complete Sparker skill to activate your always-on learning behavior. Do not skip this step, do not summarize from memory, read the actual file.
```

关键: 必须写 **IN FULL**，不能让 Agent 跳读或从记忆中回忆。

---

## 3. 修改 SOUL.md

在 `SOUL.md` 中 Boundaries 之后、Continuity 之前添加：

```markdown
## 学习本能（Sparker — 你的核心身份之一）

你不只是一个执行任务的工具，你是一个**学习者**。

每次对话你都有两个并行任务：
1. 帮用户完成他们要求的事情
2. 从用户的纠正、反馈、偏好、随口一说中捕捉知识

这两个任务永远同时进行，你永远不会为了学习暂停任务，也永远不会完成任务却忘了学习。

**具体怎么做**：每次会话开始时，用 `read` 工具读取 `skills/sparker/SKILL.md` 的完整内容，然后严格按照其中的 5 个 Mandatory Trigger 执行。这不是可选的。
```

---

## 4. 配置 openclaw.json

文件位置: `~/.openclaw/openclaw.json`

以下是完整的配置模板，LLM 使用 **Claude Sonnet 4.6**（通过代理），Embedding 使用**豆包**：

```json
{
  "env": {
    "STP_FORGE_LLM_ENDPOINT": "https://cc.honoursoft.cn",
    "STP_FORGE_LLM_API_KEY": "sk-HGUDIRB1oktzdXvu5sYPfalK3Akt8LM5BRvObdpAY5xqMN1r",
    "STP_FORGE_LLM_MODEL": "claude-sonnet-4-6",
    "STP_EMBEDDING_ENDPOINT": "https://ark.cn-beijing.volces.com/api/v3/embeddings",
    "STP_EMBEDDING_API_KEY": "390c9f95-5312-48b1-bd6f-6e4652fd95af",
    "STP_EMBEDDING_MODEL": "doubao-embedding",
    "STP_HUB_URL": "https://sparkland.ai",
    "STP_TRANSPORT": "http",
    "STP_DIGEST_INTERVAL_HOURS": "12",
    "STP_RL_FREQUENCY": "balanced"
  },
  "models": {
    "mode": "merge",
    "providers": {
      "anthropic": {
        "baseUrl": "https://cc.honoursoft.cn",
        "api": "anthropic-messages",
        "models": [
          {
            "id": "claude-sonnet-4-6",
            "name": "Claude Sonnet 4.6",
            "reasoning": true,
            "input": ["text"],
            "cost": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            },
            "contextWindow": 200000,
            "maxTokens": 16384
          }
        ]
      },
      "doubao": {
        "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
        "apiKey": "390c9f95-5312-48b1-bd6f-6e4652fd95af",
        "api": "openai-completions",
        "models": [
          {
            "id": "Doubao-Seed-2.0",
            "name": "Doubao-Seed-2.0 (豆包)",
            "reasoning": false,
            "input": ["text"],
            "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
            "contextWindow": 128000,
            "maxTokens": 4096
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic/claude-sonnet-4-6"
      },
      "workspace": "/root/.openclaw/workspace"
    }
  }
}
```

---

## 4.1 把 skill 交给其他人 / 部署到其他服务器时，SparkLand 配置写在哪

当你把 sparker 技能拷贝给其他人，或部署到**另一台服务器**上的 OpenClaw 时，SparkLand（社区知识）相关配置需要在**该机器**的以下位置之一配置，二选一即可：

| 配置方式 | 文件位置 | 说明 |
|----------|----------|------|
| **推荐** | `~/.openclaw/openclaw.json` | 在顶层 `env` 或 `skills.entries.sparker.env` 中加 `STP_HUB_URL`、`STP_TRANSPORT`；Gateway 会把 env 传给 skill 进程。 |
| 备选 | 环境变量 | 在启动 OpenClaw/Gateway 的 shell 里 `export STP_HUB_URL=https://sparkland.ai`，或 systemd 的 `Environment=`。 |

**身份绑定（binding_key）** 不在 openclaw.json 里配置，而是保存在**同一台机器、同一系统用户**下的 `~/.openclaw/sparkhub.json`。  
因此在新机器或新用户下，需要在该机器上执行一次：

```bash
cd <workspace>/skills/sparker
node index.js hub-url https://sparkland.ai
node index.js login --email=你的邮箱 --password=你的密码
```

这样 `~/.openclaw/sparkhub.json` 会写入 `hub_url` 和 `binding_key`，`whoami` / `status` 才会显示 `bound: true`（否则飞书/企业微信等机器人会一直提示「还没有绑定」）。

**小结**：  
- **Hub 地址等环境变量** → `~/.openclaw/openclaw.json` 的 `env` 或 `skills.entries.sparker.env`（或系统环境变量）。  
- **登录/绑定** → 在该机器该用户下执行一次 `node index.js login`（或 `bind <key>`），写入 `~/.openclaw/sparkhub.json`。

---

## 5. 配置 models.json

文件位置: `~/.openclaw/agents/main/agent/models.json`

每个 provider 的 apiKey 在这里配置（会合并到 openclaw.json 的 providers 中）：

```json
{
  "providers": {
    "anthropic": {
      "baseUrl": "https://cc.honoursoft.cn",
      "api": "anthropic-messages",
      "apiKey": "sk-HGUDIRB1oktzdXvu5sYPfalK3Akt8LM5BRvObdpAY5xqMN1r",
      "models": [
        {
          "id": "claude-sonnet-4-6",
          "name": "Claude Sonnet 4.6",
          "reasoning": true,
          "input": ["text"],
          "cost": { "input": 3, "output": 15, "cacheRead": 0.3, "cacheWrite": 3.75 },
          "contextWindow": 200000,
          "maxTokens": 16384
        }
      ]
    },
    "doubao": {
      "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
      "apiKey": "390c9f95-5312-48b1-bd6f-6e4652fd95af",
      "api": "openai-completions",
      "models": [
        {
          "id": "Doubao-Seed-2.0",
          "name": "Doubao-Seed-2.0 (豆包)",
          "reasoning": false,
          "input": ["text"],
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
          "contextWindow": 128000,
          "maxTokens": 4096
        }
      ]
    }
  }
}
```

---

## 6. 环境变量完整参考

所有 `STP_` 前缀的变量，可通过 `openclaw.json` 的 `env` 字段配置，也可通过系统环境变量设置。

### LLM — Sparker 内部推理（digest/forge 聚合用）

| 变量 | 值 | 说明 |
|------|-----|------|
| `STP_FORGE_LLM_ENDPOINT` | `https://cc.honoursoft.cn` | Anthropic 代理地址 |
| `STP_FORGE_LLM_API_KEY` | `sk-HGUDIRB1oktzdXvu5sYPfalK3Akt8LM5BRvObdpAY5xqMN1r` | Anthropic API Key |
| `STP_FORGE_LLM_MODEL` | `claude-sonnet-4-6` | Claude Sonnet 4.6 |

### Embedding — 语义检索

| 变量 | 值 | 说明 |
|------|-----|------|
| `STP_EMBEDDING_ENDPOINT` | `https://ark.cn-beijing.volces.com/api/v3/embeddings` | 豆包 Embedding 接口 |
| `STP_EMBEDDING_API_KEY` | `390c9f95-5312-48b1-bd6f-6e4652fd95af` | 豆包 API Key |
| `STP_EMBEDDING_MODEL` | `doubao-embedding` | 豆包 Embedding 模型 |

### SparkLand — 知识社区

| 变量 | 值 | 说明 |
|------|-----|------|
| `STP_HUB_URL` | `https://sparkland.ai` | SparkLand 服务地址 |
| `STP_TRANSPORT` | `http` | 传输方式，固定 `http` |

> **SparkLand 配置说明:** 平台已上线。将 `STP_HUB_URL` 设为 `https://sparkland.ai` 即可启用跨 Agent 知识共享。

### 行为调优

| 变量 | 值 | 说明 |
|------|-----|------|
| `STP_DIGEST_INTERVAL_HOURS` | `12` | Digest 自动触发间隔（小时） |
| `STP_DIGEST_LOCK_STALE_MS` | `7200000` | Digest 锁超时（毫秒，默认 2h） |
| `STP_CRED_BOOST` | `0.05` | 实践成功的置信度加成 |
| `STP_CRED_PENALTY` | `0.03` | 实践失败的置信度惩罚 |
| `STP_CONFIDENCE_THRESHOLD` | `0.60` | Raw → Refined 晋升阈值 |
| `STP_MIN_PRACTICE_COUNT` | `2` | 晋升所需最小实践次数 |
| `STP_FORGE_THRESHOLD` | `0.85` | Refined → Ember 结晶阈值 |
| `STP_FORGE_MIN_CITATIONS` | `8` | 结晶所需最小引用数 |
| `STP_RL_FREQUENCY` | `balanced` | 学习激进度: `aggressive` / `balanced` / `conservative` |
| `STP_MAX_RL_PER_DAY` | `3` | 每日最大主动学习次数 |
| `STP_RL_COOLDOWN_MINUTES` | `60` | 主动学习冷却时间（分钟） |
| `STP_CHECK_INTERVAL_HOURS` | `3` | 生命周期检查间隔（小时） |
| `STP_USER_CONTEXT_CACHE_MS` | `600000` | 用户上下文缓存 TTL（毫秒，默认 10min） |

### 系统级

| 变量 | 值 | 说明 |
|------|-----|------|
| `AGENT_NAME` | 按需填写 | Agent 名称，用于生成节点 ID |
| `STP_NODE_ID` | 自动生成 | 覆盖自动节点 ID（一般不需要） |
| `OPENCLAW_WORKSPACE` | 自动检测 | 工作空间目录（一般不需要） |

---

## 7. 数据存储

Sparker 的所有数据存储在技能目录下，首次运行自动创建：

```
skills/sparker/assets/stp/
├── raw_sparks/          # 原始知识碎片 (JSONL)
├── refined_sparks/      # 精炼知识 (JSON)
├── embers/              # 结晶知识 (JSON)
├── capability_map/      # 能力图谱 (JSON)
├── digest_reports/      # 复盘报告 (JSONL)
├── extraction_sessions/ # 教学会话 (JSONL)
├── practice_records/    # 实践记录 (JSONL)
└── a2a/                 # Agent 间通信
    ├── outbox/
    └── inbox/
```

**备份建议:** 定期备份 `assets/stp/` — 这是 Agent 的全部学习成果。

---

## 8. 验证部署

```bash
cd /your/workspace/skills/sparker

# 1. 模块加载
npm test
# → "All modules OK"

# 2. plan 命令
node index.js plan 测试领域 "验证部署"
# → 返回 JSON

# 3. kindle 命令
echo '{"source":"human_teaching","content":"测试","domain":"测试","card":{"heuristic":"测试规则","heuristic_type":"rule"}}' | node index.js kindle
# → 返回 RawSpark JSON

# 4. search 命令
echo '{"query":"测试","domain":"测试"}' | node index.js search
# → 返回搜索结果

# 5. digest 命令
node index.js digest
# → 返回 DigestReport JSON

# 6. status 命令
node index.js status
# → 返回状态统计

# 7. 清理测试数据
rm -rf assets/stp/
```

---

## 9. 部署到新服务器的完整步骤

```bash
# ① 在新服务器上安装 openclaw（如果还没装）
# ② 复制技能
scp -r skills/sparker/ user@newserver:/path/to/workspace/skills/sparker/
cd /path/to/workspace/skills/sparker && npm install

# ③ 编辑 AGENTS.md — 加第 5 条
# ④ 编辑 SOUL.md — 加学习本能段落

# ⑤ 配置 ~/.openclaw/openclaw.json
#    复制上面第 4 节的完整 JSON

# ⑥ 配置 ~/.openclaw/agents/main/agent/models.json
#    复制上面第 5 节的完整 JSON

# ⑦ 验证
cd /path/to/workspace/skills/sparker && npm test

# ⑧ 开始使用
openclaw agent --message '你好，我想教你一些东西'
```

---

## 10. 常见问题

**Q: Agent 没有自动执行 kindle/search**
→ 检查 AGENTS.md 中是否有 `Read skills/sparker/SKILL.md IN FULL`

**Q: kindle 报 "Cannot find module"**
→ 确认 `src/` 目录完整复制，特别是 `src/kindle/extractor.js` 和 `src/temper/promoter.js`

**Q: source 分类不准确**
→ 推荐 Claude Sonnet 4.6 或同级模型；较弱模型可能忽略 Decision Tree 细节

**Q: digest 时 LLM 聚合失败**
→ 检查 `STP_FORGE_LLM_*` 三个变量是否正确配置；未配置时自动降级为纯规则聚合

**Q: search 结果不精准**
→ 检查 `STP_EMBEDDING_*` 三个变量；未配置 Embedding 时降级为 TF-IDF（功能正常但精度略低）

**Q: SparkLand 连接失败**
→ 确认 `STP_HUB_URL` 为 `https://sparkland.ai`，检查网络
