# OpenClaw 多模型调用与绑定机制分析

## 概述

OpenClaw 采用**提供者-模型双层配置架构**，支持灵活接入多种 LLM 推理 API。通过配置文件声明式定义模型和提供者，运行时动态绑定对应的流式输出函数，实现对不同 API 格式的适配。

---

## 一、配置结构

### 1.1 配置层级

OpenClaw 在 `openclaw.json` 中采用两级结构定义模型：

```json
{
  "models": {
    "providers": {
      "[provider-id]": {
        "baseUrl": "https://...",
        "apiKey": "...",
        "api": "openai-completions",
        "models": [
          {
            "id": "model-id",
            "name": "model-name",
            "input": ["text", "image"],
            "contextWindow": 256000,
            "maxTokens": 32000
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "provider-id/model-id"
      },
      "models": {
        "provider-id/model-id": {}
      }
    },
    "list": [
      {
        "id": "agent-id",
        "model": "provider-id/model-id",
        "tools": {
          "profile": "minimal"
        }
      }
    ]
  },
  "bindings": [
    {
      "agentId": "agent-id",
      "match": {
        "channel": "feishu",
        "accountId": "default"
      }
    }
  ]
}
```

> 以你的配置文件 `C:\Users\ThinkPad\.openclaw\openclaw.json` 为例：
> - 提供者: `volcengine-plan` (火山引擎方舟平台)
> - API 类型: `openai-completions` (兼容 OpenAI 格式)
> - 多个模型: `ark-code-latest`, `doubao-seed-code`, `glm-4.7`, `deepseek-v3.2` 等
> - 默认主代理绑定: `volcengine-plan/minimax-m2.5`
> - 路由绑定: Feishu 渠道 `default` 账号 → `main` 代理，`coding` 账号 → `coding` 代理

### 1.2 支持的 API 类型

```typescript
const MODEL_APIS = [
  "openai-completions",     // OpenAI 兼容 completions API
  "openai-responses",       // OpenAI Responses API
  "openai-codex-responses", // OpenAI Codex Responses
  "anthropic-messages",     // Anthropic Messages API
  "google-generative-ai",   // Google Gemini API
  "github-copilot",         // GitHub Copilot
  "bedrock-converse-stream", // AWS Bedrock
  "ollama",                 // 本地 Ollama
]
```

### 1.3 模型定义字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 模型 ID |
| `name` | string | 模型显示名称 |
| `api` | string | API 类型 (覆盖提供者级别) |
| `reasoning` | boolean | 是否支持推理 |
| `input` | `text`[] / `image`[] | 支持的输入类型 |
| `contextWindow` | number | 上下文窗口大小 (tokens) |
| `maxTokens` | number | 最大输出 tokens |
| `cost` | object | 计费信息 (input/output/cacheRead/cacheWrite) |
| `headers` | object | 自定义请求头 |
| `compat` | object | 兼容性配置 (见下文) |

### 1.4 提供者定义字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `baseUrl` | string | API 基础 URL |
| `apiKey` | string | API 密钥 (支持 secret 引用) |
| `auth` | `api-key`/`aws-sdk`/`oauth`/`token` | 认证模式 |
| `api` | string | 默认 API 类型 |
| `models` | array | 模型列表 |
| `headers` | object | 自定义请求头 |
| `injectNumCtxForOpenAICompat` | boolean | 是否注入 `num_ctx` (Ollama 兼容) |

### 1.5 兼容性配置 (compat)

```typescript
type ModelCompatConfig = {
  supportsStore?: boolean;            // 是否支持 OpenAI Responses store
  supportsDeveloperRole?: boolean;    // 是否支持 developer 角色
  supportsReasoningEffort?: boolean;  // 是否支持 reasoning_effort
  supportsUsageInStreaming?: boolean; // 流式响应是否返回 usage
  supportsTools?: boolean;            // 是否支持原生工具调用
  supportsStrictMode?: boolean;        // 是否支持 strict mode
  maxTokensField?: "max_completion_tokens" | "max_tokens";
  thinkingFormat?: "openai" | "zai" | "qwen"; // 思维标签格式
  requiresToolResultName?: boolean;   // 是否要求 tool_result 包含 name
  requiresAssistantAfterToolResult?: boolean; // 是否需要 assistant 占位
  requiresThinkingAsText?: boolean;   // 是否要求推理作为文本输出
  requiresMistralToolIds?: boolean;   // 是否需要 Mistral 格式工具 ID
};
```

---

## 二、模型引用与解析

### 2.1 模型引用格式

模型使用 `provider/model-id` 格式唯一标识：

```
volcengine-plan/ark-code-latest
↳ 提供者: volcengine-plan
↳ 模型 ID: ark-code-latest
```

### 2.2 解析流程 (`src/agents/model-selection.ts`)

```
┌───────────────────────────────────────────────────────────┐
│  resolveDefaultModelForAgent()                            │
│  ├─ 获取代理配置中的模型 primary                              │
│  ├─ 如果没有，回退到 agents.defaults.model.primary          │
│  └─ 解析输出 ModelRef { provider, model }                    │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌───────────────────────────────────────────────────────────┐
│  parseModelRef(raw, defaultProvider)                       │
│  ├─ 如果包含 '/'，分割为 provider + model                    │
│  ├─ 如果不包含 '/'，使用别名查找                              │
│  └─ normalizeProviderId + normalizeModelId → 输出          │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌───────────────────────────────────────────────────────────┐
│  提供者名称规范化 (normalizeProviderId)                     │
│  - z.ai / z-ai → "zai"                                     │
│  - bytedance / doubao → "volcengine"                        │
│  - bedrock / aws-bedrock → "amazon-bedrock"                 │
│  - volcengine-plan → 认证查找时归一化为 "volcengine"       │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌───────────────────────────────────────────────────────────┐
│  结果: ModelRef { provider, model }                         │
└───────────────────────────────────────────────────────────┘
```

### 2.3 别名支持

在 `agents.defaults.models` 中可配置别名：

```json
{
  "agents": {
    "defaults": {
      "models": {
        "volcengine-plan/ark-code-latest": {
          "alias": "codellatest"
        }
      }
    }
  }
}
```

之后可以直接使用别名引用: `codellatest` → 自动解析为 `volcengine-plan/ark-code-latest`

---

## 三、Agent 与模型绑定

### 3.1 绑定层级

OpenClaw 支持三级绑定：

| 层级 | 说明 |
|------|------|
| **默认全局** | `agents.defaults.model` - 所有未特别指定的代理使用 |
| **代理级别** | `agents.list[].model` - 特定代理覆盖 |
| **频道路由绑定** | `bindings[]` - 根据频道/账号匹配到特定代理 |

### 3.2 解析流程

```typescript
// 1. 解析代理 ID
const { sessionAgentId } = resolveSessionAgentIds({ sessionKey, config, agentId });

// 2. 获取模型主引用
const modelRef = resolveDefaultModelForAgent({ cfg: config, agentId: sessionAgentId });
//   ↳ 优先使用 agent 配置的 model
//   ↳ 否则使用 defaults.model.primary
//   ↳ 否则回退到硬编码默认值 (anthropic/claude-sonnet-4-5)

// 3. 在配置的 providers 中查找提供者配置
const providerConfig = config.models.providers[modelRef.provider];

// 4. 在提供者的 models 列表中查找模型定义
const modelConfig = providerConfig.models.find(m => m.id === modelRef.model);
```

### 3.3 频道-代理路由绑定 (`bindings`)

```json
{
  "bindings": [
    {
      "agentId": "main",
      "match": {
        "channel": "feishu",
        "accountId": "default"
      }
    },
    {
      "agentId": "coding",
      "match": {
        "channel": "feishu",
        "accountId": "coding"
      }
    }
  ]
}
```

当收到消息时：

```
消息 → channel = feishu, accountId = coding
  ↓
遍历 bindings，匹配 channel + accountId
  ↓
得到 agentId = coding
  ↓
使用 coding 代理配置，其绑定 model = volcengine-plan/minimax-m2.5
  ↓
创建代理会话，使用该模型调用
```

这样实现了**同一个 OpenClaw 网关中，不同渠道账号使用不同代理/模型**。

---

## 四、流函数 (StreamFn) 动态绑定

### 4.1 什么是 StreamFn

`StreamFn` 是一个函数类型：

```typescript
type StreamFn = (
  model: ModelInfo,
  context: Context,
  options: StreamOptions
) => AsyncEventStream<AssistantMessage>;
```

它负责：

1. 构建正确的 API 请求格式
2. 建立连接（HTTP/WebSocket）
3. 解析流式响应
4. 转换为 pi-coding-agent 期望的统一事件格式

### 4.2 按 API/提供者选择 StreamFn

在 `src/agents/pi-embedded-runner/run/attempt.ts` 中：

```typescript
if (params.model.api === "ollama") {
  // Ollama 本地推理需要自定义流式处理
  const ollamaStreamFn = createConfiguredOllamaStreamFn({
    model: params.model,
    providerBaseUrl,
  });
  activeSession.agent.streamFn = ollamaStreamFn;
  ensureCustomApiRegistered(params.model.api, ollamaStreamFn);
} else if (params.model.api === "openai-responses" && params.provider === "openai") {
  // OpenAI Responses API 使用 WebSocket 流式传输
  const wsApiKey = await params.authStorage.getApiKey(params.provider);
  if (wsApiKey) {
    activeSession.agent.streamFn = createOpenAIWebSocketStreamFn(
      wsApiKey,
      params.sessionId,
      { signal: runAbortController.signal }
    );
  } else {
    activeSession.agent.streamFn = streamSimple; // 回退到 HTTP
  }
} else {
  // 默认使用 pi-ai 提供的 streamSimple
  activeSession.agent.streamFn = streamSimple;
}
```

| API/提供者 | StreamFn | 位置 |
|------------|----------|------|
| `ollama` | `createConfiguredOllamaStreamFn()` | `src/agents/ollama-stream.ts` |
| `openai-responses` (OpenAI) | `createOpenAIWebSocketStreamFn()` | `src/agents/openai-ws-stream.ts` |
| `openai-completions` / `anthropic-messages` / 其他 | `streamSimple` | `@mariozechner/pi-ai` |

### 4.3 包装链设计

StreamFn 选择后，会根据模型/提供者特性应用多层包装：

```typescript
// 原始 streamFn
let streamFn = baseStreamFn;

// 1. Ollama OpenAI 兼容模式: 注入 num_ctx
if (shouldInjectOllamaCompatNumCtx(...)) {
  streamFn = wrapOllamaCompatNumCtx(streamFn, numCtx);
}

// 2. 额外参数 (temperature, reasoning effort 等)
streamFn = createStreamFnWithExtraParams(...);

// 3. 缓存追踪 (调试)
if (cacheTrace) {
  streamFn = cacheTrace.wrapStreamFn(streamFn);
}

// 4. 移除 thinking 块 (某些 Anthropic 端点不支持)
if (transcriptPolicy.dropThinkingBlocks) {
  streamFn = wrap(streamFn, dropThinkingBlocks);
}

// 5. 工具调用 ID 格式化 (Mistral 要求特定格式)
if (transcriptPolicy.sanitizeToolCallIds) {
  streamFn = wrap(streamFn, sanitizeToolCallIds);
}

// 6. OpenAI Responses: 降级工具调用格式
if (params.model.api === "openai-responses") {
  streamFn = wrap(streamFn, downgradeOpenAIFunctionCallReasoningPairs);
}

// 7. 工具名称修剪 (去除空格)
streamFn = wrapStreamFnTrimToolCallNames(streamFn, allowedToolNames);

// 8. Anthropic: 修复错误格式工具调用
if (shouldRepairMalformedAnthropicToolCallArguments(params.provider)) {
  streamFn = wrapStreamFnRepairMalformedToolCallArguments(streamFn);
}

// 9. xAI: 解码 xAI 特定工具调用格式
if (isXaiProvider(params.provider, params.modelId)) {
  streamFn = wrapStreamFnDecodeXaiToolCallArguments(streamFn);
}

// 10. Anthropic payload 日志 (调试)
if (anthropicPayloadLogger) {
  streamFn = anthropicPayloadLogger.wrapStreamFn(streamFn);
}
```

这种**装饰器模式**允许针对不同模型特性灵活组合不同预处理逻辑，而不影响核心流程。

---

## 五、支持的提供者/模型适配

### 5.1 Ollama 本地模型 (`api: "ollama"`)

**位置**: `src/agents/ollama-stream.ts`

特点：

- 默认识别 `http://127.0.0.1:11434`
- 使用 `/api/chat` NDJSON 流式端点
- 手动解析 NDJSON 流，因为 Ollama 只在最后一个块返回完整工具调用
- 使用模型配置的 `contextWindow` 作为 `num_ctx`，不使用默认 4096
- 支持自定义 headers

**请求格式转换**:
```
pi-coding-agent 消息格式
  ↓
convertToOllamaMessages()
  ↓
Ollama /api/chat 请求
  ↓
解析 NDJSON 流，累积内容和工具调用
  ↓
转换为 pi-coding-agent AssistantMessage 事件格式
```

### 5.2 OpenAI 兼容 API (`api: "openai-completions"`)

你的配置示例 (`volcengine-plan`) 就是这种类型：

```json
{
  "volcengine-plan": {
    "baseUrl": "https://ark.cn-beijing.volces.com/api/coding/v3",
    "apiKey": "ac0b51e5-...",
    "api": "openai-completions",
    "models": [...]
  }
}
```

特点：

- 使用 `streamSimple` from `@mariozechner/pi-ai`
- 符合 OpenAI Chat Completions 格式的均可接入
- 火山引擎方舟、字节跳动豆包、DeepSeek、GLM、Kimi 等均可通过这种方式接入
- OpenClaw 只做统一工具调用格式封装，API 原生响应处理由 pi-ai 处理

### 5.3 OpenAI Responses API (`api: "openai-responses"`)

特点：

- 支持 OpenAI 官方 Responses API
- 优先使用 WebSocket 流式传输 (`createOpenAIWebSocketStreamFn`)
- WebSocket 连接失败自动回退到 HTTP
- 支持 incremental 流式输出，previous_response_id 增量传输

### 5.4 Anthropic Messages API (`api: "anthropic-messages"`)

特点：

- 使用 `streamSimple` 处理
- 内置对 thinking/beta 格式的支持
- 自动移除 thinking 块避免 API 拒绝
- 支持错误格式工具调用参数修复

### 5.5 Google Gemini (`api: "google-generative-ai"`)

特点：

- 特殊处理工具调用配对（Gemini 格式差异）
- 验证消息轮转顺序
- 清理工具模式适配

### 5.6 xAI / Grok

特点：

- 特殊工具调用格式解码
- 因为 xAI 已自带 web_search，过滤掉重复的 OpenClaw web_search 工具

---

## 六、完整调用流程

```
User: 收到消息
  │
  ▼
┌─────────────────────────────────────────────────────────────┐
│  1. 根据 channel + accountId 匹配 bindings                 │
│  → 得到目标 agentId                                      │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│  2. 在 agents.list 查找 agent 配置                          │
│  → 读取 agent.model                                      │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│  3. 解析模型引用 getModelRef                              │
│  → 拆分 providerId + modelId                              │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│  4. 从 config.models.providers 获取 providerConfig          │
│  从 providerConfig.models 获取 modelConfig                │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│  5. 根据 api 类型选择基础 StreamFn                          │
│                                                             │
│  api = "ollama"                      → createConfiguredOllamaStreamFn
│  api = "openai-responses" + OpenAI  → createOpenAIWebSocketStreamFn
│  其它                              → streamSimple (from pi-ai)
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│  6. 应用多层包装器                                        │
│  ├─ Ollama compat: inject num_ctx                          │
│  ├─ Extra params: temperature, reasoning effort            │
│  ├─ Cache trace (if debug)                               │
│  ├─ Drop thinking blocks (if needed)                      │
│  ├─ Sanitize tool call IDs (for Mistral)                  │
│  ├─ Downgrade OpenAI function format                      │
│  ├─ Trim tool names                                       │
│  ├─ Repair Anthropic malformed JSON                       │
│  ├─ Decode xAI tool call format                            │
│  └─ Log payload (if logging enabled)                       │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│  7. 绑定到 activeSession.agent.streamFn                    │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│  8. 创建工具 → 构建提示词 → 创建会话 → 调用 streamFn          │
│  → streamFn 发起请求到对应 API                             │
│  → 流式输出事件 → pi-embedded-subscribe 处理                │
│  → 结果投递到用户渠道                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 七、认证与 API 密钥管理

OpenClaw 使用 `AuthProfileStore` 管理 API 密钥：

| 认证模式 | 说明 |
|----------|------|
| `api-key` | 直接在配置中 `apiKey` 设置 |
| `oauth` | OAuth 2.0 刷新令牌流 (Anthropic OAuth Claude Code) |
| `aws-sdk` | AWS SDK 默认凭证链 (Bedrock) |
| `token` | 静态令牌 |

支持自动轮换、冷却、失败重试：

- 认证配置文件存储在 `~/.openclaw/auth/`
- 失败的认证配置自动进入冷却
- 按轮询顺序选择下一个可用认证配置
- 支持 OAuth 令牌自动刷新

---

## 八、故障转移 (Failover)

OpenClaw 支持模型级故障转移：

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "volcengine-plan/ark-code-latest",
        "fallbacks": [
          "volcengine-plan/doubao-seed-2.0-code",
          "volcengine-plan/deepseek-v3.2"
        ]
      }
    }
  }
}
```

当主模型调用失败：

1. 标记当前模型为失败
2. 进入冷却
3. 自动尝试回退列表中的下一个模型
4. 直到找到可用模型或全部失败

支持代理级别覆盖全局回退列表。

---

## 九、关键设计特点

### 9.1 声明式配置

- 不需要修改代码，通过 `openclaw.json` 增减模型
- 支持同一提供者配置多个模型
- 支持多个提供者

### 9.2 分层覆盖

- 默认全局配置 ← 代理级别覆盖 ← 动态运行时覆盖
- 灵活满足不同场景需求（不同频道/账号用不同模型）

### 9.3 适配层包装

- 核心流程统一
- 不同 API 差异通过 StreamFn 包装隔离
- 多层装饰器支持精细适配

### 9.4 高可用性

- 内置认证轮换
- 模型故障转移
- 传输失败回退 (WebSocket → HTTP)
- 自动冷却不健康的认证/模型

---

## 十、参考文件

| 文件 | 功能 |
|------|------|
| `src/config/types.models.ts` | 模型配置类型定义 |
| `src/agents/model-selection.ts` | 模型引用解析 |
| `src/agents/agent-scope.ts` | 代理配置解析 |
| `src/agents/ollama-stream.ts` | Ollama 流式实现 |
| `src/agents/openai-ws-stream.ts` | OpenAI Responses WebSocket |
| `src/agents/custom-api-registry.ts` | 自定义 API 注册 |
| `src/agents/pi-embedded-runner/run/attempt.ts` | 主要绑定逻辑 |
| `src/agents/auth-profiles.ts` | 认证配置管理 |
| `src/agents/pi-embedded-subscribe.ts` | 流式事件处理 |
