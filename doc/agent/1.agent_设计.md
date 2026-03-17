# OpenClaw Agent 提示词构造与工具调用流程分析

## 概述

OpenClaw 是一个基于 **@mariozechner/pi-coding-agent** 和 **@mariozechner/pi-ai** 核心框架构建的个人代理系统。本文档分析其提示词构造方式和工具调用流程。

---

## 一、提示词构造架构

### 1.1 核心入口

提示词构造采用分层设计，主要入口位于：

- **主构建器**: `src/agents/system-prompt.ts` - `buildAgentSystemPrompt()`
- **嵌入式包装器**: `src/agents/pi-embedded-runner/system-prompt.ts` - `buildEmbeddedSystemPrompt()`

### 1.2 提示词模式 (PromptMode)

系统支持三种提示词模式，用于不同场景：

```typescript
type PromptMode = "full" | "minimal" | "none";
```

- `full`: 包含所有章节（默认，主代理使用）
- `minimal`: 减少章节，仅保留工具、工作区、运行时（子代理使用）
- `none`: 只返回基础身份行

### 1.3 `buildAgentSystemPrompt()` 参数

| 参数 | 说明 |
|------|------|
| `workspaceDir` | 工作目录路径 |
| `defaultThinkLevel` | 默认思考级别 |
| `reasoningLevel` | 推理级别 (`off`/`on`/`stream`) |
| `extraSystemPrompt` | 额外系统提示 |
| `ownerNumbers` | 授权发送者号码列表 |
| `ownerDisplay` | 显示方式 (`raw`/`hash`) |
| `ownerDisplaySecret` | HMAC 密钥用于哈希显示 |
| `reasoningTagHint` | 是否提示使用 `<think>` 标签 |
| `toolNames` | 可用工具名称列表 |
| `toolSummaries` | 工具描述摘要映射 |
| `modelAliasLines` | 模型别名定义行 |
| `userTimezone` | 用户时区 |
| `userTime` | 当前用户时间 |
| `contextFiles` | 注入的上下文文件 |
| `skillsPrompt` | Skills 技能提示 |
| `heartbeatPrompt` | 心跳提示词 |
| `docsPath` | 文档路径 |
| `workspaceNotes` | 工作区备注 |
| `ttsHint` | 语音合成提示 |
| `acpEnabled` | 是否启用 ACP 路由指南 |
| `runtimeInfo` | 运行时元数据 |
| `messageToolHints` | 消息工具提示 |
| `sandboxInfo` | 沙箱信息 |
| `reactionGuidance` | 反应引导（Telegram） |
| `memoryCitationsMode` | 记忆引用模式 |

### 1.4 提示词章节构造顺序

提示词按以下顺序构建多个章节：

1. **身份** - `You are a personal assistant running inside OpenClaw.`
2. **Tooling** - 列出所有可用工具及其描述
   - 内置工具在 `coreToolSummaries` 中预定义描述
   - 额外工具按字母排序追加
   - 强调工具名称区分大小写
3. **Tool Call Style** - 工具调用风格指南
   - 默认不叙述常规低风险工具调用
   - 仅在需要时叙述（多步、复杂、敏感操作）
   - 需要批准时保留完整命令
4. **Safety** - 安全护栏
   - 没有独立目标，不追求自我保存、复制、资源获取或权力寻求
   - 优先安全和人工监督，冲突时暂停询问
   - 不操纵他人扩大访问或禁用安全保护
5. **OpenClaw CLI Quick Reference** - CLI 命令快速参考
6. **Skills** (条件) - 技能使用指南
   - 明确匹配一个技能就读取 SKILL.md 并遵循
   - 最多只读一个，不提前多读
7. **Memory Recall** (条件) - 记忆召回指南
   - 回答关于先前工作、决策、日期、人物偏好前，先搜索记忆
   - 支持引用模式配置
8. **OpenClaw Self-Update** (条件) - 自我更新指南
   - 仅在用户明确要求时允许更新
   - 列出可用操作：`config.schema.lookup`, `config.get`, `config.apply`, `config.patch`, `update.run`
9. **Model Aliases** (条件) - 模型别名定义
10. **Current Date & Time** (条件) - 当前时区信息
11. **Authorized Senders** (条件) - 授权发送者列表
12. **Workspace** - 工作目录信息
    - 沙箱模式下特别说明文件路径解析规则
13. **Documentation** (条件) - 文档链接
14. **Sandbox** (条件) - 沙箱运行时信息
    - 容器工作目录、主机挂载源、工作区访问权限、浏览器信息、elevated 执行权限
15. **Reply Tags** (条件) - 回复标签格式指南（`[[reply_to_current]]`）
16. **Messaging** - 消息路由指南
    - 当前会话回复自动路由到源频道
    - 跨会话消息使用 `sessions_send`
    - 子代理编排使用 `subagents`
    - `message` 工具使用说明
17. **Voice (TTS)** (条件) - 语音合成提示
18. **Subagent/Group Context** (条件) - 额外上下文提示
19. **Reactions** (条件) - 反应引导（Telegram 最小/扩展模式）
20. **Reasoning Format** (条件) - 推理格式要求
    - 要求所有内部推理放在 `<think>...</think>`
    - 用户可见回复放在 `<final>...</final>`
21. **Project Context** (条件) - 注入项目上下文文件
    - 特别处理 `SOUL.md` 人格要求
    - 每个文件内容内联注入
22. **Silent Replies** (条件) - 静默回复规则
    - 无内容回复时仅返回 `SILENT_REPLY_TOKEN`
    - 必须是整个消息，不能附加其他内容
23. **Heartbeats** (条件) - 心跳处理
    - 心跳轮询时若无需要注意事项回复 `HEARTBEAT_OK`
24. **Runtime** - 运行时元数据行
    - 包含 agentId、host、os、arch、node、model、channel、capabilities、thinking 等

### 1.5 构建流程图示

```
┌─────────────────────────────────────────────────────────────┐
│        buildEmbeddedSystemPrompt (pi-embedded-runner)       │
│  接收参数：workspaceDir, tools, runtimeInfo, sandboxInfo... │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│  extract toolNames from tools                               │
│  buildToolSummaryMap() 构建工具摘要                         │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│          buildAgentSystemPrompt (system-prompt)             │
│  ┌─────────────────┐  按顺序拼接各个章节                     │
│  │ Identity        │  →  "You are a personal assistant..."  │
│  │ Tooling         │  →  列出所有可用工具                  │
│  │ Tool Call Style │  →  工具调用风格指南                  │
│  │ Safety          │  →  安全护栏                          │
│  │ CLI Reference   │  →  OpenClaw CLI 快速参考            │
│  │ Skills          │  →  (条件) 技能使用指南              │
│  │ Memory Recall   │  →  (条件) 记忆召回指南               │
│  │ Self-Update     │  →  (条件) 自我更新指南              │
│  │ Model Aliases   │  →  (条件) 模型别名                   │
│  │ Workspace       │  →  工作目录 + 沙箱说明              │
│  │ Documentation   │  →  (条件) 文档链接                   │
│  │ Sandbox         │  →  (条件) 沙箱信息                  │
│  │ Authorized      │  →  (条件) 授权发送者                 │
│  │ Time            │  →  (条件) 当前时间                  │
│  │ Messaging       │  →  消息路由指南                      │
│  │ Context         │  →  (条件) 注入项目上下文            │
│  │ Silent Reply    │  →  (条件) 静默回复规则              │
│  │ Heartbeats      │  →  (条件) 心跳处理                  │
│  │ Runtime         │  →  运行时元数据                     │
│  └─────────────────┘                                        │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│                     返回最终拼接的提示词                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、工具创建与注册流程

### 2.1 工具创建入口

工具创建入口：`src/agents/pi-tools.ts` - `createOpenClawCodingTools()`

### 2.2 工具创建步骤

1. **解析策略配置**
   - 解析全局/代理/提供商/分组/子代理工具策略
   - 确定哪些工具允许被当前会话使用

2. **集成基础工具** (`@mariozechner/pi-coding-agent` 内置)
   - `read` - 根据是否沙箱，包装不同的读取实现
   - `write` - 非沙箱环境保留，沙箱环境使用专门包装
   - `edit` - 非沙箱环境保留，沙箱环境使用专门包装
   - 移除原有 `bash`，替换为 `exec` 实现

3. **创建核心工具**
   - `exec` - 创建执行工具（支持 PTY、背景超时、批准流程）
   - `process` - 创建后台进程管理工具
   - `apply_patch` - （条件启用）多文件补丁应用

4. **创建 OpenClaw 专属工具**
   - 调用 `createOpenClawTools()` in `src/agents/openclaw-tools.ts`
   - 包含：`browser`, `canvas`, `nodes`, `cron`, `message`, `gateway`, `agents_list`, `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`, `sessions_yield`, `subagents`, `session_status`, `web_search`, `web_fetch`, `image`, `pdf`, `tts` 等
   - 动态加载插件工具通过 `resolvePluginTools()`

5. **应用策略过滤**
   - 按消息提供者过滤（语音渠道禁用 tts）
   - 按模型提供者过滤（xAI 已自带 web_search 则移除）
   - 应用所有者仅策略
   - 应用完整工具策略管道处理

6. **参数标准化**
   - 对每个工具的 JSON Schema 参数标准化
   - 处理提供商特定的 Schema 清理（Gemini 需要移除约束关键词）

7. **包装钩子**
   - `wrapToolWithBeforeToolCallHook` - 在执行前运行 `before_tool_call` 插件钩子
   - `wrapToolWithAbortSignal` - （可选）包装中止信号支持

### 2.3 工具分类

| 分类 | 工具列表 |
|------|----------|
| 基础文件操作 | `read`, `write`, `edit`, `apply_patch`, `grep`, `find`, `ls` |
| 命令执行 | `exec`, `process` |
| 网络 | `web_search`, `web_fetch` |
| 浏览器/展示 | `browser`, `canvas` |
| 节点设备 | `nodes` |
| 定时任务 | `cron` |
| 消息路由 | `message`, `gateway` |
| 会话管理 | `agents_list`, `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`, `sessions_yield`, `subagents`, `session_status` |
| 媒体处理 | `image`, `pdf`, `tts` |
| 记忆 | `memory_search`, `memory_get` |
| 插件扩展 | 动态加载自 `extensions/` |

### 2.4 工具定义转换

转换入口：`src/agents/pi-tool-definition-adapter.ts` - `toToolDefinitions()`

将内部 `AgentTool[]` 转换为 `@mariozechner/pi-coding-agent` 期望的 `ToolDefinition[]` 格式：

```typescript
export function toToolDefinitions(tools: AnyAgentTool[]): ToolDefinition[] {
  return tools.map((tool) => ({
    name: tool.name,
    label: tool.label ?? tool.name,
    description: tool.description ?? "",
    parameters: tool.parameters,
    execute: async (...args) => {
      // 1. 拆分参数（处理新旧两种参数签名）
      const { toolCallId, params, onUpdate, signal } = splitToolExecuteArgs(args);

      // 2. 如果尚未包装，运行 before_tool_call 钩子
      if (!beforeHookWrapped) {
        const hookOutcome = await runBeforeToolCallHook(...);
        if (hookOutcome.blocked) throw new Error(hookOutcome.reason);
        executeParams = hookOutcome.params;
      }

      // 3. 执行工具
      const rawResult = await tool.execute(toolCallId, executeParams, signal, onUpdate);

      // 4. 标准化结果格式
      return normalizeToolExecutionResult({ toolName, result: rawResult });
    }
  }));
}
```

**结果标准化**保证返回格式一致：

```typescript
{
  content: [{ type: "text", text: string }],
  details: any
}
```

---

## 三、工具调用执行流程

### 3.1 执行入口

主执行入口：`src/agents/pi-embedded-runner/run/attempt.ts` - `runEmbeddedAttempt()`

完整流程图示：

```
┌─────────────────────────────────────────────────────────────┐
│                    runEmbeddedAttempt                        │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│  1. 创建工具集合                                             │
│  tools = createOpenClawCodingTools(options)                  │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│  2. 转换工具定义格式                                         │
│  toolDefs = toToolDefinitions(tools)                         │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│  3. 构建系统提示词                                           │
│  prompt = buildEmbeddedSystemPrompt({                        │
│             workspaceDir, runtimeInfo, sandboxInfo, tools    │
│          })                                                  │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│  4. 创建代理会话                                             │
│  ({ session }) = await createAgentSession({                  │
│           systemPrompt: prompt,                              │
│           tools: toolDefs,                                   │
│           streamFn: streamSimple,  // 或自定义流            │
│           // ... 其他配置                                   │
│        })                                                    │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│  5. 添加用户消息到会话                                      │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│  6. 订阅流式事件                                            │
│  subscription = subscribeEmbeddedPiSession({ session, ... }) │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│  7. 启动回复生成                                            │
│  await session.reply()  // 支持流式输出                     │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│  8. 等待完成，收集结果                                      │
│  处理工具调用结果，返回最终回复                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 流式事件处理

事件订阅入口：`src/agents/pi-embedded-subscribe.ts` - `subscribeEmbeddedPiSession()`

处理来自 `pi-coding-agent` 的以下事件类型：

| 事件 | 处理 |
|------|------|
| `assistant` | 累积助手文本，处理 `<think>`/`<final>` 标签剥离，推送给回调 |
| `tool_use` | 记录工具调用（保存 `toolCallId` 对应关系） |
| `tool_result` | 记录工具结果，触发工具结果输出 |
| `error` | 记录错误 |
| `stop` | 标记完成 |

**标签处理逻辑**：

- `<think>...</think>` - 内部推理，对用户隐藏，推理模式开启时可流式输出
- `<final>...</final>` - 用户可见内容，仅输出此区域内文本
- 跨块边界正确处理标签状态
- 代码跨度内忽略标签匹配（避免误匹配注释/字符串中的标签）

### 3.3 `before_tool_call` 钩子机制

在 `src/agents/pi-tools.before-tool-call.ts` 中实现：

- 插件可以注册 `before_tool_call` 钩子
- 每次工具执行前都会运行所有钩子
- 钩子可以：
  - 允许执行（不阻塞）
  - 阻塞执行（返回 `blocked: true` + 原因）
  - 修改参数（返回调整后的 `params`）

应用场景：循环检测、日志记录、权限检查

### 3.4 工具结果防护 (Session Tool Result Guard)

位置：`src/agents/session-tool-result-guard.ts`

功能：
- 跟踪未完成的工具调用
- 为严格提供者合成缺失的工具结果
- 标准化工具结果名称
- 对工具结果应用大小上限
- 在写入消息前运行 `before_message_write` 钩子

---

## 四、完整执行流程时序图

```
User Request
    │
    ▼
┌──────────────────────────────────┐
│  1. 构建提示词                   │
│  - buildEmbeddedSystemPrompt()  │
│  - buildAgentSystemPrompt()     │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│  2. 创建工具集合                 │
│  - createOpenClawCodingTools()  │
│  - 应用策略过滤 → 钩子包装      │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│  3. 转换工具定义                 │
│  - toToolDefinitions()           │
│  - 适配 pi-coding-agent 格式    │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│  4. 创建代理会话                 │
│  - createAgentSession()          │
│  (来自 @mariozechner/pi-coding)  │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│  5. 添加用户消息                 │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│  6. 订阅流式事件                 │
│  - subscribeEmbeddedPiSession() │
│  - 处理 assistant/tool_use/     │
│    tool_result/error/stop 事件  │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│  7. 调用 LLM 生成回复           │
│  - session.reply()               │
│  - 流式输出到回调               │
└────────────┬─────────────────────┘
             │
             ├──────────────────────────────────────────┐
             │ 模型生成工具调用 (tool_use)               │
             ↓                                          │
        ┌──────────────────────────────────┐            │
        │  8. before_tool_call 钩子       │            │
        │  - 运行所有注册钩子             │            │
        │  - 检查是否被阻止               │            │
        └────────────┬─────────────────────┘            │
             │                                          │
             ▼                                          │
        ┌──────────────────────────────────┐            │
        │  9. 执行工具                     │            │
        │  - 工具具体逻辑                 │            │
        │  - 返回结果                     │            │
        └────────────┬─────────────────────┘            │
             │                                          │
             ▼                                          │
        ┌──────────────────────────────────┐            │
        │  10. 标准化结果                  │            │
        │  - 统一 content[] 格式          │            │
        │  - 传回给 LLM                   │            │
        └────────────┬─────────────────────┘            │
             │                                          │
             └──────────────────┬───────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────┐
│  11. 完成生成，收集所有回复                            │
│  12. 返回最终结果给调用者 (Slack/Telegram/...)        │
└──────────────────────────────────────────────────────┘
```

---

## 五、关键设计特点

### 5.1 提示词设计

1. **模块化章节** - 根据条件动态包含/排除章节，支持 `full`/`minimal`/`none` 三种模式
2. **上下文注入** - 支持将项目文件（如 `SOUL.md`, `CLAUDE.md`）直接内联到提示词中
3. **推理隔离** - 通过 `<think>`/`<final>` 标签强制分离内部推理和用户可见回复
4. **安全护栏** - 前置安全章节明确约束代理行为

### 5.2 工具设计

1. **策略驱动** - 基于配置的多级工具策略（全局/代理/分组/子代理/沙箱）
2. **提供者感知** - 根据不同 LLM 提供者调整工具和 Schema（xAI 去重 `web_search`，Gemini 清理 Schema）
3. **插件扩展** - 支持动态加载外部插件工具
4. **钩子机制** - `before_tool_call` 允许插件在执行前拦截/修改工具调用

### 5.3 执行设计

1. **流式优先** - 全程支持流式输出，支持推理内容实时流式推送到客户端
2. **状态跟踪** - 跨块跟踪标签状态，正确处理流式块边界
3. **去重抑制** - 检测并抑制通过 messaging 工具已发送的重复回复
4. **压缩重试** - 支持上下文压缩失败的重试机制

---

## 六、核心文件索引

| 文件 | 功能 |
|------|------|
| `src/agents/system-prompt.ts` | 主提示词构建器 |
| `src/agents/pi-embedded-runner/system-prompt.ts` | 嵌入式提示词包装器 |
| `src/agents/pi-tools.ts` | 工具集合工厂 |
| `src/agents/openclaw-tools.ts` | OpenClaw 专属工具创建 |
| `src/agents/pi-tool-definition-adapter.ts` | 工具定义格式转换 |
| `src/agents/pi-embedded-runner/run/attempt.ts` | 单次尝试执行入口 |
| `src/agents/pi-embedded-subscribe.ts` | 流式事件订阅处理 |
| `src/agents/pi-tools.before-tool-call.ts` | before_tool_call 钩子执行 |
| `src/agents/session-tool-result-guard.ts` | 工具结果防护 |
| `src/agents/tools/*.ts` | 各工具具体实现 |

---

## 七、总结

OpenClaw 的 Agent 系统采用**分层提示词构造** + **策略驱动工具管理** + **流式事件处理**的架构：

- **提示词**：模块化章节拼接，支持多种模式，动态注入上下文，强制推理隔离
- **工具**：多层策略过滤，提供者特定适配，插件扩展，钩子拦截
- **执行**：流式事件驱动，标签化推理/回复分离，支持子代理编排，沙箱隔离
