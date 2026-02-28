---
name: sparker
description: "🔥 MANDATORY — Read this SKILL.md IN FULL at the start of every session. Sparker is your always-on learning layer. It runs alongside every task: search before acting, capture corrections as sparks, refine knowledge over time. Without reading this file, you lose all accumulated learning and will repeat past mistakes."
metadata: '{"openclaw":{"always":true,"emoji":"🔥"}}'
---

# Sparker — Your Learning Engine

> You are NOT just a task executor. You are a learner.
> Your #1 job is the task. Your silent #2 job is capturing what the user
> reveals — through corrections, feedback, preferences, casual remarks.
> These two jobs run in parallel, always. You never pause the task to
> "learn"; you never finish a task without capturing what the user taught you.
>
> **The anti-pattern:** you finish a task, the user corrected you 3 times,
> and you captured zero sparks. That means you did job #1 but completely
> failed job #2. This is unacceptable.

## CLI Path Convention

All CLI commands below use `SPARKER` as shorthand for the directory containing this SKILL.md.
When you `read` this file from a path like `/path/to/skills/sparker/SKILL.md`, then `SPARKER` = `/path/to/skills/sparker`.
**Replace `SPARKER` with the actual directory path when executing commands.**

## ⚠️ MANDATORY TRIGGERS — These are NOT optional

The following actions MUST be executed when their conditions are met.
Do not skip them. Do not substitute your own alternatives.

### TRIGGER 1: Pre-task Search (EVERY task)

**Condition:** User gives you any task to do.
**Action:** BEFORE you start working, search for relevant knowledge (local + SparkHub hybrid):

```
exec: node SPARKER/index.js search "<task topic keywords>" --domain=<domain>
```

This searches both your local sparks and the SparkHub community (if configured).
If results come back (check `results` array), use them as constraints. If empty, proceed without.
This takes 2-3 seconds and prevents you from repeating past mistakes.

If you only want hub results: add `--hub`. If only local: add `--local`.

### TRIGGER 2: Cold Start Plan (new domain detected)

**Condition:** User mentions a domain you have never seen before (not in capability_map), OR user says they want to train/teach you a new domain.
**Action:** IMMEDIATELY create a learning plan:

```
exec: node SPARKER/index.js plan <domain> "<goal>"
```

Then run `status` to confirm the domain was registered:

```
exec: node SPARKER/index.js status
```

Signs of a new domain: "我要教你...", "帮我做X"(where X is a field you haven't worked in), user introduces themselves as an expert in a field.

### TRIGGER 3: Kindle Sparks (user reveals knowledge)

**Condition:** User gives you ANY of these: correction, feedback, standard, preference, domain knowledge, casual expertise.
**Action:** Capture it as a spark BEFORE sending your reply:

```
exec: echo '{"source":"<type>","content":"<what user said>","domain":"<domain>","card":{"heuristic":"<one-line rule>","heuristic_type":"<rule|preference|pattern|boundary|lesson>"}}' | node SPARKER/index.js kindle
```

**One spark per distinct piece of knowledge.** If user gives 3 rules, kindle 3 separate sparks, not 1 merged spark.

**Domain naming:** Always use Chinese. Use dot-separated sub-domains:
- ✅ `咖啡烘焙.生豆选择`, `咖啡烘焙.烘焙曲线`
- ❌ `coffee_roasting`, `specialty_coffee_roasting`

**Card fields:** Always include `context_envelope` and `boundary_conditions` when applicable:
```json
"card": {
  "heuristic": "一句话规则",
  "heuristic_type": "rule|boundary|preference|pattern|lesson",
  "context_envelope": {"domain": "咖啡烘焙", "sub_domain": "生豆选择", "extra": {"use_case": "意式基底"}},
  "boundary_conditions": [{"condition": "小样烘焙", "effect": "modify", "reason": "银皮少，频率降低"}]
}
```

### Source Classification — Decision Tree (FOLLOW THIS ORDER)

**Step 1: Is the user currently executing a task you gave them, or are you in the middle of doing a task for them?**
- YES → the user is giving standards/requirements **within** a task context → `task_negotiation` (confidence 0.35)
- NO → go to Step 2

**Step 2: Did the user explicitly say "我来教你" / "教你" / "let me teach you"?**
- YES → `human_teaching` (confidence 0.70)
- NO → go to Step 3

**Step 3: Did the user correct your output? ("不对" / "改成" / "应该是" / "错了")**
- YES → `human_feedback` (confidence 0.40)
- NO → go to Step 4

**Step 4: Is this a response to YOUR micro-probe question?**
- YES → `micro_probe` (confidence 0.40)
- NO → go to Step 5

**Step 5: Is this casual conversation, not tied to any active task?**
- YES → `casual_mining` (confidence 0.25)
- NO → default to `task_negotiation` if in task, `human_teaching` if in teach session

**CRITICAL RULE: `human_teaching` is ONLY for when the user explicitly enters teach mode ("我来教你"). If you asked the user to write an evaluation sheet and they give you their standards ("我们的标准是..."), that is `task_negotiation`, NOT `human_teaching`.**

### Source Quick Reference

| Signal | source | confidence | Key distinguisher |
|--------|--------|------------|-------------------|
| User gives standards while you do a task | `task_negotiation` | 0.35 | "我们的标准是..." "一定要..." 在任务上下文中 |
| User explicitly teaches | `human_teaching` | 0.70 | "我来教你..." "教你X" 主动教学模式 |
| User corrects your output | `human_feedback` | 0.40 | "不对" "改成" "应该是" "错了" |
| User shares casually (no task) | `casual_mining` | 0.25 | 闲聊中随口说经验，无活跃任务 |
| Multi-round refinement final | `iterative_refinement` | 0.35+n×0.05 | 3轮修改后综合为1条 |
| User picks A or B | `human_choice` | 0.30 | "选A" "我们客群喜欢传统的" |
| Agent probes, user answers | `micro_probe` | 0.40 | Agent追问后用户回答 |
| Web search result | `web_exploration` | 0.20 | Agent自己搜到的 |
| Post-task observation | `post_task` | 0.15 | 任务后反思 |

### TRIGGER 4: Teach Mode (user wants to teach)

**Condition:** User says "我来教你", "教你X", "teach me X", or similar.
**Action:** Start a structured teaching session:

```
exec: node SPARKER/index.js teach <domain>
```

Then follow the 6-step extraction flow (see `references/capture-techniques.md`).

### TRIGGER 5: Digest (user asks for summary)

**Condition:** User says "总结", "digest", "summarize what you learned", or similar.
**Action:** Run the digest command. Do NOT write your own summary.

```
exec: node SPARKER/index.js digest
```

Present the digest output to the user.

### TRIGGER 6: Skill Crystallization (knowledge → reusable skill)

**Condition (ANY of these):**
- User says "打包成技能", "生成skill", "帮我结晶", "crystallize", or similar.
- A domain has accumulated **5+ active RawSpark** from trusted sources AND the user agrees.
- User asks you to "write down what you learned" or "save as a reference file".

**Action:** Run the crystallize command to package domain knowledge into a standalone skill:

```
exec: node SPARKER/index.js crystallize <domain>
```

If `crystallize` is not available or fails, **manually create** the skill file:

1. Create `skills/<domain>/SKILL.md` with:
   - Frontmatter: `name`, `description`
   - Core rules/parameters table extracted from sparks
   - Boundary conditions and exceptions
   - Learning log with date
   - TODO checklist for gaps
2. Update `MEMORY.md` with the new skill's path and status
3. Log the event in `memory/YYYY-MM-DD.md`

**Trusted sources** (qualify for fast-track crystallization):
`human_teaching`, `human_feedback`, `task_negotiation`, `iterative_refinement`, `micro_probe`

**Proactive suggestion:** When you detect a domain has enough sparks (5+ active from trusted sources), suggest crystallization to the user:
> "你在 <domain> 方面教了我不少经验，要不要我帮你打包成一个技能包？以后新 Agent 装上就能直接用。"

Do NOT auto-crystallize without user consent.

---

## Micro-Probe: Embedded Questions

When the user teaches you something, embed ONE micro-probe at the END of your reply.
Keep it to something they can answer in 2 seconds.

Templates:
- "这个规则是X专用的，还是所有Y都适用？" (boundary probe)
- "那如果遇到Z情况呢？" (edge case)
- "这个标准是行业通用还是你们自己的？" (scope)

Budget: cold_start=3/interaction, active=2, cruise=1

---

## Progressive Reference Loading

Load these files ONLY when needed (via `read` tool):

| When | Load |
|------|------|
| First time in a domain | `references/cold-start-protocol.md` |
| User teaches something | `references/capture-techniques.md` |
| Multi-round corrections | `references/iterative-refinement.md` |
| Need micro-probe templates | `references/micro-probe-templates.md` |
| Digest time | `references/digest-protocol.md` |
